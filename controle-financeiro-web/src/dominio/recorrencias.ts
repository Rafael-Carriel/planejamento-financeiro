import {
  chaveDoMes,
  deChaveDoMes,
  diaDentroDoMes,
  diferencaEmMeses,
  hoje,
  inicioDoMes,
  mesmoMes,
  rotuloDoMesCurto,
  somarMeses,
} from '../utilitarios/datas';
import type {
  MesPrevisto,
  OcorrenciaPrevista,
  Recorrencia,
  SituacaoDaOcorrencia,
  TipoTransacao,
  Transacao,
} from '../tipos';

/// Projeção das recorrências: de "todo mês, dia 5" para "cai em 05/09/2026".
///
/// Nada aqui grava nada. As ocorrências são calculadas na hora de mostrar, a
/// partir da recorrência e das transações que já existem. Mesmo no modo
/// automático, só a ocorrência vencida é gravada; o futuro continua projetado:
///
/// - não precisa de rotina no servidor ou de gerar lançamentos futuros;
/// - mudar o valor do aluguel corrige o futuro sem reescrever o passado;
/// - apagar a recorrência não deixa lançamento fantasma no mês que vem.
///
/// Uma ocorrência prevista desaparece quando existe, no mesmo mês, uma
/// transação com `recorrenciaId` igual ao dela.

/// Quantos meses depois do início a recorrência cai neste mês. Negativo quer
/// dizer que a série ainda não começou.
function indiceDoMes(recorrencia: Recorrencia, mes: Date): number {
  return diferencaEmMeses(recorrencia.inicio, inicioDoMes(mes));
}

/// A série alcança este mês? Falso antes do início e depois da última parcela.
function alcancaOMes(recorrencia: Recorrencia, mes: Date): boolean {
  const indice = indiceDoMes(recorrencia, mes);
  if (indice < 0) return false;
  if (recorrencia.parcelas === null) return true;
  return indice < recorrencia.parcelas;
}

/// Último mês da série, ou `null` quando ela não tem fim.
export function ultimoMesDaRecorrencia(recorrencia: Recorrencia): Date | null {
  if (recorrencia.parcelas === null) return null;
  return somarMeses(recorrencia.inicio, recorrencia.parcelas - 1);
}

function situacaoDaData(data: Date, referencia: Date): SituacaoDaOcorrencia {
  return data.getTime() < referencia.getTime() ? 'atrasada' : 'aVencer';
}

/// A ocorrência de uma recorrência num mês, ou `null` se a série não alcança o
/// mês (ou está pausada).
///
/// `transacoesDoMes` deve conter só as transações daquele mês — é nela que se
/// procura o lançamento que já cumpriu a ocorrência.
export function ocorrenciaDoMes(
  recorrencia: Recorrencia,
  mes: Date,
  transacoesDoMes: Transacao[],
  referencia: Date = hoje(),
): OcorrenciaPrevista | null {
  if (!recorrencia.ativa) return null;
  if (!alcancaOMes(recorrencia, mes)) return null;

  const data = diaDentroDoMes(mes, recorrencia.diaDoMes);
  const jaLancada = transacoesDoMes.find(
    (transacao) => transacao.recorrenciaId === recorrencia.id,
  );

  const indice = indiceDoMes(recorrencia, mes);

  return {
    chave: `${recorrencia.id}:${chaveDoMes(mes)}`,
    recorrenciaId: recorrencia.id,
    descricao: recorrencia.descricao,
    // O valor mostrado é o da transação quando ela existe: se o boleto veio
    // R$ 12 mais caro, é esse o número que entra na conta do mês.
    valor: jaLancada ? jaLancada.valor : recorrencia.valor,
    tipo: recorrencia.tipo,
    categoria: jaLancada ? jaLancada.categoria : recorrencia.categoria,
    data: jaLancada ? jaLancada.data : data,
    observacao: recorrencia.observacao,
    modoLancamento: recorrencia.modoLancamento,
    parcela: recorrencia.parcelas === null ? null : indice + 1,
    totalDeParcelas: recorrencia.parcelas,
    situacao: jaLancada ? 'lancada' : situacaoDaData(data, referencia),
    transacaoId: jaLancada ? jaLancada.id : null,
  };
}

