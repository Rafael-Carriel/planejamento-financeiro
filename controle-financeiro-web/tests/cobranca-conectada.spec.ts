import { test, expect, navegar } from './fixtures';
import { autenticar } from './support/autenticacao';
import { LancamentosPage } from './pages/LancamentosPage';

test.skip(!process.env.E2E_BILLING, 'Executar separadamente com integração fictícia configurada.');
const state = { enabled: true, environment: 'sandbox', usageMode: 'monthly', planVersion: 'flat-v1', unlimited: false, legacy: false, admin: false,
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
  await page.getByRole('checkbox').check();
  await button.click();
  await expect(page.getByRole('link', { name: /Abrir pagamento no Asaas/ })).toHaveAttribute('href','https://sandbox.asaas.com/i/qa');
  expect(checkout).toMatchObject({planId:'flat-v1',accepted:true,cpfCnpj:'24971563792'});
});
test('administrador vê acesso sem limite mesmo após 20 inserções',async({page})=>{
  await page.route('https://billing.example.invalid/functions/*',async route=>{await route.fulfill({json:{result:{...state,admin:true,count:50}}});});
  await autenticar(page);await navegar(page,'/assinatura');
  await expect(page.getByRole('heading',{name:'Acesso de administrador'})).toBeVisible();
  await expect(page.getByRole('progressbar',{name:'Lançamentos gratuitos utilizados no mês'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continuar para pagamento'})).toBeDisabled();
});

for (const situacao of ['PENDING', 'APPROVED']) {
  test(`diagnóstico administrativo distingue conexão de cadastro ${situacao}`, async ({ page }) => {
    await page.route('https://billing.example.invalid/functions/*', async route => {
      const nome = route.request().url().split('/').at(-1);
      const result = nome === 'planejaAsaasStatus'
        ? { connected: true, environment: 'production', account: { general: situacao,
          documentation: situacao, commercialInfo: 'APPROVED', bankAccountInfo: 'UNKNOWN' } }
        : nome === 'planejaAdminUsers' ? { users: [], nextCursor: null }
        : nome === 'planejaAdminPayments' ? { payments: [], nextCursor: null }
        : { ...state, admin: true };
      await route.fulfill({ json: { result } });
    });
    await autenticar(page); await navegar(page, '/admin');
    await page.getByRole('button', { name: 'Verificar conexão com o Asaas' }).click();
    const resultado = page.getByRole('status').filter({ hasText: 'Asaas conectado' });
    await expect(resultado).toContainText(situacao === 'PENDING'
      ? 'Cadastro geral: pendente' : 'Cadastro geral: aprovado');
    await expect(resultado).toContainText('não comprova a liquidação de um pagamento');
    if (situacao === 'PENDING') await expect(resultado).not.toContainText('Cadastro aprovado pelo Asaas');
  });
}

test('cancelar renovação mantém Ilimitado e informa fim do período pago',async({page})=>{
  let canceled=false;const operations:string[]=[];
  await page.route('https://billing.example.invalid/functions/*',async route=>{
    const operation=route.request().url().split('/').at(-1)!;operations.push(operation);
    if(operation==='planejaCancel'){canceled=true;await route.fulfill({json:{result:{ok:true}}});return;}
    await route.fulfill({json:{result:{...state,unlimited:true,limit:null,validUntil:'2026-12-08T03:00:00Z',subscriptionId:canceled?null:'sub-test',canceled,monthlyPrice:canceled?0:19.9}}});
  });
  await autenticar(page);await navegar(page,'/assinatura');
  await page.getByText('Cancelar renovação',{exact:true}).click();
  await expect(page.getByText(/cancelar não solicita estorno automático/)).toBeVisible();
  await page.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();
  await expect(page.getByText('Renovação cancelada. O acesso já pago continua até a data informada.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Ilimitado ativo',exact:true})).toBeVisible();
  await expect(page.getByText('Acesso pago até 08/12/2026.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmar cancelamento',exact:true})).toHaveCount(0);
  expect(operations.filter(o=>o==='planejaCancel')).toHaveLength(1);
  expect(operations.some(o=>/refund/i.test(o))).toBe(false);
});
