import { test, expect } from './fixtures';
import { LancamentosPage } from './pages/LancamentosPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import { autenticar } from './support/autenticacao';

/// Relatórios: período, estado vazio e exportação em PDF.
///
/// O PDF é gerado de verdade pelo jsPDF a partir dos lançamentos do banco em
/// memória; só o download é observado, para não deixar arquivos no repositório.

test.describe('Relatórios', () => {
  test.beforeEach(async ({ page }) => {
    await autenticar(page);
  });

  test('abre a página com o seletor de período', async ({ page }) => {
    const relatorios = new RelatoriosPage(page);

    await relatorios.abrir();

    await expect(relatorios.titulo).toBeVisible();
    await expect(relatorios.seletorPeriodo).toBeVisible();
    await expect(relatorios.opcoesDePeriodo()).toHaveCount(3);
    await expect(relatorios.opcoesDePeriodo()).toHaveText(['3 meses', '6 meses', '12 meses']);
  });

  test('troca o período analisado', async ({ page }) => {
    const relatorios = new RelatoriosPage(page);

    await relatorios.abrir();
    await relatorios.selecionarPeriodo(12);

    await expect(page.getByText('Análise dos últimos 12 meses')).toBeVisible();
  });

  test('mostra estado vazio e desabilita a exportação sem lançamentos', async ({ page }) => {
    const relatorios = new RelatoriosPage(page);

    await relatorios.abrir();

    await expect(relatorios.estadoVazio).toBeVisible();
    await expect(relatorios.botaoExportar).toBeDisabled();
  });

  test('exporta o relatório em PDF quando há lançamentos', async ({ page }) => {
    const lancamentos = new LancamentosPage(page);
    const relatorios = new RelatoriosPage(page);

    await lancamentos.abrir('saida');
    await lancamentos.criar({ descricao: 'Aluguel E2E', valor: '1850,00' });

    await relatorios.abrir();
    await expect(relatorios.botaoExportar).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      relatorios.botaoExportar.click(),
    ]);

    expect(download.suggestedFilename()).toBe('relatorio-financeiro.pdf');
  });
});
