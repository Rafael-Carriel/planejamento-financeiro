import { test, expect, navegar } from './fixtures';
import { semearFirestore } from './support/mocks';
import { VERSAO_LEGAL } from '../src/legal';
import { join } from 'node:path';

for(const width of [320,1440]) {
  test(`Google exige aceite no primeiro acesso e cria perfil em ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:950});await page.goto('/#/entrar');
    const botao=page.getByRole('button',{name:'Continuar com o Google'});
    await expect(botao).toBeVisible();
    if(process.env.PLANEJA_PREVIEW_DIR) await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`google-login-${width}.png`)});
    await botao.click();
    await expect(page.getByRole('heading',{name:'Falta só uma confirmação'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Painel',exact:true})).toHaveCount(0);
    const confirmar=page.getByRole('button',{name:'Concordar e acessar o Planeora'});
    await expect(confirmar).toBeDisabled();
    await page.getByRole('checkbox').check();await confirmar.click();
    await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:width>940?'Abrir configurações da conta':'Sua conta'}).click();
    await expect(page.getByLabel(/^Nome/)).toHaveValue('Pessoa Google');
    await page.getByRole('tab',{name:'Segurança'}).click();
    await expect(page.getByText('O Planeora não recebe sua senha do Google.',{exact:false})).toBeVisible();
    await expect(page.getByPlaceholder('Sua senha atual')).toHaveCount(0);
    await page.getByRole('button',{name:'Fechar',exact:true}).first().click();
    if(width<940)await page.getByRole('button',{name:'Mais opções'}).click();
    await page.getByRole(width<940?'menuitem':'button',{name:'Sair da conta',exact:true}).click();
    await navegar(page,'/entrar');await page.getByRole('button',{name:'Continuar com o Google'}).click();
    await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Falta só uma confirmação'})).toHaveCount(0);
  });
}
test('Google preserva nome personalizado e histórico de usuário existente',async({page})=>{
  await semearFirestore(page,[{path:'usuarios/e2e-google',data:{nome:'Meu nome personalizado',email:'google@example.invalid',criadoEm:{__date:'2026-01-01T12:00:00Z'}}},
    {path:`usuarios/e2e-google/aceitesLegais/${VERSAO_LEGAL}`,data:{versao:VERSAO_LEGAL,termosAceitos:true,privacidadeLida:true}},
    {path:'usuarios/e2e-google/transacoes/antiga',data:{descricao:'Registro preservado',tipo:'entrada',valor:123,categoria:'Outros',data:{__date:'2026-10-20T12:00:00Z'}}}]);
  await page.goto('/#/entrar');await page.getByRole('button',{name:'Continuar com o Google'}).click();
  await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
  await expect(page.getByText('Registro preservado',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Abrir configurações da conta'}).click();
  await expect(page.getByLabel(/^Nome/)).toHaveValue('Meu nome personalizado');
});
for(const [codigo,texto] of [['auth/popup-closed-by-user','A entrada com Google foi cancelada'],['auth/popup-blocked','O navegador bloqueou a janela do Google'],['auth/account-exists-with-different-credential','Este e-mail já usa outra forma de acesso']]) {
  test(`Google trata ${codigo} sem criar sessão`,async({page})=>{
    await page.addInitScript(code=>{(window as unknown as {__E2E_GOOGLE_ERROR__:string}).__E2E_GOOGLE_ERROR__=code;},codigo);
    await page.goto('/#/entrar');await page.getByRole('button',{name:'Continuar com o Google'}).click();
    await expect(page.getByRole('alert')).toContainText(texto);
    await expect(page.getByRole('button',{name:'Continuar com o Google'})).toBeEnabled();
    await expect(page.getByRole('heading',{name:'Painel',exact:true})).toHaveCount(0);
  });
}
test('cadastro oferece Google sem exigir senha local',async({page})=>{
  await page.goto('/#/criar-conta');await page.getByRole('button',{name:'Continuar com o Google'}).click();
  await expect(page.getByRole('heading',{name:'Falta só uma confirmação'})).toBeVisible();
});
