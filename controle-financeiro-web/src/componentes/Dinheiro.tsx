import { formatarComSinal, formatarMoeda } from '../utilitarios/formatadores';

/// Valores usam a mesma fonte da interface, com dígitos tabulares alinhados.

type CorDoValor = 'entrada' | 'saida' | 'neutro' | 'saldo';

interface Propriedades {
  valor: number;
  /// 'saldo' decide a cor pelo sinal: positivo é entrada, negativo é saída.
  cor?: CorDoValor;
  comSinal?: boolean;
  className?: string;
}

function classeDaCor(cor: CorDoValor, valor: number): string {
  if (cor === 'entrada') return 'dinheiro-entrada';
  if (cor === 'saida') return 'dinheiro-saida';
  if (cor === 'saldo') {
    if (valor > 0) return 'dinheiro-entrada';
    if (valor < 0) return 'dinheiro-saida';
    return 'dinheiro-neutro';
  }
  return 'dinheiro-neutro';
}

export function Dinheiro({
  valor,
  cor = 'neutro',
  comSinal = false,
  className = '',
}: Propriedades) {
  const classes = ['dinheiro', classeDaCor(cor, valor), className]
    .filter((parte) => parte.length > 0)
    .join(' ');

  return <span className={classes}>{comSinal ? formatarComSinal(valor) : formatarMoeda(valor)}</span>;
}
