import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/// Carrega `.env.test` sem depender de `dotenv`. As variáveis já definidas no
/// ambiente vencem o arquivo, então o CI pode sobrescrever o que precisar.
function carregarEnvDeTeste(): void {
  const caminho = resolve(process.cwd(), '.env.test');
  if (!existsSync(caminho)) return;

  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim();
    if (limpa.length === 0 || limpa.startsWith('#')) continue;

    const igual = limpa.indexOf('=');
    if (igual === -1) continue;

    const chave = limpa.slice(0, igual).trim();
    const valor = limpa.slice(igual + 1).trim();
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

carregarEnvDeTeste();

/// Configuração dos testes ponta a ponta (E2E) com Playwright.
///
/// O app é servido pelo Vite em modo `test` — o mesmo servidor de
/// desenvolvimento, mas carregando `.env.test`. Os testes **não** falam com o
/// Firebase real: o SDK é substituído por dublês em memória (ver
/// `tests/support/mocks`), então nenhuma chave ou dado de produção é tocado.
///
/// A porta é fixa (4173) e `strictPort` está ligado para que o Playwright falhe
/// cedo caso a porta esteja ocupada, em vez de testar contra outro servidor.

const PORTA = Number(process.env.E2E_PORT ?? 4173);
const URL_BASE = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  // Cada teste roda isolado; o app é determinístico por causa dos dublês.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: URL_BASE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      // Viewport alto o suficiente para a barra lateral inteira (o rodapé com
      // "Sair da conta" fica abaixo da dobra em telas de 720px).
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1200 } },
    },
  ],

  webServer: {
    command: 'node tests/support/servidor-e2e.mjs',
    url: URL_BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { E2E_PORT: String(PORTA) },
  },
});
