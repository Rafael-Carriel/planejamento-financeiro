import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { ListaDeLancamentos } from '../componentes/ListaDeLancamentos';
import { ListaDePrevistos } from '../componentes/ListaDePrevistos';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import { previsaoDosMeses } from '../dominio/recorrencias';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { lerTransacoes } from '../servicos/servicoTransacoes';
import type { Transacao } from '../tipos';
import {
  chaveDoMes,
  deChaveDoMes,
  inicioDoProximoMes,
  proximosMeses,
  rotuloDoMes,
  rotuloDoMesCurto,
} from '../utilitarios/datas';
import { formatarMoeda } from '../utilitarios/formatadores';

/// Previsão: os próximos meses antes de eles chegarem.
///
/// Junta duas coisas na mesma linha do tempo: o que já foi lançado nos meses
/// (inclusive lançamentos futuros digitados à mão) e o que as recorrências
/// prometem. Como o histórico, faz uma leitura única do período — assinar doze
/// meses ao vivo custaria leituras sem necessidade numa tela de consulta.
///
/// A coluna que importa é a do **acumulado**: saldo positivo num mês não salva
/// quem entra no mês seguinte com o buraco do anterior nas costas.

const PERIODOS = [3, 6, 12] as const;
type Periodo = (typeof PERIODOS)[number];

