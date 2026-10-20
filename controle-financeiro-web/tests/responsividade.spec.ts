import { test, expect, navegar } from './fixtures';
import { autenticar } from './support/autenticacao';
import { join } from 'node:path';

for (const [width, height] of [[1024,600], [1280,720], [941,500]]) {
  test(`perfil e tema acessíveis no computador ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await autenticar(page);
    const perfil = page.getByRole('button', { name: 'Abrir configurações da conta' });
    const tema = page.getByRole('button', { name: /Ativar tema (claro|escuro)/ });
    await expect(perfil).toBeInViewport({ ratio: 1 });
    await expect(tema).toBeInViewport({ ratio: 1 });
    await page.getByRole('navigation', { name: 'Seções do app' }).getByRole('link', { name: 'Assinatura', exact: true }).click();
    await expect(perfil).toBeInViewport({ ratio: 1 });
    await tema.click();
    await perfil.click(); await expect(page.getByRole('heading', { name: 'Sua conta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (process.env.PLANEJA_PREVIEW_DIR && width === 1024) await page.screenshot({ path: join(process.env.PLANEJA_PREVIEW_DIR, 'responsivo-desktop.png'), animations: 'disabled' });
  });
}

for (const [width, height] of [[320,568], [390,844], [844,390], [940,600]]) {
  test(`perfil e tema disponíveis após rolar no celular ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await autenticar(page); await navegar(page, '/assinatura');
    const barra = page.locator('.tira-conta');
    const perfil = barra.getByRole('button', { name: 'Sua conta', exact: true });
    const tema = barra.getByRole('button', { name: /Ativar tema (claro|escuro)/ });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(perfil).toBeInViewport({ ratio: 1 }); await expect(tema).toBeInViewport({ ratio: 1 });
    await tema.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Mais opções' }).click();
    await page.getByRole('menuitem', { name: 'Perfil e configurações' }).click();
    await expect(page.getByRole('heading', { name: 'Sua conta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).first().click();
    if (process.env.PLANEJA_PREVIEW_DIR && width === 390) await page.screenshot({ path: join(process.env.PLANEJA_PREVIEW_DIR, 'responsivo-celular.png') });
  });
}
