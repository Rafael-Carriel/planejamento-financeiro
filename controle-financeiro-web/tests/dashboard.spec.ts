import { test, expect } from './fixtures';
import { DashboardPage } from './pages/DashboardPage';
import { LancamentosPage } from './pages/LancamentosPage';
import { autenticar } from './support/autenticacao';

/// Painel: a tela inicial depois do login.
///
/// Os cartões de resumo aparecem mesmo sem lançamentos (com zero), então dá
/// para verificar a estrutura da tela sem depender de dados semeados.

test.describe('Painel', () => {
  test.beforeEach(async ({ page }) => {
    await autenticar(page);
  });

  test('carrega o painel com os cartões de resumo', async ({ page }) => {
    const painel = new DashboardPage(page);

    await expect(painel.titulo).toBeVisible();
    await expect(painel.cartaoSaldo).toBeVisible();
    await expect(painel.cartaoEntradas).toBeVisible();
    await expect(painel.cartaoSaidas).toBeVisible();
    await expect(painel.cartaoLancamentos).toBeVisible();
  });

  test('mostra as ações rápidas de lançamento', async ({ page }) => {
    const painel = new DashboardPage(page);

    await expect(painel.botaoNovaReceita).toBeVisible();
    await expect(painel.botaoNovaDespesa).toBeVisible();
    await expect(painel.botaoPersonalizar).toBeVisible();
  });

  test('abre o formulário de nova despesa pelo atalho', async ({ page }) => {
    const painel = new DashboardPage(page);

    await painel.botaoNovaDespesa.click();

    const modal = page.getByRole('dialog');
    await expect(modal.getByRole('heading', { name: 'Novo lançamento' })).toBeVisible();
    await expect(modal.getByLabel('Descrição')).toBeVisible();
  });

  test('abre o formulário de nova receita pelo atalho', async ({ page }) => {
    const painel = new DashboardPage(page);
    const lancamentos = new LancamentosPage(page);

    await painel.botaoNovaReceita.click();

    await expect(lancamentos.modal).toBeVisible();
    await expect(lancamentos.modal.getByRole('button', { name: 'Entrada' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
