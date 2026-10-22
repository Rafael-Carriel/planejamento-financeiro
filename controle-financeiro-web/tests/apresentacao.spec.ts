import {test,expect,navegar} from './fixtures';
import {autenticar} from './support/autenticacao';
import {join} from 'node:path';

async function contraste(page:import('@playwright/test').Page,selector:string){
  return page.locator(selector).first().evaluate(el=>{
    const luminancia=(c:string)=>{const rgb=(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const fg=luminancia(getComputedStyle(el).color);let parent:Element|null=el;let bg='';
    while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}
    const b=luminancia(bg);return (Math.max(fg,b)+.05)/(Math.min(fg,b)+.05);
  });
}
for(const width of [320,390,768,1440]){
  test(`entrada, planos, perfil e SAC legíveis nos dois temas em ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('/');
    await expect(page.getByRole('img',{name:'Logo Planeora'})).toBeVisible();
    const marca=page.locator('.entrada-marca-texto');await expect(marca).toContainText('Planeora');
    await expect(page.getByRole('button',{name:'Instalar aplicativo',exact:true})).toBeVisible();
    await autenticar(page);await navegar(page,'/assinatura');
    const mais=page.getByRole('button',{name:/Plano Mais: 80 inserções/});await mais.click();
    await expect(mais).toHaveAttribute('aria-pressed','true');await expect(page.locator('.checkout-preco')).toContainText('40,00');
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
    for(const tema of ['light','dark']){
      // Toggle through the same user-facing control used in production.
      const atual=await page.locator('html').getAttribute('data-theme');
      if(atual!==tema)await page.getByRole('button',{name:tema==='dark'?'Ativar tema escuro':'Ativar tema claro'}).filter({visible:true}).click();
      expect(await contraste(page,'.checkout-preco')).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.evaluate(()=>window.scrollTo(0,0));
      if(process.env.PLANEJA_PREVIEW_DIR&&width===1440)await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`planos-${tema}.png`),fullPage:true});
      const conta=page.getByRole('button',{name:width>940?'Abrir configurações da conta':'Sua conta',exact:true});await conta.click();
      await expect(page.getByRole('tab',{name:'Perfil',exact:true})).toBeVisible();
      await page.getByRole('tab',{name:'Perfil',exact:true}).press('ArrowRight');
      await expect(page.getByRole('tab',{name:'E-mail',exact:true})).toHaveAttribute('aria-selected','true');
      expect(await contraste(page,'.conta-abas button[aria-selected=true]')).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('tab',{name:'Segurança',exact:true}).click();await expect(page.getByPlaceholder('Mínimo 6 caracteres')).toBeVisible();
      if(process.env.PLANEJA_PREVIEW_DIR&&width===390)await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`conta-${tema}.png`)});
      await page.getByRole('button',{name:'Fechar',exact:true}).first().click();
      await navegar(page,'/atendimento');
      await expect(page.getByRole('heading',{name:'SAC do Planeora'})).toBeVisible();
      expect(await contraste(page,'.documento-legal h1')).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(page,'.acoes-publicas a')).toBeGreaterThanOrEqual(4.5);
      expect(await contraste(page,'.sac-chamados p')).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',tema);
      if(process.env.PLANEJA_PREVIEW_DIR&&width===390)await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`sac-${tema}.png`),fullPage:true});
      await navegar(page,'/assinatura');
    }
  });
}

test('instalação mostra instruções honestas e usa convite nativo quando disponível',async({page})=>{
  await page.goto('/');const botao=page.getByRole('button',{name:'Instalar aplicativo',exact:true});await botao.click();
  await expect(page.getByText('Leve o Planeora com você')).toBeVisible();await expect(page.getByText('iPhone e iPad:',{exact:true})).toBeVisible();
  await page.evaluate(()=>{const evento=new Event('beforeinstallprompt',{cancelable:true});Object.assign(evento,{prompt:()=>{document.body.dataset.conviteInstalacao='aberto';return Promise.resolve();},userChoice:Promise.resolve({outcome:'dismissed'})});window.dispatchEvent(evento);});
  await botao.click();await expect(page.locator('body')).toHaveAttribute('data-convite-instalacao','aberto');
  await expect(botao).toBeEnabled();
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('button',{name:'Aplicativo instalado'})).toBeDisabled();
});

for(const width of [320,1440]){
  test(`instalação acessível pelo menu sem aviso no painel em ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await autenticar(page);
    await expect(page.getByRole('region',{name:'Aplicativo Planeora'})).toHaveCount(0);
    if(width<940){
      await page.getByRole('button',{name:'Mais opções'}).click();
      await page.getByRole('menuitem',{name:'Instalar aplicativo',exact:true}).click();
    }else await page.getByRole('link',{name:'Instalar aplicativo',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Instalar Planeora',exact:true})).toBeVisible();
    const chamada=page.getByRole('region',{name:'Aplicativo Planeora'});
    await expect(chamada.getByRole('button',{name:'Instalar aplicativo',exact:true})).toBeVisible();
    await expect(chamada.getByText('iPhone e iPad:',{exact:true})).toBeVisible();
    await expect(chamada.getByText('Computador:',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(process.env.PLANEJA_PREVIEW_DIR)await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`instalar-planeora-${width}.png`)});
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
    await expect(chamada.getByRole('button',{name:'Aplicativo instalado'})).toBeDisabled();
    await navegar(page,'/');await expect(chamada).toHaveCount(0);
  });
}
