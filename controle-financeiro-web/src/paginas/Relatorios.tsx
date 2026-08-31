import { useEffect, useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { CartaoResumo } from '../componentes/CartaoResumo';
import { Dinheiro } from '../componentes/Dinheiro';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import { resumosPorMes, totaisPorCategoria } from '../dominio/calculos';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import { lerTransacoes } from '../servicos/servicoTransacoes';
import type { ResumoDeMes, Transacao } from '../tipos';
import {
  inicioDoProximoMes,
  rotuloDoMes,
  ultimosMeses,
} from '../utilitarios/datas';
import { formatarMoeda, formatarPorcentagem } from '../utilitarios/formatadores';

const PERIODOS = [3, 6, 12] as const;
type Periodo = (typeof PERIODOS)[number];

interface DiaDaSemana {
  nome: string;
  total: number;
  quantidade: number;
  media: number;
}

interface CategoriaFixa {
  categoria: string;
  total: number;
  meses: number;
  media: number;
}

/// Relatórios avançados com análises que agregam valor real.
///
/// Diferente do histórico (que mostra o passado), aqui o objetivo é gerar
/// INSIGHTS: o que o usuário pode fazer para melhorar sua situação financeira.

export function Relatorios() {
  const { usuario } = useAutenticacao();
  const { mes, chave } = useMes();
  const { resumo: resumoMesAtual, orcamento } = useDados();
  const uid = usuario?.uid ?? null;

  const [quantidade, definirQuantidade] = useState<Periodo>(6);
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
        console.error('Falha ao ler relatórios.', falha);
        definirErro(mensagemDeErro(falha));
        definirCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, [uid, meses]);

  const resumos = useMemo(() => resumosPorMes(transacoes, meses), [transacoes, meses]);

  // ─── SAÚDE FINANCEIRA ──────────────────────────────────────────────
  const saudeFinanceira = useMemo(() => {
    if (resumos.length === 0) return null;

    const mesesComMovimento = resumos.filter((r) => r.quantidade > 0);
    if (mesesComMovimento.length === 0) return null;

    const totalEntradas = resumos.reduce((s, r) => s + r.entradas, 0);
    const totalSaidas = resumos.reduce((s, r) => s + r.saidas, 0);
    const mesesComEntrada = resumos.filter((r) => r.entradas > 0).length;
    const mesesComSaldoPositivo = resumos.filter((r) => r.saldo > 0).length;

    // Indicadores
    const taxaDePoupanca = totalEntradas > 0 ? (totalEntradas - totalSaidas) / totalEntradas : 0;
    const estabilidade = mesesComSaldoPositivo / mesesComMovimento.length;
    const mediaSaidas = totalSaidas / mesesComMovimento.length;
    const maiorSaida = Math.max(...resumos.map((r) => r.saidas));
    const variacao = maiorSaida > 0 ? (maiorSaida - mediaSaidas) / mediaSaidas : 0;

    // Score de 0 a 100
    let score = 50; // Base

    // Poupança (até 30 pontos)
    if (taxaDePoupanca >= 0.3) score += 30;
    else if (taxaDePoupanca >= 0.2) score += 20;
    else if (taxaDePoupanca >= 0.1) score += 10;
    else if (taxaDePoupanca < 0) score -= 20;

    // Estabilidade (até 20 pontos)
    score += Math.round(estabilidade * 20);

    // Consistência (até 20 pontos) - menos variação = melhor
    if (variacao < 0.2) score += 20;
    else if (variacao < 0.4) score += 10;
    else score -= 10;

    score = Math.max(0, Math.min(100, score));

    let classificacao: string;
    let cor: string;
    if (score >= 80) { classificacao = 'Excelente'; cor = 'var(--entrada)'; }
    else if (score >= 60) { classificacao = 'Boa'; cor = 'var(--destaque)'; }
    else if (score >= 40) { classificacao = 'Regular'; cor = 'var(--atencao)'; }
    else { classificacao = 'Atenção'; cor = 'var(--saida)'; }

    return {
      score,
      classificacao,
      cor,
      taxaDePoupanca,
      mediaSaidas,
      mesesComSaldoPositivo,
      totalMeses: mesesComMovimento.length,
    };
  }, [resumos]);

  // ─── GASTO FIXO vs VARIÁVEL ────────────────────────────────────────
  const analiseFixoVariavel = useMemo(() => {
    if (transacoes.length === 0) return null;

    const saidas = transacoes.filter((t) => t.tipo === 'saida');

    // Conta quantas vezes cada categoria aparece
    const porCategoria = new Map<string, { total: number; meses: Set<string> }>();
    for (const t of saidas) {
      const chaveMes = `${t.data.getFullYear()}-${t.data.getMonth()}`;
      const atual = porCategoria.get(t.categoria) ?? { total: 0, meses: new Set() };
      atual.total += t.valor;
      atual.meses.add(chaveMes);
      porCategoria.set(t.categoria, atual);
    }

    const totalSaidas = saidas.reduce((s, t) => s + t.valor, 0);
    const totalMeses = new Set(saidas.map((t) => `${t.data.getFullYear()}-${t.data.getMonth()}`)).size;

    const categorias: CategoriaFixa[] = [];
    let totalFixo = 0;
    let totalVariavel = 0;

    for (const [categoria, dados] of porCategoria) {
      const apareceEm = dados.meses.size;
      const percentual = apareceEm / totalMeses;
      const media = dados.total / totalMeses;

      categorias.push({
        categoria,
        total: dados.total,
        meses: apareceEm,
        media,
      });

      // Se aparece em mais de 70% dos meses, é fixo
      if (percentual >= 0.7) totalFixo += dados.total;
      else totalVariavel += dados.total;
    }

    return {
      categorias: categorias.sort((a, b) => b.total - a.total),
      totalFixo,
      totalVariavel,
      totalSaidas,
      percentualFixo: totalSaidas > 0 ? totalFixo / totalSaidas : 0,
    };
  }, [transacoes]);

  // ─── DIAS QUE MAIS GASTA ──────────────────────────────────────────
  const gastosPorDiaSemana = useMemo(() => {
    if (transacoes.length === 0) return [];

    const saidas = transacoes.filter((t) => t.tipo === 'saida');
    const porDia = new Map<number, { total: number; quantidade: number }>();

    for (const t of saidas) {
      const dia = t.data.getDay();
      const atual = porDia.get(dia) ?? { total: 0, quantidade: 0 };
      atual.total += t.valor;
      atual.quantidade += 1;
      porDia.set(dia, atual);
    }

    const dias: DiaDaSemana[] = [];
    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < 7; i++) {
      const dados = porDia.get(i) ?? { total: 0, quantidade: 0 };
      dias.push({
        nome: nomesDias[i],
        total: dados.total,
        quantidade: dados.quantidade,
        media: dados.quantidade > 0 ? dados.total / dados.quantidade : 0,
      });
    }

    return dias.sort((a, b) => b.total - a.total);
  }, [transacoes]);

  // ─── MELHOR/PIOR MÊS ──────────────────────────────────────────────
  const melhorPiorMes = useMemo(() => {
    if (resumos.length === 0) return null;

    const comMovimento = resumos.filter((r) => r.quantidade > 0);
    if (comMovimento.length === 0) return null;

    const melhor = comMovimento.reduce((topo, r) => (r.saldo > topo.saldo ? r : topo));
    const pior = comMovimento.reduce((fundo, r) => (r.saldo < fundo.saldo ? r : fundo));

    return { melhor, pior };
  }, [resumos]);

  // ─── PROJEÇÃO ─────────────────────────────────────────────────────
  const projecao = useMemo(() => {
    if (resumos.length < 2) return null;

    const mesesComMovimento = resumos.filter((r) => r.quantidade > 0);
    if (mesesComMovimento.length === 0) return null;

    const mediaEntradas = resumos.reduce((s, r) => s + r.entradas, 0) / resumos.length;
    const mediaSaidas = resumos.reduce((s, r) => s + r.saidas, 0) / resumos.length;
    const mediaSaldo = mediaEntradas - mediaSaidas;

    // Projetar 6 meses à frente
    const mesesProjecao = 6;
    const saldoFinal = mediaSaldo * mesesProjecao;

    return {
      mediaEntradas,
      mediaSaidas,
      mediaSaldo,
      mesesProjecao,
      saldoFinal,
      acumulado: resumos.reduce((s, r) => s + r.saldo, 0) + saldoFinal,
    };
  }, [resumos]);

  // ─── ORÇAMENTO vs REAL ────────────────────────────────────────────
  const orcamentoVsReal = useMemo(() => {
    if (!orcamento || Object.keys(orcamento.limites).length === 0) return null;

    const saidasMesAtual = transacoes.filter(
      (t) => t.tipo === 'saida' && t.data >= meses[meses.length - 1],
    );

    const porCategoria = new Map<string, number>();
    for (const t of saidasMesAtual) {
      porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + t.valor);
    }

    const categorias = Object.entries(orcamento.limites).map(([categoria, limite]) => ({
      categoria,
      limite,
      gasto: porCategoria.get(categoria) ?? 0,
      proporcao: limite > 0 ? ((porCategoria.get(categoria) ?? 0) / limite) : 0,
    }));

    const totalLimite = Object.values(orcamento.limites).reduce((s, l) => s + l, 0);
    const totalGasto = categorias.reduce((s, c) => s + c.gasto, 0);

    return {
      categorias: categorias.sort((a, b) => b.proporcao - a.proporcao),
      totalLimite,
      totalGasto,
      dentroDoOrcamento: totalGasto <= totalLimite,
    };
  }, [orcamento, transacoes, meses]);

  return (
    <>
      <CabecalhoDaPagina
        titulo="Relatórios"
        descricao={`Análise dos últimos ${quantidade} meses`}
        acoes={
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
        }
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Analisando seus dados…" />
        ) : transacoes.length === 0 ? (
          <div className="cartao">
            <div className="cartao-corpo">
              <EstadoVazio
                selo="📊"
                titulo="Nenhum lançamento no período"
                descricao="Registre suas receitas e despesas para ver os relatórios aqui."
              />
            </div>
          </div>
        ) : (
          <>
            {/* ─── SAÚDE FINANCEIRA ──────────────────────────────────── */}
            {saudeFinanceira && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Saúde Financeira</h2>
                </div>
                <div className="cartao-corpo">
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: '50%',
                        background: `conic-gradient(${saudeFinanceira.cor} ${saudeFinanceira.score * 3.6}deg, var(--cinza-claro) 0deg)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <div
                        style={{
                          width: 110,
                          height: 110,
                          borderRadius: '50%',
                          background: 'var(--cartao)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: '2.5rem', fontWeight: 700, color: saudeFinanceira.cor }}>
                          {saudeFinanceira.score}
                        </span>
                        <span className="texto-miudo" style={{ color: 'var(--tinta-fraca)' }}>
                          de 100
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: saudeFinanceira.cor,
                      }}
                    >
                      {saudeFinanceira.classificacao}
                    </span>
                  </div>

                  <div className="grade-resumo" style={{ marginTop: 0 }}>
                    <CartaoResumo
                      rotulo="Taxa de poupança"
                      valor={saudeFinanceira.taxaDePoupanca * resumoMesAtual.entradas}
                      cor="entrada"
                      corDaFaixa="var(--entrada)"
                      nota={`${formatarPorcentagem(saudeFinanceira.taxaDePoupanca)} das entradas.`}
                    />
                    <CartaoResumo
                      rotulo="Meses no positivo"
                      valor={saudeFinanceira.mesesComSaldoPositivo}
                      cor="saldo"
                      corDaFaixa="var(--destaque)"
                      nota={`De ${saudeFinanceira.totalMeses} meses.`}
                    />
                    <CartaoResumo
                      rotulo="Gasto médio mensal"
                      valor={saudeFinanceira.mediaSaidas}
                      cor="saida"
                      corDaFaixa="var(--saida)"
                      nota="Em despesas."
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ─── GASTO FIXO vs VARIÁVEL ────────────────────────────── */}
            {analiseFixoVariavel && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Fixo vs Variável</h2>
                  <span className="texto-miudo">
                    {formatarPorcentagem(analiseFixoVariavel.percentualFixo)} fixo
                  </span>
                </div>
                <div className="cartao-corpo">
                  <div className="grade-resumo" style={{ marginTop: 0, marginBottom: 20 }}>
                    <CartaoResumo
                      rotulo="Gastos fixos"
                      valor={analiseFixoVariavel.totalFixo}
                      cor="saida"
                      corDaFaixa="var(--atencao)"
                      nota="Contas que se repetem todo mês."
                    />
                    <CartaoResumo
                      rotulo="Gastos variáveis"
                      valor={analiseFixoVariavel.totalVariavel}
                      cor="saida"
                      corDaFaixa="var(--saida)"
                      nota="Gastos discricionários."
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        height: 24,
                        borderRadius: 12,
                        background: 'var(--cinza-claro)',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div
                        style={{
                          width: `${analiseFixoVariavel.percentualFixo * 100}%`,
                          background: 'var(--atencao)',
                          transition: 'width 0.3s',
                        }}
                      />
                      <div
                        style={{
                          width: `${(1 - analiseFixoVariavel.percentualFixo) * 100}%`,
                          background: 'var(--saida)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="texto-miudo">Fixo ({formatarPorcentagem(analiseFixoVariavel.percentualFixo)})</span>
                      <span className="texto-miudo">Variável ({formatarPorcentagem(1 - analiseFixoVariavel.percentualFixo)})</span>
                    </div>
                  </div>

                  <p className="texto-apoio" style={{ margin: 0 }}>
                    {analiseFixoVariavel.percentualFixo > 0.7
                      ? '⚠️ Seus gastos fixos estão altos. Considere renegociar contratos ou cancelar assinaturas não utilizadas.'
                      : analiseFixoVariavel.percentualFixo < 0.4
                        ? '✅ Parabéns! Você tem flexibilidade nos seus gastos. Aproveite para aumentar a poupança.'
                        : '📊 Seus gastos estão equilibrados. Mantenha o controle para não deixar os fixos crescerem.'}
                  </p>
                </div>
              </section>
            )}

            {/* ─── DIAS QUE MAIS GASTA ──────────────────────────────── */}
            {gastosPorDiaSemana.length > 0 && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Dias que mais gasta</h2>
                  <span className="texto-miudo">
                    pico: {gastosPorDiaSemana[0]?.nome}
                  </span>
                </div>
                <div className="cartao-corpo">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {gastosPorDiaSemana.map((dia) => {
                      const maior = gastosPorDiaSemana[0]?.total ?? 1;
                      const proporcao = dia.total / maior;

                      return (
                        <div
                          key={dia.nome}
                          style={{
                            flex: '1 1 80px',
                            textAlign: 'center',
                            padding: '12px 8px',
                            borderRadius: 8,
                            background: 'var(--fundo)',
                          }}
                        >
                          <div
                            style={{
                              height: 60,
                              display: 'flex',
                              alignItems: 'flex-end',
                              justifyContent: 'center',
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                width: '60%',
                                height: `${proporcao * 100}%`,
                                minHeight: 4,
                                background: dia.nome === gastosPorDiaSemana[0]?.nome
                                  ? 'var(--saida)'
                                  : 'var(--cinza-claro)',
                                borderRadius: 4,
                              }}
                            />
                          </div>
                          <span className="texto-miudo" style={{ fontWeight: 600 }}>
                            {dia.nome}
                          </span>
                          <br />
                          <span className="texto-miudo" style={{ color: 'var(--tinta-fraca)' }}>
                            {formatarMoeda(dia.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="texto-apoio" style={{ marginTop: 16, marginBottom: 0 }}>
                    {gastosPorDiaSemana[0]?.nome === 'Sexta' || gastosPorDiaSemana[0]?.nome === 'Sábado'
                      ? '🗓️ Você gasta mais no fim de semana. Tente planejar compras e saídas para evitar surpresas.'
                      : '📊 Mantenha o controle nos dias de maior gasto para não estourar o orçamento.'}
                  </p>
                </div>
              </section>
            )}

            {/* ─── MELHOR/PIOR MÊS ──────────────────────────────────── */}
            {melhorPiorMes && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Melhor vs Pior mês</h2>
                </div>
                <div className="cartao-corpo">
                  <div className="grade-resumo" style={{ marginTop: 0 }}>
                    <CartaoResumo
                      rotulo={`🏆 ${rotuloDoMes(melhorPiorMes.melhor.inicio)}`}
                      valor={melhorPiorMes.melhor.saldo}
                      cor="entrada"
                      corDaFaixa="var(--entrada)"
                      nota={`${formatarMoeda(melhorPiorMes.melhor.entradas)} entrada, ${formatarMoeda(melhorPiorMes.melhor.saidas)} saída.`}
                    />
                    <CartaoResumo
                      rotulo={`⚠️ ${rotuloDoMes(melhorPiorMes.pior.inicio)}`}
                      valor={melhorPiorMes.pior.saldo}
                      cor="saida"
                      corDaFaixa="var(--saida)"
                      nota={`${formatarMoeda(melhorPiorMes.pior.entradas)} entrada, ${formatarMoeda(melhorPiorMes.pior.saidas)} saída.`}
                    />
                  </div>

                  <p className="texto-apoio" style={{ margin: 0 }}>
                    {melhorPiorMes.melhor.saldo > 0
                      ? `No melhor mês, você conseguiu economizar ${formatarMoeda(melhorPiorMes.melhor.saldo)}. Tente manter esse padrão!`
                      : 'Nenhum mês teve saldo positivo. Revista seus gastos e busque reduzir custos fixos.'}
                  </p>
                </div>
              </section>
            )}

            {/* ─── PROJEÇÃO ─────────────────────────────────────────── */}
            {projecao && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Projeção</h2>
                  <span className="texto-miudo">se mantiver o padrão atual</span>
                </div>
                <div className="cartao-corpo">
                  <div className="grade-resumo" style={{ marginTop: 0 }}>
                    <CartaoResumo
                      rotulo="Média mensal de saldo"
                      valor={projecao.mediaSaldo}
                      cor={projecao.mediaSaldo >= 0 ? 'entrada' : 'saida'}
                      corDaFaixa={projecao.mediaSaldo >= 0 ? 'var(--entrada)' : 'var(--saida)'}
                      nota={projecao.mediaSaldo >= 0 ? 'Economizando!' : 'No vermelho.'}
                    />
                    <CartaoResumo
                      rotulo={`Em ${projecao.mesesProjecao} meses`}
                      valor={projecao.saldoFinal}
                      cor={projecao.saldoFinal >= 0 ? 'entrada' : 'saida'}
                      corDaFaixa={projecao.saldoFinal >= 0 ? 'var(--entrada)' : 'var(--saida)'}
                      nota={`${formatarMoeda(projecao.mediaEntradas)} entrada, ${formatarMoeda(projecao.mediaSaidas)} saída.`}
                    />
                    <CartaoResumo
                      rotulo="Acumulado projetado"
                      valor={projecao.acumulado}
                      cor="saldo"
                      corDaFaixa={projecao.acumulado >= 0 ? 'var(--entrada)' : 'var(--saida)'}
                      nota="Incluindo o que já tem no período."
                    />
                  </div>

                  <p className="texto-apoio" style={{ margin: 0 }}>
                    {projecao.mediaSaldo >= 0
                      ? `✅ Se mantiver o padrão, você terá ${formatarMoeda(projecao.acumulado)} acumulados em ${projecao.mesesProjecao + resumos.length} meses.`
                      : `⚠️ No ritmo atual, você perderá ${formatarMoeda(Math.abs(projecao.saldoFinal))} nos próximos ${projecao.mesesProjecao} meses. Reveja seus gastos.`}
                  </p>
                </div>
              </section>
            )}

            {/* ─── ORÇAMENTO vs REAL ────────────────────────────────── */}
            {orcamentoVsReal && (
              <section className="cartao">
                <div className="cartao-cabeca">
                  <h2>Orçamento vs Real</h2>
                  <span className="texto-miudo">
                    {orcamentoVsReal.dentroDoOrcamento ? '✅ Dentro' : '⚠️ Estourado'}
                  </span>
                </div>
                <div className="cartao-corpo">
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        height: 24,
                        borderRadius: 12,
                        background: 'var(--cinza-claro)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min((orcamentoVsReal.totalGasto / orcamentoVsReal.totalLimite) * 100, 100)}%`,
                          background: orcamentoVsReal.dentroDoOrcamento ? 'var(--entrada)' : 'var(--saida)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="texto-miudo">
                        Gasto: {formatarMoeda(orcamentoVsReal.totalGasto)}
                      </span>
                      <span className="texto-miudo">
                        Limite: {formatarMoeda(orcamentoVsReal.totalLimite)}
                      </span>
                    </div>
                  </div>

                  <ul className="lista-lancamentos">
                    {orcamentoVsReal.categorias.map((cat) => (
                      <li className="lancamento" key={cat.categoria}>
                        <div className="lancamento-textos">
                          <div className="lancamento-descricao">{cat.categoria}</div>
                          <div className="lancamento-meta">
                            <span>
                              {formatarMoeda(cat.gasto)} / {formatarMoeda(cat.limite)}
                            </span>
                          </div>
                        </div>
                        <span
                          style={{
                            color: cat.proporcao > 1 ? 'var(--saida)' : cat.proporcao > 0.8 ? 'var(--atencao)' : 'var(--entrada)',
                            fontWeight: 600,
                          }}
                        >
                          {formatarPorcentagem(cat.proporcao)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
