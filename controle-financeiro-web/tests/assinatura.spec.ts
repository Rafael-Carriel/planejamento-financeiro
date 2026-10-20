import { test, expect, navegar } from './fixtures';
import { autenticar } from './support/autenticacao';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => { await autenticar(page); });

test('explica consumo acumulado, faixas e não permite cobrar sem integração', async ({ page }) => {
  await navegar(page, '/assinatura');
  await expect(page.getByRole('heading', { name: 'Sua assinatura' })).toBeVisible();
  await expect(page.getByText('50 inserções acumuladas', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar para pagamento' })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Blocos de 30 inserções' }).fill('2');
  await expect(page.getByText('80 inserções acumuladas', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /40,00/ })).toBeVisible();
  if (process.env.PLANEJA_PREVIEW_DIR) await page.screenshot({ path: join(process.env.PLANEJA_PREVIEW_DIR, 'assinatura-preview.png'), fullPage: true });
});

test('admin não revela dados nem inventa pagamentos quando não está conectado', async ({ page }) => {
  await navegar(page, '/admin');
  await expect(page.getByRole('heading', { name: 'Administração' })).toBeVisible();
  await expect(page.getByText('Nenhuma cobrança disponível.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar dados' })).toBeDisabled();
  await expect(page.getByText('Conecte a integração', { exact: false })).toBeVisible();
  if (process.env.PLANEJA_PREVIEW_DIR) await page.screenshot({ path: join(process.env.PLANEJA_PREVIEW_DIR, 'administracao-preview.png'), fullPage: true });
});

test('assinatura cabe em tela de celular sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await navegar(page, '/assinatura');
  await expect(page.getByRole('heading', { name: 'Sua assinatura' })).toBeVisible();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