/// Meses vencidos que uma recorrência automática ainda precisa verificar.
/// O primeiro mês automático é deliberadamente separado do início da série:
/// trocar uma recorrência antiga para automática não cria anos de histórico.
export function mesesAutomaticosPendentes(
  recorrencia: Recorrencia,
  referencia: Date = hoje(),
): Date[] {
  if (!recorrencia.ativa || recorrencia.modoLancamento !== 'automatico') return [];
  if (!recorrencia.automaticoDesde) return [];

  const primeiroPermitido =
    recorrencia.inicio.getTime() > recorrencia.automaticoDesde.getTime()
      ? recorrencia.inicio
      : recorrencia.automaticoDesde;
  const primeiro = recorrencia.automaticoAte
    ? somarMeses(deChaveDoMes(recorrencia.automaticoAte), 1)
    : primeiroPermitido;
  const inicio = primeiro.getTime() > primeiroPermitido.getTime() ? primeiro : primeiroPermitido;
  const mesAtual = inicioDoMes(referencia);
  const quantidade = diferencaEmMeses(inicio, mesAtual);
  if (quantidade < 0) return [];

  const meses: Date[] = [];
  for (let deslocamento = 0; deslocamento <= quantidade; deslocamento += 1) {
    const mes = somarMeses(inicio, deslocamento);
    if (!alcancaOMes(recorrencia, mes)) continue;

    const data = diaDentroDoMes(mes, recorrencia.diaDoMes);
    if (data.getTime() > referencia.getTime()) break;
    meses.push(mes);
  }

  return meses;
}

function porData(a: OcorrenciaPrevista, b: OcorrenciaPrevista): number {
  const diferenca = a.data.getTime() - b.data.getTime();
  if (diferenca !== 0) return diferenca;
  return a.descricao.localeCompare(b.descricao, 'pt-BR');
}

/// Todas as ocorrências de um mês, da mais antiga para a mais recente.
export function ocorrenciasDoMes(
  recorrencias: Recorrencia[],
  mes: Date,
  transacoesDoMes: Transacao[],
  referencia: Date = hoje(),
): OcorrenciaPrevista[] {
  const ocorrencias: OcorrenciaPrevista[] = [];

  for (const recorrencia of recorrencias) {
    const ocorrencia = ocorrenciaDoMes(recorrencia, mes, transacoesDoMes, referencia);
    if (ocorrencia) ocorrencias.push(ocorrencia);
  }

  return ocorrencias.sort(porData);
}

/// As que ainda não foram lançadas — as que valem como "falta pagar/receber".
export function pendentes(ocorrencias: OcorrenciaPrevista[]): OcorrenciaPrevista[] {
  return ocorrencias.filter((ocorrencia) => ocorrencia.situacao !== 'lancada');
}

export function doTipo(
  ocorrencias: OcorrenciaPrevista[],
  tipo: TipoTransacao,
): OcorrenciaPrevista[] {
  return ocorrencias.filter((ocorrencia) => ocorrencia.tipo === tipo);
}

export function somarOcorrencias(ocorrencias: OcorrenciaPrevista[]): number {
  return ocorrencias.reduce((total, ocorrencia) => total + ocorrencia.valor, 0);
}

/// Previsão mês a mês: o que já foi lançado somado ao que ainda deve acontecer.
///
/// `transacoes` precisa cobrir todos os `meses` pedidos — a página faz uma
/// leitura única do período inteiro. O `acumulado` soma os saldos na ordem da
/// lista, então os meses devem vir em ordem crescente.
export function previsaoDosMeses(
  recorrencias: Recorrencia[],
  meses: Date[],
  transacoes: Transacao[],
  referencia: Date = hoje(),
): MesPrevisto[] {
  let acumulado = 0;

  return meses.map((mes) => {
    const doMes = transacoes.filter((transacao) => mesmoMes(transacao.data, mes));

    let entradasLancadas = 0;
    let saidasLancadas = 0;
    for (const transacao of doMes) {
      if (transacao.tipo === 'entrada') entradasLancadas += transacao.valor;
      else saidasLancadas += transacao.valor;
    }

    const ocorrencias = ocorrenciasDoMes(recorrencias, mes, doMes, referencia);

    let entradasPrevistas = 0;
    let saidasPrevistas = 0;
    for (const ocorrencia of ocorrencias) {
      // Ocorrência já lançada não entra na soma: ela já está contada nos
      // totais das transações. Somar as duas dobraria o salário.
      if (ocorrencia.situacao === 'lancada') continue;
      if (ocorrencia.tipo === 'entrada') entradasPrevistas += ocorrencia.valor;
      else saidasPrevistas += ocorrencia.valor;
    }

    const entradas = entradasLancadas + entradasPrevistas;
    const saidas = saidasLancadas + saidasPrevistas;
    const saldo = entradas - saidas;
    acumulado += saldo;

    return {
      chave: chaveDoMes(mes),
      inicio: inicioDoMes(mes),
      entradasLancadas,
      saidasLancadas,
      entradasPrevistas,
      saidasPrevistas,
      entradas,
      saidas,
      saldo,
      acumulado,
      ocorrencias,
    };
  });
}

