import { test, expect, navegar } from './fixtures';
import { autenticar } from './support/autenticacao';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => { await autenticar(page); });

test('explica cota mensal, plano ilimitado e não permite cobrar sem integração', async ({ page }) => {
  await navegar(page, '/assinatura');
  await expect(page.getByRole('heading', { name: 'Sua assinatura' })).toBeVisible();
  await expect(page.getByText('Registre sem contar lançamentos', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar para pagamento' })).toBeDisabled();
  await expect(page.getByText(/A cota renova no primeiro dia/)).toBeVisible();
  await expect(page.locator('.checkout-preco')).toContainText('19,90');
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
