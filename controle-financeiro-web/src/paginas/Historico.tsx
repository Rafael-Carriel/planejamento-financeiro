import { useEffect, useMemo, useState } from 'react';

import { BarrasDeCategoria } from '../componentes/BarrasDeCategoria';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useMes } from '../contextos/ContextoMes';
import { mediaMensal, resumosPorMes, totaisPorCategoria } from '../dominio/calculos';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { lerTransacoes } from '../servicos/servicoTransacoes';
import type { ResumoDeMes, Transacao } from '../tipos';
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

/// Histórico: como os meses se comparam.
///
/// Esta é a única tela que lê fora do mês selecionado, e por isso faz uma
/// consulta própria — uma leitura só, sem assinatura ao vivo. Manter um
/// observador de doze meses aberto o tempo todo custaria caro em leituras para
/// uma tela que se consulta de vez em quando.

const PERIODOS = [6, 12, 24] as const;
type Periodo = (typeof PERIODOS)[number];

export function Historico() {
  const { usuario } = useAutenticacao();
  const { mes, chave, definirMes } = useMes();
  const uid = usuario?.uid ?? null;

  const [quantidade, definirQuantidade] = useState<Periodo>(12);
  const [transacoes, definirTransacoes] = useState<Transacao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);

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

    // Trocar de mês ou de período dispara outra leitura; a bandeira evita que a
    // resposta antiga chegue depois e sobrescreva a nova.
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
                  <span className="legenda-item">Clique numa linha da tabela para abrir o mês.</span>
                </div>
              </div>
            </section>

            <section className="cartao">
              <div className="cartao-cabeca">
                <h2>Mês a mês</h2>
                <span className="texto-miudo">do mais recente para o mais antigo</span>
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
                    {[...resumos].reverse().map((resumo) => (
                      <tr
                        key={resumo.chave}
                        className={resumo.chave === chave ? 'linha-destacada' : undefined}
                        onClick={() => definirMes(deChaveDoMes(resumo.chave))}
                        onKeyDown={(evento) => {
                          if (evento.key !== 'Enter' && evento.key !== ' ') return;
                          evento.preventDefault();
                          definirMes(deChaveDoMes(resumo.chave));
                        }}
                        tabIndex={0}
                        aria-label={`Abrir ${rotuloDoMes(resumo.inicio)} nas outras telas`}
                        title="Abrir este mês nas outras telas"
                      >
                        <td>{rotuloDoMes(resumo.inicio)}</td>
                        <td>
                          <Dinheiro valor={resumo.entradas} cor="entrada" />
                        </td>
                        <td>
                          <Dinheiro valor={resumo.saidas} cor="saida" />
                        </td>
                        <td>
                          <Dinheiro valor={resumo.saldo} cor="saldo" comSinal />
                        </td>
                        <td className="dinheiro dinheiro-neutro">{resumo.quantidade}</td>
                      </tr>
                    ))}
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
