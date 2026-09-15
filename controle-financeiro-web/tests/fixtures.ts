import { test as base, expect, type Page } from '@playwright/test';

import { instalarMocks } from './support/mocks';

/// Fixture base dos testes E2E.
///
/// Toda página criada já vem com o SDK do Firebase substituído por dublês em
/// memória — o `mocks` é automático, então basta importar `test` daqui. Assim
/// é impossível um teste "esquecer" de instalar os dublês e acabar falando com
/// o Firebase de produção.

export const test = base.extend<{ mocks: void }>({
  mocks: [
    async ({ page }, use) => {
      await instalarMocks(page);
      await use();
    },
    { auto: true },
  ],
});

/// Navega alterando apenas o hash da URL.
///
/// Diferente de `page.goto`, isto não recarrega o documento, então a sessão do
/// dublê de autenticação e o banco em memória continuam vivos — exatamente como
/// a navegação real do app (HashRouter).

export async function navegar(page: Page, hash: string): Promise<void> {
  await page.evaluate((destino) => {
    window.location.hash = destino;
  }, hash);
}

export { expect };
