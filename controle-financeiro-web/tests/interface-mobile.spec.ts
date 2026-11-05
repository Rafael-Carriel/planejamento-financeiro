import { test, expect } from './fixtures';
import { join } from 'node:path';
import { semearFirestore } from './support/mocks';
import { autenticar } from './support/autenticacao';
import { navegar } from './fixtures';

const rotas = {'/':'Painel', '/receitas':'Receitas', '/despesas':'Despesas', '/recorrencias':'Recorrências', '/dividas':'Dívidas', '/planejamento':'Planejamento', '/historico':'Histórico', '/relatorios':'Relatórios', '/categorias':'Categorias', '/objetivos':'Objetivos', '/reserva-emergencia':'Reserva de Emergência', '/atendimento':'Central de ajuda', '/instalar':'Aplicativo Planeora'};
for (const largura of [320, 360, 390, 768, 1440]) {
  test(`interface cabe em ${largura}px e mantém o SAC no aplicativo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await autenticar(page);
    for (const [rota, titulo] of Object.entries(rotas)) {
      await navegar(page, '#' + rota);
      await expect(page.locator('h1')).toHaveText(titulo);
      const medidas = await page.evaluate(() => ({ total: document.documentElement.scrollWidth, tela: document.documentElement.clientWidth }));
      expect(medidas.total, rota).toBeLessThanOrEqual(medidas.tela + 1);
    }
    await navegar(page, '#/atendimento');
    await expect(page.getByRole('heading', { name: 'Central de ajuda', exact: true })).toBeVisible();
    await expect(page.locator('.moldura')).toBeVisible();
    expect(page.context().pages()).toHaveLength(1);
    if (largura < 941) {
      await expect(page.locator('.barra-inferior-mobile')).toBeVisible();
      await expect(page.locator('.barra-inferior-mobile svg')).toHaveCount(5);
      const mais = page.getByRole('button', { name: 'Mais opções' });
      await mais.click();
      await expect(page.getByRole('menu', { name: 'Mais seções' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(mais).toBeFocused();
    }
  });
}

test('instalação usa o prompt real, trata cancelamento e confirma somente appinstalled', async ({ page }) => {
  await autenticar(page);
  await navegar(page, '#/instalar');
  await expect(page.getByRole('button', { name: 'Instalar Planeora', exact: true })).toHaveCount(0);
  await expect(page.getByText('A instalação direta ainda não foi disponibilizada por este navegador.')).toBeVisible();
  await page.evaluate(() => {
    const evento = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(evento, { prompt: async () => { document.documentElement.dataset.promptAberto = 'sim'; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(evento);
  });
  await page.getByRole('button', { name: 'Instalar Planeora', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-prompt-aberto', 'sim');
  await expect(page.getByRole('status').filter({ hasText: 'Instalação cancelada' })).toBeVisible();
  await page.evaluate(() => {
    const evento = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(evento, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(evento);
  });
  await page.getByRole('button', { name: 'Instalar Planeora', exact: true }).click();
  await expect(page.getByText('Pedido aceito. Aguarde o navegador concluir a instalação.')).toBeVisible();
  await expect(page.getByText('Aplicativo instalado neste dispositivo.')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByText('Aplicativo instalado neste dispositivo.')).toBeVisible();
});

test('SAC público continua acessível sem entrar', async ({ page }) => {
  await page.goto('/#/atendimento');
  await expect(page.getByRole('heading', { name: 'SAC do Planeora' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entre na sua conta' })).toBeVisible();
});

test('prévia visual com lançamentos demonstrativos', async ({ page }) => {
  test.skip(!process.env.PLANEJA_PREVIEW_DIR, 'Capturas opcionais de revisão visual');
  const mes = new Date();
  const data = new Date(mes.getFullYear(), mes.getMonth(), 5).toISOString();
  await semearFirestore(page, [
    { path: 'usuarios/e2e-ana.teste/transacoes/salario', data: { descricao:'Salário', valor:6200, tipo:'entrada', categoria:'Salário', data:{ __date:data }, criadoEm:{ __date:data } } },
    { path: 'usuarios/e2e-ana.teste/transacoes/mercado', data: { descricao:'Compras da semana', valor:385.90, tipo:'saida', categoria:'Mercado', data:{ __date:data }, criadoEm:{ __date:data } } },
    { path: 'usuarios/e2e-ana.teste/transacoes/aluguel', data: { descricao:'Aluguel', valor:1800, tipo:'saida', categoria:'Moradia', data:{ __date:data }, criadoEm:{ __date:data } } },
  ]);
  await page.setViewportSize({width:390,height:844});
  await autenticar(page);
  const destino = process.env.PLANEJA_PREVIEW_DIR!;
  for (const [rota, titulo, nome] of [['/','Painel','painel-mobile'], ['/atendimento','Central de ajuda','sac-mobile'], ['/instalar','Aplicativo Planeora','instalacao-mobile']]) {
    await navegar(page, '#' + rota);
    await expect(page.locator('h1')).toHaveText(titulo);
    await page.screenshot({path:join(destino,nome+'.png'),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Mais opções'}).click();
  await page.screenshot({path:join(destino,'menu-mobile.png'),animations:'disabled'});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});
  await navegar(page,'#/atendimento');
  await expect(page.locator('h1')).toHaveText('Central de ajuda');
  await page.screenshot({path:join(destino,'sac-desktop.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();
  await page.screenshot({path:join(destino,'sac-escuro.png'),animations:'disabled'});
});
