import { test, expect } from './fixtures';
import { LancamentosPage } from './pages/LancamentosPage';
import { autenticar } from './support/autenticacao';

/// Lançamentos: o CRUD de receitas e despesas.
///
/// As escritas vão para o banco em memória do dublê do Firestore, e a lista é
/// atualizada pela mesma assinatura em tempo real (`onSnapshot`) que o app usa
/// em produção — ou seja, o teste exercita o fluxo de tela de ponta a ponta.

test.describe('Lançamentos', () => {
  test.beforeEach(async ({ page }) => {
    await autenticar(page);
  });

  test('mostra o estado vazio quando não há despesas', async ({ page }) => {
    const lancamentos = new LancamentosPage(page);

    await lancamentos.abrir('saida');

    await expect(lancamentos.estadoVazio('saida')).toBeVisible();
  });

  test('valida a descrição obrigatória ao lançar', async ({ page }) => {
    const lancamentos = new LancamentosPage(page);

    await lancamentos.abrir('saida');
    await lancamentos.abrirFormulario();
    await lancamentos.salvar();

    await expect(lancamentos.errorDeValidacao()).toHaveText(
      'Escreva uma descrição para reconhecer o lançamento depois.',
    );
  });

  test('cria, edita e exclui uma despesa', async ({ page }) => {
    const lancamentos = new LancamentosPage(page);

    await lancamentos.abrir('saida');
    await lancamentos.criar({ descricao: 'Mercado E2E', valor: '123,45' });

    const item = lancamentos.item('Mercado E2E');
    await expect(item).toBeVisible();
    await expect(item).toContainText(/123,45/);

    await lancamentos.editar('Mercado E2E');
    await lancamentos.campoValor.fill('200,00');
    await lancamentos.confirmarEdicao();

    await expect(lancamentos.item('Mercado E2E')).toContainText(/200,00/);

    await lancamentos.excluir('Mercado E2E');

    await expect(lancamentos.item('Mercado E2E')).toHaveCount(0);
    await expect(lancamentos.estadoVazio('saida')).toBeVisible();
  });

  test('cria uma receita e mostra o total que entrou', async ({ page }) => {
    const lancamentos = new LancamentosPage(page);

    await lancamentos.abrir('entrada');
    await lancamentos.criar({ descricao: 'Freelance E2E', valor: '500,00' });

    await expect(lancamentos.item('Freelance E2E')).toBeVisible();
    await expect(page.getByText('Total que entrou')).toBeVisible();
    await expect(page.getByText(/500,00/).first()).toBeVisible();
  });
});
