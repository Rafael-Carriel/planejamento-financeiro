import type { LinhaDePlanejamento } from '../tipos';

/// Como está cada categoria em relação ao limite do mês.
///
/// A regra fica aqui, e não na tela, porque o painel e o planejamento precisam
/// dizer a mesma coisa sobre a mesma categoria — se cada página decidisse o seu
/// corte, a mesma linha apareceria "tranquila" num lugar e "no limite" no outro.

export type ChaveDeSituacao = 'tranquilo' | 'atencao' | 'estourado' | 'sem-limite';

export interface Situacao {
  chave: ChaveDeSituacao;
  rotulo: string;
  classeDoSelo: string;
  /// Classe extra da barra. Vazia quando a barra usa a cor normal.
  classeDaTrilha: string;
}

/// A partir de 80% do limite já vale avisar: sobrando 20% e faltando semanas de
/// mês, ainda dá tempo de mudar o rumo. Avisar só no estouro não serviria de
/// aviso, serviria de constatação.
const CORTE_DE_ATENCAO = 0.8;

export function situacaoDoLimite(linha: LinhaDePlanejamento): Situacao {
  if (linha.limite <= 0) {
    return {
      chave: 'sem-limite',
      rotulo: 'Sem limite',
      classeDoSelo: 'selo-situacao selo-sem-limite',
      classeDaTrilha: '',
    };
  }

  if (linha.proporcao > 1) {
    return {
      chave: 'estourado',
      rotulo: 'Estourou',
      classeDoSelo: 'selo-situacao selo-estourado',
      classeDaTrilha: 'trilha-estourada',
    };
  }

  if (linha.proporcao >= CORTE_DE_ATENCAO) {
    return {
      chave: 'atencao',
      rotulo: 'No limite',
      classeDoSelo: 'selo-situacao selo-atencao',
      classeDaTrilha: 'trilha-atencao',
    };
  }

  return {
    chave: 'tranquilo',
    rotulo: 'Tranquilo',
    classeDoSelo: 'selo-situacao selo-tranquilo',
    classeDaTrilha: '',
  };
}

/// Categorias que merecem atenção: as estouradas primeiro, depois as apertadas.
export function linhasEmAtencao(linhas: LinhaDePlanejamento[]): LinhaDePlanejamento[] {
  return linhas.filter((linha) => linha.limite > 0 && linha.proporcao >= CORTE_DE_ATENCAO);
}