/// A próxima vez que a recorrência cai, contando de `referencia` em diante.
///
/// Devolve `null` quando a série já terminou ou está pausada. Olha no máximo dois
/// meses: se a data deste mês já passou, a próxima é a do mês seguinte.
export function proximaOcorrencia(
  recorrencia: Recorrencia,
  referencia: Date = hoje(),
): Date | null {
  if (!recorrencia.ativa) return null;

  const mesInicial = inicioDoMes(referencia);
  const candidatos =
    indiceDoMes(recorrencia, mesInicial) < 0
      ? [recorrencia.inicio]
      : [mesInicial, somarMeses(mesInicial, 1)];

  for (const mes of candidatos) {
    if (!alcancaOMes(recorrencia, mes)) continue;
    const data = diaDentroDoMes(mes, recorrencia.diaDoMes);
    if (data.getTime() >= referencia.getTime()) return data;
  }

  return null;
}

/// Quantas parcelas ainda vão cair, contando de `referencia` em diante.
/// `null` para série sem fim.
export function parcelasRestantes(
  recorrencia: Recorrencia,
  referencia: Date = hoje(),
): number | null {
  if (recorrencia.parcelas === null) return null;

  const indiceAtual = indiceDoMes(recorrencia, referencia);
  if (indiceAtual < 0) return recorrencia.parcelas;

  // A parcela deste mês só conta como restante se a data ainda não passou.
  const dataDoMes = diaDentroDoMes(referencia, recorrencia.diaDoMes);
  const jaPassouNesteMes = dataDoMes.getTime() < referencia.getTime();
  const cumpridas = Math.min(
    recorrencia.parcelas,
    jaPassouNesteMes ? indiceAtual + 1 : indiceAtual,
  );

  return Math.max(0, recorrencia.parcelas - cumpridas);
}

/// A série já acabou?
export function recorrenciaEncerrada(
  recorrencia: Recorrencia,
  referencia: Date = hoje(),
): boolean {
  const ultimo = ultimoMesDaRecorrencia(recorrencia);
  if (ultimo === null) return false;
  return diferencaEmMeses(ultimo, inicioDoMes(referencia)) > 0;
}

/// "Todo dia 5 · desde ago/26" ou "3x · ago/26 até out/26".
export function descreverPeriodo(recorrencia: Recorrencia): string {
  const dia = `dia ${recorrencia.diaDoMes}`;
  const ultimo = ultimoMesDaRecorrencia(recorrencia);

  if (ultimo === null) {
    return `Todo mês, ${dia} · desde ${rotuloDoMesCurto(recorrencia.inicio)}`;
  }

  const de = rotuloDoMesCurto(recorrencia.inicio);
  const ate = rotuloDoMesCurto(ultimo);
  const vezes = recorrencia.parcelas === 1 ? '1 vez' : `${recorrencia.parcelas}x`;

  return de === ate
    ? `${vezes}, ${dia} · ${de}`
    : `${vezes}, ${dia} · ${de} até ${ate}`;
}

/// O que mostrar no lançamento gerado: "Financiamento (2/12)".
export function descricaoDaOcorrencia(ocorrencia: OcorrenciaPrevista): string {
  if (ocorrencia.parcela === null || ocorrencia.totalDeParcelas === null) {
    return ocorrencia.descricao;
  }
  return `${ocorrencia.descricao} (${ocorrencia.parcela}/${ocorrencia.totalDeParcelas})`;
}

/// Quanto as recorrências vigentes pesam por mês, separando entradas de saídas.
/// Serve para o resumo do topo da página de recorrências.
///
/// Pausada não conta, e série que já terminou também não: um boleto de 3x pago
/// até o fim não deve continuar aparecendo como gasto mensal.
export function pesoMensal(
  recorrencias: Recorrencia[],
  referencia: Date = hoje(),
): {
  entradas: number;
  saidas: number;
  saldo: number;
  vigentes: number;
} {
  let entradas = 0;
  let saidas = 0;
  let vigentes = 0;

  for (const recorrencia of recorrencias) {
    if (!recorrencia.ativa) continue;
    if (recorrenciaEncerrada(recorrencia, referencia)) continue;
    vigentes += 1;
    if (recorrencia.tipo === 'entrada') entradas += recorrencia.valor;
    else saidas += recorrencia.valor;
  }

  return { entradas, saidas, saldo: entradas - saidas, vigentes };
}
