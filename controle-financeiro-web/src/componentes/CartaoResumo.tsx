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
  /// Emoji ou ícone que aparece ao lado do rótulo.
  icone?: string;
}

export function CartaoResumo({ rotulo, valor, cor, corDaFaixa, nota, icone }: Propriedades) {
  return (
    <article
      className="cartao cartao-resumo"
      style={comVariaveis({ '--cor-faixa': corDaFaixa })}
    >
      <div className="cartao-resumo-cabeca">
        <div className="cartao-resumo-titulo">
          {icone ? (
            <span className="cartao-resumo-icone" aria-hidden="true">
              {icone}
            </span>
          ) : null}
          <span className="etiqueta">{rotulo}</span>
        </div>
      </div>

      <div className="cartao-resumo-valor-envolto">
        <Dinheiro valor={valor} cor={cor} className="cartao-resumo-valor" />
      </div>

      {nota ? (
        <p className="cartao-resumo-nota">{nota}</p>
      ) : null}
    </article>
  );
}
