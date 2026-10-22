import { test, expect } from './fixtures';
import { autenticar } from './support/autenticacao';
import { join } from 'node:path';

for (const width of [320,390,768,1440]) {
  test(`apresentação pública responsiva e cadastro em ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:950});
    await page.addInitScript(()=>localStorage.setItem('theme','dark'));
    await page.goto('/');
    await expect(page.getByRole('heading',{level:1,name:/Tá tudo/})).toBeVisible();
    expect(await page.locator('.landing h1').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(23, 24, 25)');
    const saldo=page.getByLabel('Saldo da demonstração');
    await expect(saldo).toContainText('2.765,00');
    await page.getByRole('button',{name:/Rolou um freela/}).click();
    await expect(saldo).toContainText('1.915,00');
    await page.getByRole('button',{name:/Apareceu um imprevisto/}).click();
    await expect(saldo).toContainText('1.665,00');
    await page.getByRole('button',{name:/Rolou um freela/}).click();
    await page.getByRole('button',{name:/Apareceu um imprevisto/}).click();
    await expect(saldo).toContainText('2.765,00');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#por-dentro').scrollIntoViewIfNeeded();
    await expect(page.locator('.lp-tela-real img')).toHaveJSProperty('naturalWidth',1600);
    await page.getByRole('button',{name:'Celular',exact:true}).click();
    await expect(page.locator('.lp-tela-real img')).toHaveAttribute('src','/apresentacao/celular.webp');
    await page.getByRole('button',{name:'Computador',exact:true}).click();
    await page.locator('summary').filter({hasText:'Os 20 lançamentos grátis voltam todo mês?'}).click();
    await expect(page.getByText(/Não\. O limite é acumulado/)).toBeVisible();
    const planos=page.getByRole('group',{name:'Planos de lançamentos'});
    await expect(planos.getByRole('button')).toHaveCount(4);
    await planos.getByRole('button',{name:'80 no total'}).click();
    await expect(page.locator('.lp-preco-linha')).toContainText('40,00');
    await planos.getByRole('button',{name:'20 grátis'}).click();
    await expect(page.locator('.lp-preco-linha')).toContainText('0,00');
    await planos.getByRole('button',{name:'50 no total'}).click();
    if(process.env.PLANEJA_PREVIEW_DIR){
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`landing-${width}.png`),fullPage:true});
      await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`landing-abertura-${width}.png`)});
    }
    await page.getByRole('link',{name:'Começar grátis',exact:true}).click();
    await expect(page.getByRole('button',{name:'Criar conta e começar'})).toBeVisible();
    await expect(page.getByLabel('Nome',{exact:true})).toBeVisible();
  });
}
test('login funciona pela apresentação e sessão existente mantém o painel',async({page})=>{
  await page.goto('/');await page.getByRole('link',{name:'Entrar',exact:false}).first().click();
  await expect(page.getByLabel('E-mail',{exact:true})).toBeVisible();
  await autenticar(page);await page.goto('/');
  await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
  await page.goto('/#/conheca');
  await expect(page.getByRole('heading',{level:1,name:/Tá tudo/})).toBeVisible();
  await page.getByRole('link',{name:'Entrar',exact:false}).first().click();
  await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
});
