import { expect, type Page } from '@playwright/test';

import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { USUARIO_DE_TESTE } from './constantes';

/// Faz login com a conta de teste e confirma que o painel carregou.
///
/// Usado no `beforeEach` das suítes que só têm interesse nas telas internas do
/// app; o fluxo de entrar/sair tem suíte própria (`auth.spec.ts`).

export async function autenticar(page: Page): Promise<void> {
  const login = new LoginPage(page);
  const painel = new DashboardPage(page);

  await login.abrir();
  await login.entrar(USUARIO_DE_TESTE.email, USUARIO_DE_TESTE.senha);
  await expect(painel.titulo).toBeVisible();
}
