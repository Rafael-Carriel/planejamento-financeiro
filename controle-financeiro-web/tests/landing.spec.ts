import { test, expect } from './fixtures';
import { autenticar } from './support/autenticacao';
import { join } from 'node:path';

for (const width of [320,390,768,1440]) {
  test(`apresentação pública responsiva e cadastro em ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:950});
    await page.addInitScript(()=>localStorage.setItem('theme','dark'));
    await page.goto('/');
    await expect(page.getByRole('heading',{level:1,name:/O que entra/})).toBeVisible();
    expect(await page.locator('.landing h1').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(20, 43, 59)');
    await expect(page.locator('.lp-janela img')).toBeVisible();
    await expect(page.locator('.lp-janela img')).toHaveJSProperty('naturalWidth',1600);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Ver como funciona'}).click();
    await expect(page.getByRole('heading',{name:/Menos conta de cabeça/})).toBeInViewport();
    await page.locator('summary').filter({hasText:'Os 20 lançamentos grátis voltam todo mês?'}).click();
    await expect(page.getByText(/Não\. O limite é acumulado/)).toBeVisible();
    await expect(page.locator('.lp-planos article')).toHaveCount(4);
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
  await expect(page.getByRole('heading',{level:1,name:/O que entra/})).toBeVisible();
  await page.getByRole('link',{name:'Entrar',exact:false}).first().click();
  await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
});
