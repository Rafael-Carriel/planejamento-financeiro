import type { Categoria, TipoTransacao } from '../tipos';

/// Catálogo básico de categorias.
///
/// Os nomes são exatamente os mesmos do aplicativo Flutter — os dois gravam a
/// categoria como texto no documento da transação, então mudar um nome aqui
/// deixaria os lançamentos antigos órfãos. Ficam no código, e não no Firestore,
/// para a lista aparecer na hora, sem leitura extra.
///
/// O usuário pode acrescentar categorias próprias na tela Categorias; elas vêm
/// de `usuarios/{uid}/categorias` e entram nesta mesma lista.

interface CategoriaBase {
  nome: string;
  emoji: string;
  cor: string;
}

const ENTRADAS: CategoriaBase[] = [
  { nome: 'Salário', emoji: '💼', cor: '#0B7A5D' },
  { nome: 'Freelance', emoji: '💻', cor: '#12866F' },
  { nome: 'Vendas', emoji: '🏷️', cor: '#1E7A86' },
  { nome: 'Investimentos', emoji: '📈', cor: '#2A6E9B' },
  { nome: 'Presente', emoji: '🎁', cor: '#4B6BA8' },
  { nome: 'Reembolso', emoji: '↩️', cor: '#5C7D5A' },
  { nome: 'Outras entradas', emoji: '➕', cor: '#6B7A88' },
];

const SAIDAS: CategoriaBase[] = [
  { nome: 'Moradia', emoji: '🏠', cor: '#9E2A4F' },
  { nome: 'Alimentação', emoji: '🍽️', cor: '#B23A4A' },
  { nome: 'Mercado', emoji: '🛒', cor: '#C0503C' },
  { nome: 'Transporte', emoji: '🚌', cor: '#A85A2B' },
  { nome: 'Saúde', emoji: '❤️', cor: '#8E2F6B' },
  { nome: 'Educação', emoji: '🎓', cor: '#6D3B8E' },
  { nome: 'Lazer', emoji: '🎮', cor: '#4F3E9B' },
  { nome: 'Assinaturas', emoji: '📺', cor: '#3F4A93' },
  { nome: 'Contas', emoji: '🧾', cor: '#7A4B2A' },
  { nome: 'Roupas', emoji: '👕', cor: '#B4791C' },
  { nome: 'Dívidas', emoji: '💳', cor: '#7C2D2D' },
  { nome: 'Outras saídas', emoji: '➖', cor: '#6B7A88' },
];

function paraCategoria(base: CategoriaBase, tipo: TipoTransacao): Categoria {
  return {
    id: `base:${tipo}:${base.nome}`,
    nome: base.nome,
    tipo,
    emoji: base.emoji,
    cor: base.cor,
    personalizada: false,
  };
}

export const CATEGORIAS_BASE: Categoria[] = [
  ...ENTRADAS.map((base) => paraCategoria(base, 'entrada')),
  ...SAIDAS.map((base) => paraCategoria(base, 'saida')),
];

export function categoriasBaseDoTipo(tipo: TipoTransacao): Categoria[] {
  return CATEGORIAS_BASE.filter((categoria) => categoria.tipo === tipo);
}

/// Cor estável para categorias que não estão no catálogo — lançamentos antigos
/// ou gravados por outra versão do app. Deriva do nome, então a mesma categoria
/// recebe sempre a mesma cor, sem precisar guardar nada.
export function corDerivadaDoNome(nome: string): string {
  let soma = 0;
  for (let i = 0; i < nome.length; i += 1) {
    soma = (soma * 31 + nome.charCodeAt(i)) % 360;
  }
  return `hsl(${soma} 42% 38%)`;
}

/// Paleta oferecida ao criar uma categoria — as mesmas famílias de cor do
/// catálogo, para uma categoria nova não destoar do resto da tela.
export const PALETA_DE_CORES: string[] = [
  '#0B7A5D',
  '#12866F',
  '#1E7A86',
  '#2A6E9B',
  '#4B6BA8',
  '#4F3E9B',
  '#6D3B8E',
  '#8E2F6B',
  '#9E2A4F',
  '#B23A4A',
  '#C0503C',
  '#A85A2B',
  '#B4791C',
  '#5C7D5A',
  '#7A4B2A',
  '#6B7A88',
];

/// Emojis sugeridos no formulário de categoria. Emoji em vez de biblioteca de
/// ícones: nada para instalar, e o usuário escolhe qualquer um que o teclado
/// dele produzir.
export const EMOJIS_SUGERIDOS: string[] = [
  '💰', '💵', '💳', '🏦', '📈', '📉', '🎯', '🏠',
  '🚗', '⛽', '🍽️', '☕', '🛒', '💊', '🏥', '🎓',
  '📚', '🎮', '🎬', '✈️', '🏖️', '🐶', '🎁', '🔧',
  '💡', '📱', '👕', '💅', '🏋️', '⚽', '🧾', '📌',
];
