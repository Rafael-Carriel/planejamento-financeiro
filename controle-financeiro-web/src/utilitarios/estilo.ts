import type { CSSProperties } from 'react';

/// Passa variáveis CSS pelo atributo `style`.
///
/// O tipo `CSSProperties` do React não conhece propriedades customizadas, então
/// `style={{ '--cor': azul }}` não compila. A conversão fica isolada aqui, num
/// lugar só, em vez de espalhar `as CSSProperties` pelos componentes.
export function comVariaveis(variaveis: Record<string, string | number>): CSSProperties {
  return variaveis as CSSProperties;
}
