import type { Divida, Orcamento, Recorrencia, Transacao } from '../tipos';
import type { Lembrete } from '../servicos/servicoLembretes';
import { chaveDoMes, inicioDoMes, mesmoMes, somarMeses } from '../utilitarios/datas';
import { ocorrenciasDoMes } from './recorrencias';
import { formatarMoeda } from '../utilitarios/formatadores';

export const PREFIXO_AUTOMATICO = 'auto-v1-';
export function gerarLembretes(dados:{referencia:Date;recorrencias:Recorrencia[];dividas:Divida[];transacoes:Transacao[];orcamento:Orcamento}):Lembrete[] {
  const {recorrencias,dividas,transacoes,orcamento}=dados;
  const hoje=new Date(dados.referencia.getFullYear(),dados.referencia.getMonth(),dados.referencia.getDate());
  const proximos=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()+3);
  const lembretes:Lembrete[]=[];
  function incluir(id:string,tipo:Lembrete['tipo'],titulo:string,descricao:string,data:Date){
    lembretes.push({id:PREFIXO_AUTOMATICO+id,tipo,titulo:titulo.slice(0,120),descricao:descricao.slice(0,500),data,lido:false,descartado:false,criadoEm:hoje});
  }
  function estagio(data:Date){
    const dia=new Date(data.getFullYear(),data.getMonth(),data.getDate());
    return dia<hoje?'atraso':dia.getTime()===hoje.getTime()?'hoje':'proximo';
  }
  const meses=[inicioDoMes(hoje)];
  if(!mesmoMes(hoje,proximos))meses.push(somarMeses(hoje,1));
  for(const mes of meses){
    const doMes=transacoes.filter(t=>mesmoMes(t.data,mes));
    for(const o of ocorrenciasDoMes(recorrencias,mes,doMes,hoje)){
      if(o.situacao==='lancada'||o.data>proximos)continue;
      const fase=estagio(o.data);
      const rotulo=fase==='atraso'?'Vencimento passado':fase==='hoje'?'Vence hoje':'Vence em breve';
      incluir(`rec-${encodeURIComponent(o.recorrenciaId)}-${chaveDoMes(mes)}-${fase}`,'recorrencia',`${rotulo}: ${o.descricao}`,`${formatarMoeda(o.valor)} · ${o.tipo==='saida'?'Despesa':'Receita'} recorrente ainda sem lançamento. Confira em Recorrências.`,o.data);
    }
  }
  for(const divida of dividas){
    const saldo=Math.round((divida.valor-divida.valorPago)*100)/100;
    const original=divida.dataVencimento;
    if(saldo<=0||!original||!Number.isFinite(original.getTime()))continue;
    const vencimento=new Date(original.getFullYear(),original.getMonth(),original.getDate());
    if(vencimento>proximos)continue;
    const fase=estagio(vencimento),dia=`${chaveDoMes(vencimento)}-${vencimento.getDate()}`;
    incluir(`div-${encodeURIComponent(divida.id)}-${dia}-${fase}`,'divida',`${fase==='atraso'?'Dívida atrasada':fase==='hoje'?'Dívida vence hoje':'Dívida vence em breve'}: ${divida.descricao}`,`Saldo pendente de ${formatarMoeda(saldo)}. Confira ou registre o pagamento em Dívidas.`,vencimento);
  }
  if(orcamento.mes===chaveDoMes(hoje)){
    const gastos=new Map<string,number>();
    for(const t of transacoes){if(t.tipo==='saida'&&mesmoMes(t.data,hoje))gastos.set(t.categoria,(gastos.get(t.categoria)||0)+Math.round(t.valor*100));}
    for(const [categoria,valor] of Object.entries(orcamento.limites)){
      const limite=Math.round(valor*100),gasto=gastos.get(categoria)||0;
      if(!Number.isFinite(limite)||limite<=0||gasto<limite*.8)continue;
      const fase=gasto>=limite?'limite':'atencao';
      incluir(`orc-${encodeURIComponent(categoria)}-${orcamento.mes}-${fase}`,'orcamento',`${gasto>limite?'Limite ultrapassado':gasto===limite?'Limite atingido':'Orçamento em atenção'}: ${categoria}`,`${formatarMoeda(gasto/100)} de ${formatarMoeda(limite/100)} utilizados (${Math.round(gasto/limite*100)}%). Confira em Planejamento.`,hoje);
    }
  }
  return lembretes;
}

// A causa é recalculada; o estado lido/dispensado é persistente e não é recriado
// a cada atualização. Avisos automáticos resolvidos saem da fila.
export function combinarLembretes(automaticos:Lembrete[],salvos:Lembrete[]):Lembrete[]{
  const estados=new Map(salvos.map(l=>[l.id,l]));
  return [
    ...salvos.filter(l=>!l.id.startsWith(PREFIXO_AUTOMATICO)),
    ...automaticos.map(l=>({...l,lido:estados.get(l.id)?.lido??false,descartado:estados.get(l.id)?.descartado??false})),
  ].filter(l=>!l.descartado).sort((a,b)=>Number(a.lido)-Number(b.lido)||a.data.getTime()-b.data.getTime()||a.id.localeCompare(b.id));
}
