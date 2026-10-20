import { test, expect, navegar } from './fixtures';
import { autenticar } from './support/autenticacao';
import { LancamentosPage } from './pages/LancamentosPage';

test.skip(!process.env.E2E_BILLING, 'Executar separadamente com integração fictícia configurada.');
const state = { enabled: true, environment: 'sandbox', usageMode: 'lifetime', admin: false,
  count: 20, period: 'total', blocks: 0, limit: 20, monthlyPrice: 0, validUntil: null,
  subscriptionId: null, canceled: false, payments: [] };

test('repete criação com o mesmo identificador após resposta perdida', async ({ page }) => {
  const ids: string[] = [];
  await page.route('https://billing.example.invalid/functions/*', async route => {
    const data = route.request().postDataJSON();
    expect(data.firebaseToken).toBe('token-e2e');
    if (route.request().url().endsWith('/planejaCreateTransaction')) {
      ids.push(data.data.id);
      await route.fulfill({ status: ids.length === 1 ? 503 : 200, json: ids.length === 1 ? { error: 'Resposta perdida. Tente novamente.' } : { result: { ok: true } } });
    } else await route.fulfill({ json: { result: state } });
  });
  await autenticar(page);
  const entries = new LancamentosPage(page);
  await entries.abrir('saida'); await entries.abrirFormulario();
  await entries.preencher({ descricao: 'Teste repetição', valor: '10' });
  await entries.salvar();
  await expect(page.getByText('Resposta perdida. Tente novamente.', { exact: true })).toBeVisible();
  await entries.salvar(); await expect(entries.modal).toBeHidden();
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
});

test('checkout exige aceite e disponibiliza somente link seguro retornado', async ({ page }) => {
  let checkout: unknown;
  await page.route('https://billing.example.invalid/functions/*', async route => {
    if (route.request().url().endsWith('/planejaCheckout')) {
      checkout = route.request().postDataJSON().data;
      await route.fulfill({ json: { result: { orderId: 'qa-order', url: 'https://sandbox.asaas.com/i/qa', pending: false } } });
    } else await route.fulfill({ json: { result: state } });
  });
  await autenticar(page); await navegar(page, '/assinatura');
  const button = page.getByRole('button', {name:'Continuar para pagamento'});
  await expect(button).toBeDisabled();
  await page.getByLabel('CPF ou CNPJ para cobrança').fill('24971563792');
  await page.getByRole('checkbox').check(); await button.click();
  await expect(page.getByRole('link', { name: /Abrir pagamento no Asaas/ })).toHaveAttribute('href','https://sandbox.asaas.com/i/qa');
  expect(checkout).toMatchObject({blocks:1,accepted:true,cpfCnpj:'24971563792'});
});
