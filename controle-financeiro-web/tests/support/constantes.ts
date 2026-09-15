/// Constantes compartilhadas pelos testes E2E.
///
/// As credenciais são fictícias: o dublê de autenticação (ver
/// `tests/support/mocks/firebaseAuth.ts`) aceita qualquer e-mail e qualquer
/// senha com 6 caracteres ou mais. Nunca há contato com o Firebase real.
/// Podem ser sobrescritas pelas variáveis `E2E_EMAIL` / `E2E_SENHA`.

export const USUARIO_DE_TESTE = {
  nome: process.env.E2E_NOME ?? 'Ana Teste',
  email: process.env.E2E_EMAIL ?? 'ana.teste@planejamento.local',
  senha: process.env.E2E_SENHA ?? 'senha-de-teste',
} as const;

/// Rota (hash do HashRouter) de cada tela usada nos testes.
export const ROTAS = {
  painel: '#/',
  receitas: '#/receitas',
  despesas: '#/despesas',
  relatorios: '#/relatorios',
} as const;
