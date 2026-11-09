import {test,expect,navegar} from './fixtures';
import {autenticar} from './support/autenticacao';
import {join} from 'node:path';
import {LancamentosPage} from './pages/LancamentosPage';

test('demonstração altera saldo fictício, reinicia e não cria movimentação',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/conheca');
  await expect(page.locator('.demo-saldo')).toBeVisible();
  if(process.env.PLANEJA_PREVIEW_DIR) { await page.locator('.lp-painel-real').evaluate((img:HTMLImageElement)=>img.decode()); await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,'nova-apresentacao-celular.png'),fullPage:true}); }
  await expect(page.locator('.demo-saldo')).toContainText('2.400,00');
  await page.getByRole('button',{name:'Registrar R$ 50 de mercado'}).click();
  await expect(page.locator('.demo-saldo')).toContainText('2.350,00');
  await expect(page.getByRole('button',{name:'Despesa registrada',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Recomeçar demonstração'}).click();
  await expect(page.locator('.demo-saldo')).toContainText('2.400,00');
  await autenticar(page);
  await expect(page.getByRole('button',{name:'Registrar minha primeira despesa'})).toBeVisible();
});

test('primeiro lançamento libera explicação do saldo e conclusão persiste',async({page})=>{
  await page.addInitScript(() => { (window as unknown as {__E2E_PERSIST__:boolean}).__E2E_PERSIST__ = true; });
  await autenticar(page);
  await expect(page.getByRole('button',{name:'Entendi meu saldo'})).toBeDisabled();
  if(process.env.PLANEJA_PREVIEW_DIR) await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,'novo-primeiro-acesso.png'),fullPage:true});
  await page.getByRole('button',{name:'Registrar minha primeira despesa'}).click();
  const form=new LancamentosPage(page);
  await form.preencher({descricao:'Mercado inicial',valor:'50'});
  await form.salvar();await expect(form.modal).toBeHidden();
  await page.getByRole('button',{name:'Entendi meu saldo'}).click();
  await page.getByRole('button',{name:'Concluir guia'}).click();
  await expect(page.getByRole('heading',{name:'Comece pelo que importa'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Comece pelo que importa'})).toHaveCount(0);
  await navegar(page,'/despesas');
  await expect(page.getByText('Mercado inicial',{exact:true})).toBeVisible();
});
