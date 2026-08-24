/// Formatação de dinheiro, datas e porcentagens, sempre em pt-BR.

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const MOEDA_SEM_CENTAVOS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const NUMERO = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

const DATA_COMPLETA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DIA_DA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/// R$ 1.234,56
export function formatarMoeda(valor: number): string {
  return MOEDA.format(valor);
}

/// R$ 1.235 — para espaços apertados, como os rótulos do gráfico.
export function formatarMoedaCurta(valor: number): string {
  return MOEDA_SEM_CENTAVOS.format(valor);
}

/// 1.234,56 (sem o "R$", quando o rótulo já diz que é dinheiro)
export function formatarNumero(valor: number): string {
  return NUMERO.format(valor);
}

/// Dinheiro com sinal explícito: "+ R$ 100,00" ou "− R$ 100,00".
///
/// Usa o menos matemático (−, U+2212) em vez do hífen: alinha com os dígitos
/// na fonte monoespaçada e não quebra a linha no lugar errado.
export function formatarComSinal(valor: number): string {
  const simbolo = valor < 0 ? '−' : '+';
  return `${simbolo} ${MOEDA.format(Math.abs(valor))}`;
}

/// 23/08
export function formatarDataCurta(data: Date): string {
  return DATA_CURTA.format(data);
}

/// 23/08/2026
export function formatarData(data: Date): string {
  return DATA_COMPLETA.format(data);
}

/// "sáb" (sem o ponto que o Intl acrescenta em alguns navegadores)
export function formatarDiaDaSemana(data: Date): string {
  return DIA_DA_SEMANA.format(data).replace('.', '');
}

/// 0,42 → "42%"
export function formatarPorcentagem(fracao: number, casas = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(fracao);
}

/// Interpreta o que o usuário digitou no campo de valor.
///
/// Aceita "1.234,56", "1234,56", "1234.56" e "R$ 1.234,56" — as três primeiras
/// porque teclado numérico e cópia de outro sistema produzem cada uma delas.
/// Devolve `null` quando não sobra um número utilizável.
export function interpretarValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim();
  if (limpo.length === 0) return null;

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');

  let normalizado = limpo;
  if (temVirgula && temPonto) {
    // O separador decimal é o último que aparece.
    const decimalEhVirgula = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
    normalizado = decimalEhVirgula
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  }

  const numero = Number.parseFloat(normalizado);
  if (!Number.isFinite(numero)) return null;
  return Math.abs(Math.round(numero * 100) / 100);
}

/// Primeira letra maiúscula, o resto intacto (não mexe no meio da palavra).
export function comInicialMaiuscula(texto: string): string {
  if (texto.length === 0) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
