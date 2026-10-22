import { describe, expect, it } from 'vitest';
import { combinarLembretes, gerarLembretes } from './lembretes';
import type { Divida, Recorrencia, Transacao } from '../tipos';

const referencia=new Date(2026,9,21,18);
const recorrencia=(extra:Partial<Recorrencia>={}):Recorrencia=>({id:'r1',descricao:'Aluguel',valor:100,tipo:'saida',categoria:'Casa',diaDoMes:21,inicio:new Date(2026,9,1),parcelas:null,ativa:true,modoLancamento:'confirmar',automaticoDesde:null,automaticoAte:null,observacao:null,criadoEm:null,...extra});
const divida=(extra:Partial<Divida>={}):Divida=>({id:'d1',descricao:'Cartão',valor:100,valorPago:0,credor:'Banco',dataVencimento:new Date(2026,9,20),observacao:null,criadoEm:null,...extra});
const transacao=(extra:Partial<Transacao>={}):Transacao=>({id:'t1',descricao:'Gasto',valor:80,tipo:'saida',categoria:'Casa',data:new Date(2026,9,1),recorrenciaId:null,observacao:null,criadoEm:null,...extra});
const base=()=>({referencia,recorrencias:[] as Recorrencia[],dividas:[] as Divida[],transacoes:[] as Transacao[],orcamento:{mes:'2026-10',limites:{},atualizadoEm:null}});

describe('Lembretes calculados',()=>{
  it('distingue vencido, hoje e próximos três dias sem aviso para datas distantes',()=>{
    const lista=gerarLembretes({...base(),recorrencias:[20,21,24,25].map(dia=>recorrencia({id:`r${dia}`,diaDoMes:dia}))});
    expect(lista.map(l=>l.titulo)).toEqual(['Vencimento passado: Aluguel','Vence hoje: Aluguel','Vence em breve: Aluguel']);
  });
  it('ignora conta lançada, pausada, série futura e parcelas encerradas',()=>{
    expect(gerarLembretes({...base(),recorrencias:[recorrencia(),recorrencia({id:'pausada',ativa:false}),recorrencia({id:'futura',inicio:new Date(2026,10,1)}),recorrencia({id:'encerrada',inicio:new Date(2026,8,1),parcelas:1})],transacoes:[transacao({recorrenciaId:'r1'})]})).toEqual([]);
  });
  it('não confunde um lançamento de outro mês com a ocorrência atual',()=>{
    expect(gerarLembretes({...base(),recorrencias:[recorrencia()],transacoes:[transacao({recorrenciaId:'r1',data:new Date(2026,8,21)})]})).toHaveLength(1);
  });
  it('alcança o mês seguinte na janela de três dias e respeita fevereiro',()=>{
    const lista=gerarLembretes({...base(),referencia:new Date(2026,1,27),recorrencias:[recorrencia({diaDoMes:31,inicio:new Date(2026,0,1)}),recorrencia({id:'r2',diaDoMes:1,inicio:new Date(2026,0,1)})]});
    expect(lista.some(l=>l.data.getMonth()===1&&l.data.getDate()===28)).toBe(true);
    expect(lista.some(l=>l.data.getMonth()===2&&l.data.getDate()===1)).toBe(true);
  });
  it('mantém dívidas antigas com saldo; ignora quitadas, sem vencimento e futuras',()=>{
    const lista=gerarLembretes({...base(),dividas:[divida({valorPago:40,dataVencimento:new Date(2025,1,1)}),divida({id:'quitada',valorPago:100}),divida({id:'sem',dataVencimento:null}),divida({id:'futura',dataVencimento:new Date(2026,9,25)})]});
    expect(lista).toHaveLength(1);expect(lista[0].descricao).toContain('60,00');
  });
  it('considera o dia inteiro no limite de três dias, sem atraso falso no dia atual',()=>{
    const lista=gerarLembretes({...base(),dividas:[divida({dataVencimento:new Date(2026,9,24,23,59)}),divida({id:'hoje',dataVencimento:new Date(2026,9,21,0,1)})]});
    expect(lista.map(l=>l.titulo)).toEqual(['Dívida vence em breve: Cartão','Dívida vence hoje: Cartão']);
  });
  it('avisa em 80%, 100% e acima do limite, sem contar receitas ou outros meses',()=>{
    const estado={...base(),orcamento:{mes:'2026-10',limites:{Casa:100},atualizadoEm:null}};
    expect(gerarLembretes({...estado,transacoes:[transacao({valor:79.99}),transacao({valor:1000,tipo:'entrada'}),transacao({valor:1000,data:new Date(2026,8,1)})]})).toEqual([]);
    expect(gerarLembretes({...estado,transacoes:[transacao() ]})[0].titulo).toContain('em atenção');
    expect(gerarLembretes({...estado,transacoes:[transacao({valor:100})]})[0].titulo).toContain('atingido');
    expect(gerarLembretes({...estado,transacoes:[transacao({valor:101})]})[0].titulo).toContain('ultrapassado');
  });
  it('não usa orçamento do mês selecionado no histórico nem limite zero',()=>{
    expect(gerarLembretes({...base(),transacoes:[transacao({valor:1000})],orcamento:{mes:'2026-09',limites:{Casa:100},atualizadoEm:null}})).toEqual([]);
    expect(gerarLembretes({...base(),transacoes:[transacao()],orcamento:{mes:'2026-10',limites:{Casa:0},atualizadoEm:null}})).toEqual([]);
  });
  it('ids estáveis evitam duplicação e mudanças de estágio criam um novo aviso',()=>{
    const antes=gerarLembretes({...base(),recorrencias:[recorrencia({diaDoMes:22})]});
    expect(antes[0].id).toBe(gerarLembretes({...base(),recorrencias:[recorrencia({diaDoMes:22})]})[0].id);
    expect(antes[0].id).not.toBe(gerarLembretes({...base(),referencia:new Date(2026,9,22),recorrencias:[recorrencia({diaDoMes:22})]})[0].id);
  });
  it('preserva lido e dispensado, remove causas resolvidas e mantém avisos legados',()=>{
    const [automatico]=gerarLembretes({...base(),dividas:[divida()]});
    expect(combinarLembretes([automatico],[{...automatico,lido:true}])[0].lido).toBe(true);
    expect(combinarLembretes([automatico],[{...automatico,descartado:true}])).toEqual([]);
    expect(combinarLembretes([],[automatico])).toEqual([]);
    expect(combinarLembretes([],[{...automatico,id:'antigo'}])).toHaveLength(1);
  });
});
