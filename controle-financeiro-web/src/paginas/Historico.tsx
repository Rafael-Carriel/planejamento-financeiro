import { Fragment, useEffect, useMemo, useState } from 'react';

import { BarrasDeCategoria } from '../componentes/BarrasDeCategoria';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { ListaDeLancamentos } from '../componentes/ListaDeLancamentos';
import { ListaDePrevistos } from '../componentes/ListaDePrevistos';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import { mediaMensal, resumosPorMes, totaisPorCategoria } from '../dominio/calculos';
import { ocorrenciasDoMes } from '../dominio/recorrencias';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { lerTransacoes } from '../servicos/servicoTransacoes';
import type { OcorrenciaPrevista, ResumoDeMes, Transacao } from '../tipos';
import { baixarCsv, transacoesParaCsv } from '../utilitarios/csv';
import {
  chaveDoMes,
  deChaveDoMes,
  inicioDoProximoMes,
  rotuloDoMes,
  rotuloDoMesCurto,
  ultimosMeses,
} from '../utilitarios/datas';
import { formatarMoeda, formatarPorcentagem } from '../utilitarios/formatadores';

const PERIODOS = [6, 12, 24] as const;
type Periodo = (typeof PERIODOS)[number];

export function Historico() {
  const { usuario } = useAutenticacao();
  const { mes, chave, definirMes } = useMes();
  const { recorrencias } = useDados();
  const uid = usuario?.uid ?? null;

  const [quantidade, definirQuantidade] = useState<Periodo>(12);
  const [transacoes, definirTransacoes] = useState<Transacao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [expandida, definirExpandida] = useState<string | null>(null);

  const meses = useMemo(() => ultimosMeses(mes, quantidade), [mes, quantidade]);

  useEffect(() => {
    if (!uid) return;

    const inicio = meses[0];
    const fim = inicioDoProximoMes(meses[meses.length - 1]);

    let vivo = true;
    definirCarregando(true);
    definirErro(null);

    lerTransacoes(uid, inicio, fim)
      .then((recebidas) => {
        if (!vivo) return;
        definirTransacoes(recebidas);
        definirCarregando(false);
      })
      .catch((falha: unknown) => {
        if (!vivo) return;
        console.error('Falha ao ler o histórico.', falha);
        definirErro(mensagemDeErro(falha));
        definirCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, [uid, meses]);

  const resumos = useMemo(() => resumosPorMes(transacoes, meses), [transacoes, meses]);
  const media = useMemo(() => mediaMensal(resumos), [resumos]);
  const saidasPorCategoria = useMemo(() => totaisPorCategoria(transacoes, 'saida'), [transacoes]);

  const acumulado = useMemo(
    () =>
      resumos.reduce(
        (soma, resumo) => ({
          entradas: soma.entradas + resumo.entradas,
          saidas: soma.saidas + resumo.saidas,
        }),
        { entradas: 0, saidas: 0 },
      ),
    [resumos],
  );

  const comMovimento = resumos.filter((resumo) => resumo.quantidade > 0);
  const melhor = comMovimento.reduce<ResumoDeMes | null>(
    (topo, resumo) => (!topo || resumo.saldo > topo.saldo ? resumo : topo),
    null,
  );
  const pior = comMovimento.reduce<ResumoDeMes | null>(
    (fundo, resumo) => (!fundo || resumo.saldo < fundo.saldo ? resumo : fundo),
    null,
  );

  const maiorBarra = resumos.reduce(
    (topo, resumo) => Math.max(topo, resumo.entradas, resumo.saidas),
    0,
  );

  function altura(valor: number): string {
    if (valor <= 0 || maiorBarra <= 0) return '2px';
    return `${Math.max(2, (valor / maiorBarra) * 100)}%`;
  }

  function exportar() {
    baixarCsv(
      `historico-${chaveDoMes(meses[0])}-a-${chaveDoMes(mes)}.csv`,
      transacoesParaCsv(transacoes),
    );
  }

  const chaveHoje = chaveDoMes(new Date());

  function alternarExpansao(chaveMes: string) {
    definirExpandida((atual) => (atual === chaveMes ? null : chaveMes));
  }

  function conteudoExpansao(resumo: ResumoDeMes) {
    const transacoesDoMes = transacoes.filter((t) => chaveDoMes(t.data) === resumo.chave);
    const ehFuturo = resumo.chave > chaveHoje;

    if (ehFuturo) {
      const mesData = deChaveDoMes(resumo.chave);
      const ocorrencias: OcorrenciaPrevista[] = ocorrenciasDoMes(
        recorrencias,
        mesData,
        transacoesDoMes,
      );
      const temAlgo = transacoesDoMes.length > 0 || ocorrencias.length > 0;

      if (!temAlgo) {
        return (
          <p style={{ padding: '14px 18px', color: 'var(--tinta-fraca)', fontSize: '0.85rem' }}>
            Nenhuma previsão ou lançamento para este mês.
          </p>
        );
      }

      return (
        <>
          {transacoesDoMes.length > 0 ? (
            <ListaDeLancamentos transacoes={transacoesDoMes} comDataNaLinha />
          ) : null}
          {ocorrencias.length > 0 ? (
            <ListaDePrevistos ocorrencias={ocorrencias} semAcoes comMes />
          ) : null}
        </>
      );
    }

    if (transacoesDoMes.length === 0) {
      return (
        <p style={{ padding: '14px 18px', color: 'var(--tinta-fraca)', fontSize: '0.85rem' }}>
          Nenhum lançamento registrado neste mês.
        </p>
      );
    }

    return <ListaDeLancamentos transacoes={transacoesDoMes} comDataNaLinha />;
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Histórico"
        descricao={`${quantidade} meses até ${rotuloDoMes(mes).toLowerCase()}`}
        acoes={
          <>
            <select
              className="selecao"
              value={String(quantidade)}
              onChange={(evento) =>
                definirQuantidade(Number.parseInt(evento.target.value, 10) as Periodo)
              }
              aria-label="Período"
            >
              {PERIODOS.map((opcao) => (
                <option key={opcao} value={String(opcao)}>
                  {opcao} meses
                </option>
              ))}
            </select>
            <button
              type="button"
              className="botao botao-contorno"
              onClick={exportar}
              disabled={carregando || transacoes.length === 0}
            >
              Baixar CSV
            </button>
          </>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem={`Lendo ${quantidade} meses…`} />
        ) : transacoes.length === 0 ? (
          <div className="cartao">
            <div className="cartao-corpo">
              <EstadoVazio
                selo="≡"
                titulo="Nenhum lançamento no período"
                descricao="Assim que houver movimento nos meses escolhidos, a comparação entre eles aparece aqui."
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Média de entradas"
                valor={media.entradas}
                cor="entrada"
                corDaFaixa="var(--entrada)"
                nota={`Considerando os ${media.quantidade} meses com movimento.`}
              />
              <CartaoResumo
                rotulo="Média de saídas"
                valor={media.saidas}
                cor="saida"
                corDaFaixa="var(--saida)"
                nota={
                  media.entradas > 0
                    ? `${formatarPorcentagem(media.saidas / media.entradas)} do que entra, em média.`
                    : 'Sem entradas no período.'
                }
              />
              <CartaoResumo
                rotulo="Média do saldo"
                valor={media.saldo}
                cor="saldo"
                corDaFaixa={media.saldo < 0 ? 'var(--saida)' : 'var(--destaque)'}
                nota={
                  melhor
                    ? `Melhor mês: ${rotuloDoMes(melhor.inicio)} (${formatarMoeda(melhor.saldo)}).`
                    : undefined
                }
              />
              <CartaoResumo
                rotulo="Saldo acumulado"
                valor={acumulado.entradas - acumulado.saidas}
                cor="saldo"
                corDaFaixa={
                  acumulado.entradas - acumulado.saidas < 0 ? 'var(--saida)' : 'var(--entrada)'
                }
                nota={
                  pior
                    ? `Mês mais apertado: ${rotuloDoMes(pior.inicio)} (${formatarMoeda(pior.saldo)}).`
                    : undefined
                }
              />
            </div>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Entradas e saídas por mês</h2>
                <span className="texto-miudo">maior barra: {formatarMoeda(maiorBarra)}</span>
              </div>
              <div className="cartao-corpo">
                <div className="grafico-meses">
                  {resumos.map((resumo) => (
                    <div
                      key={resumo.chave}
                      className={
                        resumo.chave === chave ? 'coluna-mes coluna-mes-atual' : 'coluna-mes'
                      }
                      title={`${rotuloDoMes(resumo.inicio)} · entradas ${formatarMoeda(resumo.entradas)} · saídas ${formatarMoeda(resumo.saidas)}`}
                    >
                      <div className="coluna-par">
                        <div
                          className="coluna-barra coluna-barra-entrada"
                          style={{ height: altura(resumo.entradas) }}
                        />
                        <div
                          className="coluna-barra coluna-barra-saida"
                          style={{ height: altura(resumo.saidas) }}
                        />
                      </div>
                      <span className="coluna-rotulo">{rotuloDoMesCurto(resumo.inicio)}</span>
                    </div>
                  ))}
                </div>

                <div className="legenda" style={{ marginTop: 14 }}>
                  <span className="legenda-item">
                    <span
                      className="legenda-marca"
                      style={{ background: 'var(--entrada)' }}
                    />
                    Entradas
                  </span>
                  <span className="legenda-item">
                    <span className="legenda-marca" style={{ background: 'var(--saida)' }} />
                    Saídas
                  </span>
                  <span className="legenda-item">Clique numa linha da tabela para ver os detalhes.</span>
                </div>
              </div>
            </section>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Mês a mês</h2>
                <span className="texto-miudo">clique para expandir</span>
              </div>
              <div className="cartao-corpo-sem-topo" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="tabela tabela-clicavel">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Entradas</th>
                      <th>Saídas</th>
                      <th>Saldo</th>
                      <th>Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...resumos].reverse().map((resumo) => {
                      const estaExpandida = expandida === resumo.chave;
                      const ehFuturo = resumo.chave > chaveHoje;

                      return (
                        <Fragment key={resumo.chave}>
                          <tr
                            className={
                              resumo.chave === chave
                                ? 'linha-destacada'
                                : undefined
                            }
                            onClick={() => alternarExpansao(resumo.chave)}
                            onKeyDown={(evento) => {
                              if (evento.key !== 'Enter' && evento.key !== ' ') return;
                              evento.preventDefault();
                              alternarExpansao(resumo.chave);
                            }}
                            tabIndex={0}
                            aria-expanded={estaExpandida}
                            title={
                              estaExpandida
                                ? 'Fechar detalhes'
                                : 'Ver entradas e saídas deste mês'
                            }
                          >
                            <td>
                              {rotuloDoMes(resumo.inicio)}
                              {ehFuturo ? (
                                <span
                                  className="selo-situacao selo-sem-limite"
                                  style={{ marginLeft: 8, fontSize: '0.65rem' }}
                                >
                                  previsão
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <Dinheiro valor={resumo.entradas} cor="entrada" />
                            </td>
                            <td>
                              <Dinheiro valor={resumo.saidas} cor="saida" />
                            </td>
                            <td>
                              <Dinheiro valor={resumo.saldo} cor="saldo" comSinal />
                            </td>
                            <td className="dinheiro dinheiro-neutro">
                              {resumo.quantidade}
                            </td>
                          </tr>
                          {estaExpandida ? (
                            <tr>
                              <td
                                colSpan={5}
                                style={{
                                  padding: 0,
                                  background: 'var(--cartao)',
                                  borderBottom: '2px solid var(--borda-forte)',
                                }}
                              >
                                <div style={{ padding: '4px 18px 12px' }}>
                                  {conteudoExpansao(resumo)}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Gastos do período por categoria</h2>
                <span className="texto-miudo">{quantidade} meses somados</span>
              </div>
              <div className="cartao-corpo">
                <BarrasDeCategoria
                  totais={saidasPorCategoria}
                  cor="saida"
                  quantidadeMaxima={10}
                  tituloVazio="Nenhuma saída no período"
                  descricaoVazia="Os meses escolhidos não têm despesas lançadas."
                />
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
