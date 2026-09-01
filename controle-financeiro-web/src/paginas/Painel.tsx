import { useEffect, useMemo } from 'react';
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

const QUANTOS_LANCAMENTOS_RECENTES = 5;
const QUANTOS_PREVISTOS_NO_PAINEL = 5;

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

  const fatiaGuardada =
    resumo.entradas > 0 ? Math.max(0, resumo.saldo) / resumo.entradas : null;

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

  const previstosVisiveis = previstosDoMes.slice(0, QUANTOS_PREVISTOS_NO_PAINEL);
  const temMaisPrevistos = previstosDoMes.length > QUANTOS_PREVISTOS_NO_PAINEL;

  const entradasTotais = resumo.entradas + aReceber;
  const saidasTotais = resumo.saidas + aPagar;

  const notaDoSaldo = (() => {
    if (resumo.quantidade === 0 && previstosDoMes.length === 0) return 'Nenhum lançamento neste mês.';
    if (resumo.quantidade === 0) return 'Lançamentos ainda não confirmados este mês.';
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
            {resumo.quantidade === 0 && previstosDoMes.length === 0 && (
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

            {/* HERO: Saldo + Projetado — o mais importante */}
            <div className="painel-hero">
              <div className={`painel-saldo-card ${resumo.saldo >= 0 ? 'positivo' : 'negativo'}`}>
                <span className="painel-saldo-rotulo">Saldo do mês</span>
                <Dinheiro valor={resumo.saldo} cor="saldo" className="painel-saldo-valor" />
                <span className="painel-saldo-nota">{notaDoSaldo}</span>
              </div>

              {previstosDoMes.length > 0 ? (
                <div className={`painel-saldo-card ${saldoProjetado >= 0 ? 'positivo' : 'negativo'}`}>
                  <span className="painel-saldo-rotulo">Saldo projetado</span>
                  <Dinheiro valor={saldoProjetado} cor="saldo" className="painel-saldo-valor" />
                  <span className="painel-saldo-nota">
                    {formatarMoeda(aReceber)} a receber · {formatarMoeda(aPagar)} a pagar
                  </span>
                </div>
              ) : null}
            </div>

            {/* ENTRADAS / SAÍDAS */}
            <div className="grade-resumo">
              <CartaoResumo
                rotulo="Entradas"
                valor={entradasTotais}
                cor="entrada"
                corDaFaixa="var(--entrada)"
                icone="↑"
                nota={
                  entradasPorCategoria.length > 0
                    ? entradasPorCategoria[0].categoria
                    : 'Nada entrou ainda.'
                }
              />
              <CartaoResumo
                rotulo="Saídas"
                valor={saidasTotais}
                cor="saida"
                corDaFaixa="var(--saida)"
                icone="↓"
                nota={
                  saidasPorCategoria.length > 0
                    ? saidasPorCategoria[0].categoria
                    : 'Nada saiu ainda.'
                }
              />
              <CartaoResumo
                rotulo="Lançamentos"
                valor={resumo.quantidade}
                cor="saldo"
                corDaFaixa="var(--borda-forte)"
                icone="≡"
                nota={
                  resumo.quantidade > 0
                    ? `Média de ${formatarMoeda((resumo.entradas + resumo.saidas) / resumo.quantidade)}`
                    : 'Nenhum ainda.'
                }
              />
            </div>

            {/* FALTA CONFIRMAR — máx 5 itens */}
            {previstosVisiveis.length > 0 ? (
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
                  {temMaisPrevistos ? (
                    <Link className="botao-texto" to="/previsao">
                      Ver todos ({previstosDoMes.length})
                    </Link>
                  ) : (
                    <Link className="botao-texto" to="/previsao">
                      Ver previsão
                    </Link>
                  )}
                </div>
                <div className="cartao-corpo-sem-topo">
                  <ListaDePrevistos ocorrencias={previstosVisiveis} comSelecao />
                </div>
              </section>
            ) : null}

            {resumo.quantidade === 0 && previstosDoMes.length === 0 ? (
              <div className="cartao">
                <div className="cartao-corpo">
                  <EstadoVazio
                    selo="📅"
                    titulo={`Nada lançado em ${rotulo.toLowerCase()}`}
                    descricao="Registre a primeira entrada ou saída do mês e o painel se preenche na hora."
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
