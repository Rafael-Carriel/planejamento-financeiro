import type {
  LinhaDePlanejamento,
  ResumoDeMes,
  ResumoFinanceiro,
  TipoTransacao,
  TotalPorCategoria,
  Transacao,
} from '../tipos';
import { chaveDoMes, diasDoMes, inicioDoMes } from '../utilitarios/datas';

/// Contas do domínio, sem React e sem Firebase.
///
/// Todas recebem a lista de lançamentos já carregada e devolvem um novo objeto.
/// Ficando puras, o mesmo cálculo serve ao painel, aos relatórios e ao histórico
/// sem duplicar regra — e dá para conferir o resultado no console se preciso.

export const RESUMO_VAZIO: ResumoFinanceiro = {
  entradas: 0,
  saidas: 0,
  saldo: 0,
  quantidade: 0,
};

export function resumir(transacoes: Transacao[]): ResumoFinanceiro {
  let entradas = 0;
  let saidas = 0;

  for (const transacao of transacoes) {
    if (transacao.tipo === 'entrada') entradas += transacao.valor;
    else saidas += transacao.valor;
  }

  return {
    entradas,
    saidas,
    saldo: entradas - saidas,
    quantidade: transacoes.length,
  };
}

export function filtrarPorTipo(
  transacoes: Transacao[],
  tipo: TipoTransacao,
): Transacao[] {
  return transacoes.filter((transacao) => transacao.tipo === tipo);
}

/// Quanto cada categoria movimentou, da maior para a menor.
export function totaisPorCategoria(
  transacoes: Transacao[],
  tipo: TipoTransacao,
): TotalPorCategoria[] {
  const porCategoria = new Map<string, { total: number; quantidade: number }>();
  let totalGeral = 0;

  for (const transacao of transacoes) {
    if (transacao.tipo !== tipo) continue;

    const atual = porCategoria.get(transacao.categoria) ?? { total: 0, quantidade: 0 };
    atual.total += transacao.valor;
    atual.quantidade += 1;
    porCategoria.set(transacao.categoria, atual);
    totalGeral += transacao.valor;
  }

  return [...porCategoria.entries()]
    .map(([categoria, dados]) => ({
      categoria,
      total: dados.total,
      quantidade: dados.quantidade,
      fatia: totalGeral > 0 ? dados.total / totalGeral : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface FluxoDoDia {
  dia: number;
  entradas: number;
  saidas: number;
  saldo: number;
}

/// Movimento de cada dia do mês, do dia 1 ao último — inclusive os dias sem
/// lançamento, que aparecem zerados. A régua do mês precisa da grade completa
/// para os dias ficarem no lugar certo.
export function fluxoPorDia(transacoes: Transacao[], mes: Date): FluxoDoDia[] {
  const total = diasDoMes(mes);
  const dias: FluxoDoDia[] = Array.from({ length: total }, (_, indice) => ({
    dia: indice + 1,
    entradas: 0,
    saidas: 0,
    saldo: 0,
  }));

  for (const transacao of transacoes) {
    const indice = transacao.data.getDate() - 1;
    if (indice < 0 || indice >= dias.length) continue;

    const dia = dias[indice];
    if (transacao.tipo === 'entrada') dia.entradas += transacao.valor;
    else dia.saidas += transacao.valor;
    dia.saldo = dia.entradas - dia.saidas;
  }

  return dias;
}

/// Cruza os limites do mês com o que já foi gasto.
///
/// Entram na lista as categorias com limite e também as que tiveram gasto sem
/// limite nenhum (limite 0) — justamente as que o planejamento esqueceu, que são
/// as mais interessantes de ver.
export function linhasDePlanejamento(
  transacoes: Transacao[],
  limites: Record<string, number>,
): LinhaDePlanejamento[] {
  const gastoPorCategoria = new Map<string, number>();
  for (const transacao of transacoes) {
    if (transacao.tipo !== 'saida') continue;
    gastoPorCategoria.set(
      transacao.categoria,
      (gastoPorCategoria.get(transacao.categoria) ?? 0) + transacao.valor,
    );
  }

  const categorias = new Set<string>([
    ...Object.keys(limites),
    ...gastoPorCategoria.keys(),
  ]);

  return [...categorias]
    .map((categoria) => {
      const limite = limites[categoria] ?? 0;
      const gasto = gastoPorCategoria.get(categoria) ?? 0;
      return {
        categoria,
        limite,
        gasto,
        proporcao: limite > 0 ? gasto / limite : 0,
        restante: limite - gasto,
      };
    })
    .sort((a, b) => {
      // Quem tem limite vem primeiro; dentro de cada grupo, o mais apertado
      // primeiro, que é o que precisa de atenção.
      if (a.limite > 0 !== b.limite > 0) return a.limite > 0 ? -1 : 1;
      if (a.limite > 0) return b.proporcao - a.proporcao;
      return b.gasto - a.gasto;
    });
}

/// Agrupa por mês, na ordem em que os meses foram pedidos.
export function resumosPorMes(transacoes: Transacao[], meses: Date[]): ResumoDeMes[] {
  const porChave = new Map<string, { entradas: number; saidas: number; quantidade: number }>();

  for (const transacao of transacoes) {
    const chave = chaveDoMes(transacao.data);
    const atual = porChave.get(chave) ?? { entradas: 0, saidas: 0, quantidade: 0 };
    if (transacao.tipo === 'entrada') atual.entradas += transacao.valor;
    else atual.saidas += transacao.valor;
    atual.quantidade += 1;
    porChave.set(chave, atual);
  }

  return meses.map((mes) => {
    const chave = chaveDoMes(mes);
    const dados = porChave.get(chave) ?? { entradas: 0, saidas: 0, quantidade: 0 };
    return {
      chave,
      inicio: inicioDoMes(mes),
      entradas: dados.entradas,
      saidas: dados.saidas,
      saldo: dados.entradas - dados.saidas,
      quantidade: dados.quantidade,
    };
  });
}

/// Média mensal considerando só os meses que tiveram algum lançamento.
///
/// Incluir os meses vazios puxaria a média para baixo e daria uma impressão
/// errada de quem começou a usar o app no meio do período.
export function mediaMensal(resumos: ResumoDeMes[]): ResumoFinanceiro {
  const comMovimento = resumos.filter((resumo) => resumo.quantidade > 0);
  if (comMovimento.length === 0) return RESUMO_VAZIO;

  const entradas =
    comMovimento.reduce((soma, resumo) => soma + resumo.entradas, 0) / comMovimento.length;
  const saidas =
    comMovimento.reduce((soma, resumo) => soma + resumo.saidas, 0) / comMovimento.length;

  return {
    entradas,
    saidas,
    saldo: entradas - saidas,
    quantidade: comMovimento.length,
  };
}
