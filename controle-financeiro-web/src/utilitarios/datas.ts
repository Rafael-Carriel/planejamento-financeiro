/// Contas com datas. Tudo em horário local: o app é de uso pessoal e o mês do
/// usuário é o mês do fuso dele, não o de UTC. Converter para UTC aqui faria o
/// lançamento do dia 1º às 00h aparecer no mês anterior.

const MES_LONGO = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

const MES_CURTO = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});

/// Meia-noite de hoje.
export function hoje(): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

/// Primeiro instante do mês da data.
export function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

/// Primeiro instante do mês seguinte. É o limite superior *exclusivo* das
/// consultas do mês — evita a dúvida de "23:59:59.999 pega tudo?".
export function inicioDoProximoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth() + 1, 1);
}

/// Desloca o mês mantendo o dia 1º. Aceita deslocamento negativo.
export function somarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1);
}

/// Identificador estável do mês: '2026-08'. É o id do documento de orçamento.
export function chaveDoMes(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}`;
}

/// Caminho de volta da chave para o primeiro dia do mês.
export function deChaveDoMes(chave: string): Date {
  const [ano, mes] = chave.split('-').map((parte) => Number.parseInt(parte, 10));
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return inicioDoMes(hoje());
  return new Date(ano, mes - 1, 1);
}

/// "Agosto de 2026"
export function rotuloDoMes(data: Date): string {
  const rotulo = MES_LONGO.format(data);
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

/// "ago/26" — para o eixo do histórico, onde o espaço é curto.
export function rotuloDoMesCurto(data: Date): string {
  return MES_CURTO.format(data).replace('.', '').replace(' de ', '/');
}

/// Quantos dias tem o mês da data (28, 29, 30 ou 31).
export function diasDoMes(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

export function mesmoMes(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function ehHoje(data: Date): boolean {
  const referencia = new Date();
  return (
    data.getFullYear() === referencia.getFullYear() &&
    data.getMonth() === referencia.getMonth() &&
    data.getDate() === referencia.getDate()
  );
}

/// Os `quantidade` meses que terminam em `referencia`, do mais antigo para o
/// mais novo — a ordem em que o histórico é lido da esquerda para a direita.
export function ultimosMeses(referencia: Date, quantidade: number): Date[] {
  const meses: Date[] = [];
  for (let i = quantidade - 1; i >= 0; i -= 1) {
    meses.push(somarMeses(referencia, -i));
  }
  return meses;
}

/// Os `quantidade` meses que começam em `referencia`, indo para a frente. O
/// primeiro da lista é o próprio mês de referência — a previsão inclui o mês que
/// está em curso, porque é nele que ainda há boleto a vencer.
export function proximosMeses(referencia: Date, quantidade: number): Date[] {
  const meses: Date[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    meses.push(somarMeses(referencia, i));
  }
  return meses;
}

/// Quantos meses inteiros separam dois meses, com sinal. Conta pelo calendário,
/// não por dias: de 31/01 para 01/02 dá 1, não 0.
export function diferencaEmMeses(de: Date, para: Date): number {
  return (para.getFullYear() - de.getFullYear()) * 12 + (para.getMonth() - de.getMonth());
}

/// Um dia dentro do mês da referência, encurtado quando o mês não alcança.
///
/// É o que resolve "todo dia 31": em fevereiro cai no 28 (ou 29), em abril no
/// 30. Sem isso, `new Date(2026, 1, 31)` viraria 3 de março.
export function diaDentroDoMes(mes: Date, dia: number): Date {
  const ultimo = diasDoMes(mes);
  const escolhido = Math.min(Math.max(1, Math.trunc(dia)), ultimo);
  return new Date(mes.getFullYear(), mes.getMonth(), escolhido);
}

/// Formato que o <input type="date"> exige: 'aaaa-mm-dd'.
export function paraCampoData(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/// Lê o valor do <input type="date"> como data local.
///
/// `new Date('2026-08-23')` seria interpretado como UTC e, num fuso negativo
/// como o do Brasil, viraria dia 22 — daí a montagem campo por campo.
export function deCampoData(texto: string): Date | null {
  const partes = texto.split('-').map((parte) => Number.parseInt(parte, 10));
  if (partes.length !== 3 || partes.some((parte) => !Number.isFinite(parte))) {
    return null;
  }
  const [ano, mes, dia] = partes;
  const data = new Date(ano, mes - 1, dia);
  return Number.isNaN(data.getTime()) ? null : data;
}
