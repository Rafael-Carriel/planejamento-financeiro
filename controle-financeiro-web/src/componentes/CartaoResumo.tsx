import { Dinheiro } from './Dinheiro';
import { comVariaveis } from '../utilitarios/estilo';

/// Cartão de total: entradas, saídas ou saldo.
///
/// A faixa colorida na lateral esquerda é o que diferencia os três num relance,
/// sem precisar ler o rótulo.

interface Propriedades {
  rotulo: string;
  valor: number;
  cor: 'entrada' | 'saida' | 'saldo';
  corDaFaixa: string;
  nota?: string;
}

export function CartaoResumo({ rotulo, valor, cor, corDaFaixa, nota }: Propriedades) {
  return (
    <div className="cartao cartao-resumo" style={comVariaveis({ '--cor-faixa': corDaFaixa })}>
      <span className="etiqueta">{rotulo}</span>
      <Dinheiro valor={valor} cor={cor} className="cartao-resumo-valor" />
      {nota ? <p className="cartao-resumo-nota">{nota}</p> : null}
    </div>
  );
}
