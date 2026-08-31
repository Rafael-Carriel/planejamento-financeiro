import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { BarrasDeCategoria } from '../componentes/BarrasDeCategoria';
import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { ListaDeLancamentos } from '../componentes/ListaDeLancamentos';
import { ListaDePrevistos } from '../componentes/ListaDePrevistos';
import { ReguaDoMes } from '../componentes/ReguaDoMes';
import { useDados } from '../contextos/ContextoDados';
import { useLancamento } from '../contextos/ContextoLancamento';
import { useMes } from '../contextos/ContextoMes';
import { linhasDePlanejamento, totaisPorCategoria } from '../dominio/calculos';
import { doTipo, somarOcorrencias } from '../dominio/recorrencias';
import { linhasEmAtencao, situacaoDoLimite } from '../dominio/situacao';
import { formatarMoeda, formatarPorcentagem } from '../utilitarios/formatadores';
import { comVariaveis } from '../utilitarios/estilo';

/// O painel: o mês inteiro numa página.
///
/// A ordem das seções é a ordem das perguntas que se faz ao abrir o app: quanto
/// sobrou, quando o dinheiro se mexeu, para onde foi, e o que está estourando.

const QUANTOS_LANCAMENTOS_RECENTES = 8;

export function Painel() {
  const { mes, rotulo, ehMesAtual } = useMes();
  const { transacoes, resumo, carregando, erro, orcamento, previstosDoMes } = useDados();
  const { abrirNovo } = useLancamento();

  const saidasPorCategoria = useMemo(() => totaisPorCategoria(transacoes, 'saida'), [transacoes]);
  const entradasPorCategoria = useMemo(
    () => totaisPorCategoria(transacoes, 'entrada'),
    [transacoes],
  );

  const atencao = useMemo(
    () => linhasEmAtencao(linhasDePlanejamento(transacoes, orcamento.limites)),
    [transacoes, orcamento.limites],
  );

  const recentes = useMemo(
    () => transacoes.slice(0, QUANTOS_LANCAMENTOS_RECENTES),
    [transacoes],
  );

  // Quanto das entradas sobrou. Sem entradas no mês a conta não tem sentido, e
  // mostrar "0%" aí só confundiria.
  const fatiaGuardada =
    resumo.entradas > 0 ? Math.max(0, resumo.saldo) / resumo.entradas : null;

  // O que as recorrências ainda prometem para este mês. O saldo projetado é a
  // pergunta que o saldo do mês não responde: "se tudo o que está combinado
  // acontecer, eu fecho o mês no positivo?".
  const aReceber = useMemo(
    () => somarOcorrencias(doTipo(previstosDoMes, 'entrada')),
    [previstosDoMes],
  );
  const aPagar = useMemo(
    () => somarOcorrencias(doTipo(previstosDoMes, 'saida')),
    [previstosDoMes],
  );
  const saldoProjetado = resumo.saldo + aReceber - aPagar;
  const atrasados = useMemo(
    () => previstosDoMes.filter((ocorrencia) => ocorrencia.situacao === 'atrasada'),
    [previstosDoMes],
  );

  const notaDoSaldo = (() => {
    if (resumo.quantidade === 0) return 'Nenhum lançamento neste mês.';
    if (resumo.saldo < 0) return `Você gastou ${formatarMoeda(-resumo.saldo)} além do que entrou.`;
    if (fatiaGuardada !== null) {
      return `Sobrou ${formatarPorcentagem(fatiaGuardada)} do que entrou.`;
    }
    return 'Mês só com saídas.';
  })();

  const acoes = (
    <>
      <button
        type="button"
        className="botao botao-suave"
        onClick={() => abrirNovo('entrada')}
      >
        + Receita
      </button>
      <button
        type="button"
        className="botao botao-principal"
        onClick={() => abrirNovo('saida')}
      >
        + Despesa
      </button>
    </>
  );

  return (
    <>
      <CabecalhoDaPagina
        titulo="Painel"
        descricao={ehMesAtual ? `${rotulo} · mês em curso` : rotulo}
        acoes={acoes}
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Buscando os lançamentos do mês…" />
        ) : (
          <>
            {/* Tutorial do Painel */}
            {resumo.quantidade === 0 && (
              <section className="cartao">
                <div className="cartao-corpo">
                  <p className="texto-apoio" style={{ margin: 0 }}>
                    💡 <strong>Bem-vindo ao Painel!</strong> Aqui você vê tudo do mês de uma vez:
                    o que entrou, o que saiu, e o que falta confirmar. Comece clicando em
                    <strong> "+ Receita"</strong> ou <strong>"+ Despesa"</strong> para registrar seus primeiros lançamentos.
                  </p>
                </div>
              </section>
            )}

            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Entradas"
                valor={resumo.entradas}
                cor="entrada"
                corDaFaixa="var(--entrada)"
                nota={
                  entradasPorCategoria.length > 0
                    ? `Maior fonte: ${entradasPorCategoria[0].categoria}`
                    : 'Nada entrou ainda.'
                }
              />
              <CartaoResumo
                rotulo="Saídas"
                valor={resumo.saidas}
                cor="saida"
                corDaFaixa="var(--saida)"
                nota={
                  saidasPorCategoria.length > 0
                    ? `Maior gasto: ${saidasPorCategoria[0].categoria}`
                    : 'Nada saiu ainda.'
                }
              />
              <CartaoResumo
                rotulo="Saldo do mês"
                valor={resumo.saldo}
                cor="saldo"
                corDaFaixa={resumo.saldo < 0 ? 'var(--saida)' : 'var(--destaque)'}
                nota={notaDoSaldo}
              />
              {previstosDoMes.length > 0 ? (
                <CartaoResumo
                  rotulo="Saldo projetado"
                  valor={saldoProjetado}
                  cor="saldo"
                  corDaFaixa={saldoProjetado < 0 ? 'var(--saida)' : 'var(--destaque)'}
                  nota={`Contando ${formatarMoeda(aReceber)} a receber e ${formatarMoeda(aPagar)} a pagar.`}
                />
              ) : null}

              {/* Este cartão conta lançamentos, não reais — por isso não usa
                  CartaoResumo, que formata tudo como moeda. */}
              <div
                className="cartao cartao-resumo"
                style={comVariaveis({ '--cor-faixa': 'var(--borda-forte)' })}
              >
                <span className="etiqueta">Lançamentos</span>
                <span className="dinheiro dinheiro-neutro cartao-resumo-valor">
                  {resumo.quantidade}
                </span>
                <p className="cartao-resumo-nota">
                  {resumo.quantidade > 0
                    ? `Média de ${formatarMoeda((resumo.entradas + resumo.saidas) / resumo.quantidade)} por lançamento.`
                    : 'Comece lançando o que entrou e o que saiu.'}
                </p>
              </div>
            </div>

            {previstosDoMes.length > 0 ? (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>
                    Falta confirmar
                    {atrasados.length > 0 ? (
                      <span className="selo-situacao selo-estourado" style={{ marginLeft: 8 }}>
                        {atrasados.length === 1
                          ? '1 venceu'
                          : `${atrasados.length} venceram`}
                      </span>
                    ) : null}
                  </h2>
                  <Link className="botao-texto" to="/previsao">
                    Ver os próximos meses
                  </Link>
                </div>
                <div className="cartao-corpo-sem-topo">
                  <ListaDePrevistos ocorrencias={previstosDoMes} />
                </div>
              </section>
            ) : null}

            {resumo.quantidade === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="📅"
                    titulo={`Nada lançado em ${rotulo.toLowerCase()}`}
                    descricao="Registre a primeira entrada ou saída do mês e o painel se preenche na hora — a régua, as categorias e o planejamento saem daqui."
                    acao={
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="botao botao-principal"
                          onClick={() => abrirNovo('saida')}
                        >
                          Lançar despesa
                        </button>
                        <button
                          type="button"
                          className="botao botao-contorno"
                          onClick={() => abrirNovo('entrada')}
                        >
                          Lançar receita
                        </button>
                      </div>
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                <section className="cartao">
                  <div className="cartao-cabeca">
                    <h2>Movimento do mês</h2>
                    <span className="texto-miudo">dia a dia</span>
                  </div>
                  <div className="cartao-corpo">
                    <ReguaDoMes transacoes={transacoes} mes={mes} />
                  </div>
                </section>

                <div className="grade-dupla grade-dupla-desigual">
                  <section className="cartao">
                    <div className="cartao-cabeca">
                      <h2>Para onde foi</h2>
                      <Link className="botao-texto" to="/despesas">
                        Ver despesas
                      </Link>
                    </div>
                    <div className="cartao-corpo">
                      <BarrasDeCategoria
                        totais={saidasPorCategoria}
                        cor="saida"
                        quantidadeMaxima={6}
                        tituloVazio="Nenhuma despesa neste mês"
                        descricaoVazia="Quando houver saídas, elas aparecem aqui agrupadas por categoria."
                      />
                    </div>
                  </section>

                  <section className="cartao">
                    <div className="cartao-cabeca">
                      <h2>De onde veio</h2>
                      <Link className="botao-texto" to="/receitas">
                        Ver receitas
                      </Link>
                    </div>
                    <div className="cartao-corpo">
                      <BarrasDeCategoria
                        totais={entradasPorCategoria}
                        cor="entrada"
                        quantidadeMaxima={5}
                        tituloVazio="Nenhuma receita neste mês"
                        descricaoVazia="Lance o salário, um freelance ou qualquer entrada para ver a divisão."
                      />
                    </div>
                  </section>
                </div>

                {atencao.length > 0 ? (
                  <section className="cartao">
                    <div className="cartao-cabeca">
                      <h2>Limites apertando</h2>
                      <Link className="botao-texto" to="/planejamento">
                        Ajustar planejamento
                      </Link>
                    </div>
                    <div className="cartao-corpo">
                      <div className="linhas-categoria">
                        {atencao.slice(0, 4).map((linha) => {
                          const situacao = situacaoDoLimite(linha);
                          const largura = Math.min(100, linha.proporcao * 100);

                          return (
                            <div className="linha-categoria" key={linha.categoria}>
                              <div className="linha-categoria-topo">
                                <span className="linha-categoria-nome">
                                  <span>{linha.categoria}</span>
                                  <span className={situacao.classeDoSelo}>{situacao.rotulo}</span>
                                </span>
                                <span className="linha-categoria-valores">
                                  <span className="texto-miudo">
                                    {formatarPorcentagem(linha.proporcao)}
                                  </span>
                                  <Dinheiro valor={linha.gasto} cor="saida" />
                                </span>
                              </div>

                              <div className={`trilha ${situacao.classeDaTrilha}`}>
                                <div
                                  className="trilha-preenchida"
                                  style={{
                                    ...comVariaveis({ '--cor-barra': 'var(--saida)' }),
                                    width: `${largura}%`,
                                  }}
                                />
                              </div>

                              <span className="texto-miudo">
                                {linha.restante >= 0
                                  ? `Ainda cabem ${formatarMoeda(linha.restante)} do limite de ${formatarMoeda(linha.limite)}.`
                                  : `Passou ${formatarMoeda(-linha.restante)} do limite de ${formatarMoeda(linha.limite)}.`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="cartao">
                  <div className="cartao-cabeca">
                    <h2>Últimos lançamentos</h2>
                    <span className="texto-miudo">
                      {resumo.quantidade > QUANTOS_LANCAMENTOS_RECENTES
                        ? `${QUANTOS_LANCAMENTOS_RECENTES} de ${resumo.quantidade}`
                        : `${resumo.quantidade} no mês`}
                    </span>
                  </div>
                  <div className="cartao-corpo-sem-topo">
                    <ListaDeLancamentos transacoes={recentes} />
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
