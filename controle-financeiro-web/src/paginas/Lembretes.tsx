import { useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { formatarData } from '../utilitarios/formatadores';
import { useLembretes } from '../contextos/ContextoLembretes';
import type { Lembrete, TipoLembrete } from '../servicos/servicoLembretes';
import { Link } from 'react-router-dom';

/// Fila de avisos do usuário: contas que venceu, dívidas atrasadas, orçamento
/// estourado. Não mexe no dinheiro — só chama atenção para o que precisa dela.

/// Como cada tipo de lembrete aparece na lista: rótulo, selo e ícone.
/// O selo segue as cores dos demais estados do app: vermelho para dívida,
/// âmbar para orçamento, neutro para recorrência, verde para sistema.
const APARENCIA_POR_TIPO: Record<
  TipoLembrete,
  { rotulo: string; classeDoSelo: string; icone: string }
> = {
  recorrencia: { rotulo: 'Recorrência', classeDoSelo: 'selo-situacao selo-sem-limite', icone: '🔁' },
  divida: { rotulo: 'Dívida', classeDoSelo: 'selo-situacao selo-estourado', icone: '💳' },
  orcamento: { rotulo: 'Orçamento', classeDoSelo: 'selo-situacao selo-atencao', icone: '◎' },
  sistema: { rotulo: 'Sistema', classeDoSelo: 'selo-situacao selo-tranquilo', icone: '⚙️' },
};

export function Lembretes() {
  const {lembretes,naoLidos,carregando,erro:erroDeDados,marcar:marcarLido,dispensar}=useLembretes();
  const [erro,definirErro]=useState<string|null>(null);
  const [processando,definirProcessando]=useState<string|null>(null);
  async function agir(lembrete:Lembrete,descartar:boolean){
    if(processando)return;definirProcessando(lembrete.id);definirErro(null);
    try{await (descartar?dispensar(lembrete):marcarLido(lembrete));}
    catch{definirErro('Não foi possível atualizar o lembrete. Tente novamente.');}
    finally{definirProcessando(null);}
  }
  return (
    <>
      <CabecalhoDaPagina
        titulo="Lembretes"
        descricao="Avisos sobre contas, dívidas e orçamento"
        comSeletorDeMes={false}
      />

      <div className="pagina">
        {(erro||erroDeDados) ? <FaixaDeErro mensagem={erro||erroDeDados||''} /> : null}
        <p className="texto-apoio">Avisos dentro do Planeora, atualizados ao abrir o sistema e enquanto ele estiver em uso. Contas recorrentes do mês atual e dos próximos 3 dias; dívidas com saldo pendente e orçamento do mês atual. Não enviamos notificações fora do aplicativo.</p>

        {carregando ? (
          <Carregando mensagem="Carregando seus lembretes…" />
        ) : lembretes.length === 0 && !erroDeDados ? (
          <div className="cartao">
            <div className="cartao-corpo">
              <EstadoVazio
                selo="🔔"
                titulo="Nenhum lembrete por aqui"
                descricao="Quando algo precisar da sua atenção — conta que vence, dívida atrasada, orçamento estourado — o aviso aparece nesta lista e o sino na barra superior acusa a chegada."
              />
            </div>
          </div>
        ) : (
          <section className="cartao">
            <div className="cartao-cabeca">
              <h2>Seus lembretes</h2>
              <span className="texto-miudo">
                {naoLidos === 0
                  ? `${lembretes.length} ${lembretes.length === 1 ? 'lembrete' : 'lembretes'}, todos lidos`
                  : `${naoLidos} não ${naoLidos === 1 ? 'lido' : 'lidos'} de ${lembretes.length}`}
              </span>
            </div>

            <ul className="lista-lancamentos lista-lembretes">
              {lembretes.map((lembrete) => {
                const aparencia = APARENCIA_POR_TIPO[lembrete.tipo];
                const ocupado = processando === lembrete.id;

                return (
                  <li
                    className={[
                      'lancamento',
                      // Lido perde força visual: o que pede atenção é o que
                      // ainda não foi visto.
                      lembrete.lido ? 'lancamento-apagado' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={lembrete.id}
                  >
                    <span className="lancamento-selo" aria-hidden="true">
                      {aparencia.icone}
                    </span>

                    <div className="lancamento-textos">
                      <div className="lancamento-descricao">{lembrete.titulo}</div>
                      <div className="lancamento-meta">
                        <span>{formatarData(lembrete.data)}</span>{lembrete.lido&&<span className="selo-situacao selo-sem-limite">Lido</span>}
                        {lembrete.descricao ? (
                          <span>· {lembrete.descricao}</span>
                        ) : null}
                        <span className={aparencia.classeDoSelo}>
                          {aparencia.rotulo}
                        </span>
                      </div>
                    </div>

                    <div className="lancamento-acoes lembrete-acoes">
                      <Link className="botao-texto" to={lembrete.tipo==='recorrencia'?'/recorrencias':lembrete.tipo==='divida'?'/dividas':lembrete.tipo==='orcamento'?'/planejamento':'/'}>Ver detalhes</Link>
                      {!lembrete.lido ? (
                        <button
                          type="button"
                          className="botao-texto"
                          onClick={() => void agir(lembrete,false)}
                          disabled={processando!==null}
                        >
                          {ocupado ? 'Marcando…' : 'Marcar como lido'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="botao-texto acao-excluir-lembrete"
                        onClick={() => void agir(lembrete,true)}
                        disabled={processando!==null}
                      >
                        {ocupado ? 'Atualizando…' : 'Dispensar'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
