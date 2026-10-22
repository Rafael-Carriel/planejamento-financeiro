import {test,expect,navegar} from './fixtures';
import {autenticar} from './support/autenticacao';
import {readFile} from 'node:fs/promises';
import {semearFirestore} from './support/mocks';
test('documentos legais são públicos e o nome é Planeora',async({page})=>{
  await page.goto('/#/politica-de-privacidade');
  await expect(page.getByRole('heading',{name:'Política de Privacidade',exact:true})).toBeVisible();
  await expect(page.getByText(/Atendimento do Planeora/)).toBeVisible();
  await page.getByRole('link',{name:'Termos de Uso',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Termos de Uso',exact:true})).toBeVisible();
  await expect(page).toHaveTitle('Planeora');
});
test('cadastro exige aceite expresso dos termos',async({page})=>{
  await page.goto('/#/entrar');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Pessoa Teste');
  await page.getByLabel('E-mail',{exact:true}).fill('teste@example.invalid');
  await page.getByLabel(/^Senha/).fill('senha-ficticia-123');
  await page.getByRole('button',{name:'Criar conta e começar'}).click();
  await expect(page.getByText('Leia e aceite os Termos de Uso para criar a conta.')).toBeVisible();
});
test('titular baixa dados e registra pedido sem apagar a conta',async({page})=>{
  await autenticar(page); await navegar(page,'/privacidade');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Baixar meus dados'}).click();
  const download=await downloadPromise; const file=await download.path();
  const data=JSON.parse(await readFile(file!,'utf8'));
  expect(data.conta.uid).toBeTruthy(); expect(data.transacoes).toBeInstanceOf(Array);expect(data.aceitesLegais).toBeInstanceOf(Array);
  await page.getByLabel('Tipo de solicitação').selectOption('exclusao');
  await page.getByLabel('Mensagem opcional').fill('Solicitação de teste em banco simulado.');
  await page.getByRole('button',{name:'Registrar solicitação'}).click();
  await expect(page.getByRole('status')).toContainText('Solicitação recebida. Protocolo:');
  await expect(page.getByRole('status')).toContainText('não foi executada agora');
  await page.reload(); await expect(page.getByRole('heading',{name:'Privacidade e direitos'})).toBeVisible();
});

test('cadastro registra versão aceita e preserva nome e data após recarregar',async({page})=>{
  await page.goto('/#/entrar');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Pessoa Cadastro');
  await page.getByLabel('E-mail',{exact:true}).fill('cadastro@example.invalid');
  await page.getByLabel(/^Senha/).fill('senha-ficticia-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Criar conta e começar'}).click();
  await expect(page.getByRole('heading',{name:'Painel',exact:true})).toBeVisible();
  async function exportar(){
    await navegar(page,'/privacidade');
    const promise=page.waitForEvent('download'); await page.getByRole('button',{name:'Baixar meus dados'}).click();
    const download=await promise; return JSON.parse(await readFile((await download.path())!,'utf8'));
  }
  const before=await exportar();
  expect(before.perfil.nome).toBe('Pessoa Cadastro');
  expect(before.aceitesLegais[0]).toMatchObject({versao:'2026-10-20',termosAceitos:true,privacidadeLida:true});
  // The in-memory SDK resets on reload; preserve the server-side profile as a seed.
  await semearFirestore(page,[{path:`usuarios/${before.conta.uid}`,data:{...before.perfil,criadoEm:{__date:before.perfil.criadoEm},atualizadoEm:{__date:before.perfil.atualizadoEm}}}]);
  await page.reload(); const after=await exportar();
  expect(after.perfil.nome).toBe(before.perfil.nome);expect(after.perfil.criadoEm).toEqual(before.perfil.criadoEm);
});

test('SAC público explica ajuda e permite acompanhar protocolo autenticado',async({page})=>{
  await page.goto('/#/atendimento');
  await expect(page.getByRole('heading',{name:'SAC do Planeora'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Entre na sua conta'})).toBeVisible();
  await autenticar(page); await navegar(page,'/atendimento');
  await page.getByLabel('Mensagem',{exact:true}).fill('Preciso de ajuda com um teste de atendimento.');
  await page.getByRole('button',{name:'Enviar atendimento',exact:true}).click();
  await expect(page.getByText(/Protocolo:/)).toBeVisible();
  await expect(page.getByText('Aguardando atendimento.')).toBeVisible();
});