export function Previsao() {
  const { usuario } = useAutenticacao();
  const { mes, chave, definirMes } = useMes();
  const { recorrencias } = useDados();
  const uid = usuario?.uid ?? null;

  const [quantidade, definirQuantidade] = useState<Periodo>(6);
  const [transacoes, definirTransacoes] = useState<Transacao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [atualizando, definirAtualizando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  // Impede que uma resposta antiga sobrescreva um período escolhido enquanto
  // outra leitura ainda estava em andamento.
  const ultimaLeitura = useRef(0);

  const meses = useMemo(() => proximosMeses(mes, quantidade), [mes, quantidade]);

  useEffect(() => {
    if (!uid) {
      definirTransacoes([]);
      definirCarregando(false);
      return;
    }

    const primeiro = meses[0];
    const ultimo = meses[meses.length - 1];
    if (!primeiro || !ultimo) return;

    const leitura = ++ultimaLeitura.current;
    definirCarregando(true);
    definirAtualizando(false);
    definirErro(null);

    lerTransacoes(uid, primeiro, inicioDoProximoMes(ultimo))
      .then((recebidas) => {
        if (leitura !== ultimaLeitura.current) return;
        definirTransacoes(recebidas);
        definirCarregando(false);
      })
      .catch((falha: unknown) => {
        if (leitura !== ultimaLeitura.current) return;
        console.error('Falha ao ler a previsão.', falha);
        definirErro(mensagemDeErro(falha));
        definirCarregando(false);
      });

    return () => {
      ultimaLeitura.current += 1;
    };
  }, [uid, meses]);

  // Depois de confirmar uma previsão, mantém toda a tela montada e atualiza
  // somente os dados. Assim os cartões, o gráfico e a posição da rolagem não
  // desaparecem enquanto a consulta alcança a escrita recém-feita.
  const atualizarPrevisao = useCallback(async () => {
    if (!uid) return;

    const primeiro = meses[0];
    const ultimo = meses[meses.length - 1];
    if (!primeiro || !ultimo) return;

    const leitura = ++ultimaLeitura.current;
    definirAtualizando(true);
    definirErro(null);

    try {
      const recebidas = await lerTransacoes(
        uid,
        primeiro,
        inicioDoProximoMes(ultimo),
      );
      if (leitura !== ultimaLeitura.current) return;
      definirTransacoes(recebidas);
    } catch (falha) {
      if (leitura !== ultimaLeitura.current) return;
      console.error('Falha ao atualizar a previsão.', falha);
      definirErro(mensagemDeErro(falha));
    } finally {
      if (leitura === ultimaLeitura.current) definirAtualizando(false);
    }
  }, [uid, meses]);

  const previsao = useMemo(
    () => previsaoDosMeses(recorrencias, meses, transacoes),
    [recorrencias, meses, transacoes],
  );

  const totais = useMemo(
    () =>
      previsao.reduce(
        (soma, mesPrevisto) => ({
          entradas: soma.entradas + mesPrevisto.entradas,
          saidas: soma.saidas + mesPrevisto.saidas,
          previstas: soma.previstas + mesPrevisto.saidasPrevistas,
          aReceber: soma.aReceber + mesPrevisto.entradasPrevistas,
        }),
        { entradas: 0, saidas: 0, previstas: 0, aReceber: 0 },
      ),
    [previsao],
  );

  const ultimoMes = previsao[previsao.length - 1] ?? null;
  const acumuladoFinal = ultimoMes?.acumulado ?? 0;

  const maiorBarra = previsao.reduce(
    (topo, mesPrevisto) => Math.max(topo, mesPrevisto.entradas, mesPrevisto.saidas),
    0,
  );

  function altura(valor: number): string {
    if (valor <= 0 || maiorBarra <= 0) return '2px';
    return `${Math.max(2, (valor / maiorBarra) * 100)}%`;
  }

  const comMovimento = previsao.filter(
    (mesPrevisto) =>
      mesPrevisto.entradasLancadas > 0 ||
      mesPrevisto.saidasLancadas > 0 ||
      mesPrevisto.ocorrencias.length > 0,
  );
  const primeiroNegativo = previsao.find((mesPrevisto) => mesPrevisto.acumulado < 0) ?? null;

  return (
    <>
      <CabecalhoDaPagina
        titulo="Previsão"
        descricao={`${quantidade} meses a partir de ${rotuloDoMes(mes).toLowerCase()}`}
        acoes={
          <>
            <select
              className="selecao"
              value={String(quantidade)}
              onChange={(evento) =>
                definirQuantidade(Number.parseInt(evento.target.value, 10) as Periodo)
              }
              aria-label="Período da previsão"
            >
              {PERIODOS.map((opcao) => (
                <option key={opcao} value={String(opcao)}>
                  {opcao} meses
                </option>
              ))}
            </select>
            <Link className="botao botao-contorno" to="/recorrencias">
              Recorrências
            </Link>
          </>
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem={`Montando os próximos ${quantidade} meses…`} />
        ) : recorrencias.length === 0 && transacoes.length === 0 ? (
          <div className="cartao">
            <div className="cartao-corpo">
              <EstadoVazio
                selo="◔"
                titulo="Nada para prever ainda"
                descricao="A previsão nasce das recorrências: cadastre o salário e as contas fixas e os próximos meses aparecem aqui, mês por mês."
                acao={
                  <Link className="botao botao-principal" to="/recorrencias">
                    Cadastrar recorrências
                  </Link>
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Vai entrar"
                valor={totais.entradas}
                cor="entrada"
                corDaFaixa="var(--entrada)"
                nota={
                  totais.aReceber > 0
                    ? `${formatarMoeda(totais.aReceber)} ainda não recebidos.`
                    : 'Tudo já lançado.'
                }
              />
              <CartaoResumo
                rotulo="Vai sair"
                valor={totais.saidas}
                cor="saida"
                corDaFaixa="var(--saida)"
                nota={
                  totais.previstas > 0
                    ? `${formatarMoeda(totais.previstas)} ainda não pagos.`
                    : 'Tudo já lançado.'
                }
              />
              <CartaoResumo
                rotulo="Sobra no período"
                valor={totais.entradas - totais.saidas}
                cor="saldo"
                corDaFaixa={
                  totais.entradas - totais.saidas < 0 ? 'var(--saida)' : 'var(--destaque)'
                }
                nota={`Somando os ${quantidade} meses.`}
              />
              <CartaoResumo
                rotulo={
                  ultimoMes ? `Acumulado até ${rotuloDoMesCurto(ultimoMes.inicio)}` : 'Acumulado'
                }
                valor={acumuladoFinal}
                cor="saldo"
                corDaFaixa={acumuladoFinal < 0 ? 'var(--saida)' : 'var(--entrada)'}
                nota={
                  primeiroNegativo
                    ? `Fica negativo já em ${rotuloDoMes(primeiroNegativo.inicio).toLowerCase()}.`
                    : 'O acumulado não fica negativo em nenhum mês.'
                }
              />
            </div>

            <div className="cartao">
              <div className="cartao-corpo">
                <p className="texto-apoio" style={{ margin: 0 }}>
                  A previsão soma o que já foi lançado com o que as recorrências prometem — sem
                  contar duas vezes: quando você confirma uma ocorrência, ela sai do previsto e
                  entra no lançado. Nada é gravado no banco por antecipação.
                </p>
              </div>
            </div>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Entradas e saídas previstas</h2>
                <span className="texto-miudo">maior barra: {formatarMoeda(maiorBarra)}</span>
              </div>
              <div className="cartao-corpo">
                <div className="grafico-meses">
                  {previsao.map((mesPrevisto) => (
                    <div
                      key={mesPrevisto.chave}
                      className={
                        mesPrevisto.chave === chave ? 'coluna-mes coluna-mes-atual' : 'coluna-mes'
                      }
                      title={`${rotuloDoMes(mesPrevisto.inicio)} · entradas ${formatarMoeda(mesPrevisto.entradas)} · saídas ${formatarMoeda(mesPrevisto.saidas)} · acumulado ${formatarMoeda(mesPrevisto.acumulado)}`}
                    >
                      <div className="coluna-par">
                        <div
                          className="coluna-barra coluna-barra-entrada"
                          style={{ height: altura(mesPrevisto.entradas) }}
                        />
                        <div
                          className="coluna-barra coluna-barra-saida"
                          style={{ height: altura(mesPrevisto.saidas) }}
                        />
                      </div>
                      <span className="coluna-rotulo">
                        {rotuloDoMesCurto(mesPrevisto.inicio)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="legenda" style={{ marginTop: 14 }}>
                  <span className="legenda-item">
                    <span className="legenda-marca" style={{ background: 'var(--entrada)' }} />
                    Entradas
                  </span>
                  <span className="legenda-item">
                    <span className="legenda-marca" style={{ background: 'var(--saida)' }} />
                    Saídas
                  </span>
                  <span className="legenda-item">
                    Clique numa linha da tabela para abrir o mês nas outras telas.
                  </span>
                </div>
              </div>
            </section>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Mês a mês</h2>
                <span className="texto-miudo">o acumulado carrega o mês anterior</span>
              </div>
              <div className="cartao-corpo-sem-topo" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="tabela tabela-clicavel">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Entradas</th>
                      <th>Saídas</th>
                      <th>Saldo do mês</th>
                      <th>Acumulado</th>
                      <th>Confirmação manual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previsao.map((mesPrevisto) => {
                      const aConfirmar = mesPrevisto.ocorrencias.filter(
                        (ocorrencia) =>
                          ocorrencia.situacao !== 'lancada' &&
                          ocorrencia.modoLancamento === 'confirmar',
                      ).length;

                      return (
                        <tr
                          key={mesPrevisto.chave}
                          className={mesPrevisto.chave === chave ? 'linha-destacada' : undefined}
                          onClick={() => definirMes(deChaveDoMes(mesPrevisto.chave))}
                          onKeyDown={(evento) => {
                            if (evento.key !== 'Enter' && evento.key !== ' ') return;
                            evento.preventDefault();
                            definirMes(deChaveDoMes(mesPrevisto.chave));
                          }}
                          tabIndex={0}
                          aria-label={`Abrir ${rotuloDoMes(mesPrevisto.inicio)} nas outras telas`}
                          title="Abrir este mês nas outras telas"
                        >
                          <td>{rotuloDoMes(mesPrevisto.inicio)}</td>
                          <td>
                            <Dinheiro valor={mesPrevisto.entradas} cor="entrada" />
                          </td>
                          <td>
                            <Dinheiro valor={mesPrevisto.saidas} cor="saida" />
                          </td>
                          <td>
                            <Dinheiro valor={mesPrevisto.saldo} cor="saldo" comSinal />
                          </td>
                          <td>
                            <Dinheiro valor={mesPrevisto.acumulado} cor="saldo" comSinal />
                          </td>
                          <td className="dinheiro dinheiro-neutro">{aConfirmar}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {comMovimento.length === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="◔"
                    titulo="Nenhum lançamento ou recorrência estes meses"
                    descricao="Cadastre lançamentos avulsos ou recorrências para ver os detalhes aqui."
                    acao={
                      <Link className="botao botao-principal" to="/recorrencias">
                        Cadastrar recorrências
                      </Link>
                    }
                  />
                </div>
              </div>
            ) : (
              comMovimento.map((mesPrevisto) => {
                const transacoesDoMes = transacoes.filter(
                  (t) => chaveDoMes(t.data) === mesPrevisto.chave,
                );
                const temLancamentos = transacoesDoMes.length > 0;
                const temOcorrencias = mesPrevisto.ocorrencias.length > 0;

                return (
                  <section className="cartao" key={mesPrevisto.chave}>
                    <div className="cartao-cabeca">
                      <h2>{rotuloDoMes(mesPrevisto.inicio)}</h2>
                      <span className="texto-miudo">
                        saldo previsto <Dinheiro valor={mesPrevisto.saldo} cor="saldo" comSinal />
                      </span>
                    </div>
                    <div className="cartao-corpo-sem-topo">
                      {temLancamentos ? (
                        <ListaDeLancamentos
                          transacoes={transacoesDoMes}
                          comDataNaLinha
                          semAcoes
                        />
                      ) : null}
                      {temOcorrencias ? (
                        <ListaDePrevistos
                          ocorrencias={mesPrevisto.ocorrencias}
                          comSelecao
                          aoLancar={atualizarPrevisao}
                        />
                      ) : null}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
      <span className="somente-leitor-de-tela" role="status" aria-live="polite">
        {atualizando ? 'Atualizando a previsão…' : ''}
      </span>
    </>
  );
}
