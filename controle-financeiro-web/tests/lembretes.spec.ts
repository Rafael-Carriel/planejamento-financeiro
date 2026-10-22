import {test,expect,navegar} from './fixtures';
import {autenticar} from './support/autenticacao';
import {semearFirestore,type DocumentoSemeado} from './support/mocks';
import {USUARIO_DE_TESTE} from './support/constantes';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const uid=`e2e-${USUARIO_DE_TESTE.email.split('@')[0]}`;
const ts=(data:string)=>({__date:data});
const criada=ts('2026-10-01T12:00:00Z');
const sementes:DocumentoSemeado[]=[
  {path:`usuarios/${uid}/recorrencias/r1`,data:{descricao:'Aluguel de teste',valor:200,tipo:'saida',categoria:'Casa',diaDoMes:20,inicio:ts('2026-10-01T03:00:00Z'),parcelas:null,ativa:true,modoLancamento:'confirmar',automaticoDesde:null,automaticoAte:null,observacao:null,criadoEm:criada}},
  {path:`usuarios/${uid}/dividas/d1`,data:{descricao:'Cartão de teste',credor:'Credor fictício',valor:100,valorPago:20,dataVencimento:ts('2026-10-20T03:00:00Z'),observacao:null,criadoEm:criada}},
  {path:`usuarios/${uid}/transacoes/t1`,data:{descricao:'Mercado de teste',valor:80,tipo:'saida',categoria:'Casa',data:ts('2026-10-10T03:00:00Z'),recorrenciaId:null,observacao:null,criadoEm:criada}},
  {path:`usuarios/${uid}/orcamentos/2026-10`,data:{limites:{Casa:100},atualizadoEm:criada}},
];
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-21T15:00:00Z'));await semearFirestore(page,sementes);await autenticar(page);});

test('gera três avisos, preserva leitura e dispensa após recarregar, sem duplicar',async({page})=>{
  await navegar(page,'/lembretes');const lista=page.locator('.lista-lembretes');
  await expect(lista.getByRole('listitem')).toHaveCount(3);
  const sino=page.locator('.rodape-barra .botao-lembrete');await expect(sino).toHaveAccessibleName('3 lembretes não lidos');
  await lista.getByRole('listitem').filter({hasText:'Aluguel de teste'}).getByRole('button',{name:'Marcar como lido'}).click();
  await expect(sino).toHaveAccessibleName('2 lembretes não lidos');
  await lista.getByRole('listitem').filter({hasText:'Cartão de teste'}).getByRole('button',{name:'Dispensar'}).click();
  await expect(lista.getByRole('listitem')).toHaveCount(2);await expect(sino).toHaveAccessibleName('1 lembrete não lido');
  await navegar(page,'/privacidade');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar meus dados'}).click();
  const arquivo=await (await download).path();const dados=JSON.parse(await readFile(arquivo!,'utf8'));
  expect(dados.lembretes).toHaveLength(2);expect(dados.transacoes).toHaveLength(1);
  const estados=dados.lembretes.map((l:Record<string,unknown>)=>{const {id,...resto}=l;for(const chave of ['data','criadoEm','atualizadoEm'])if(typeof resto[chave]==='string')resto[chave]=ts(resto[chave] as string);return {path:`usuarios/${uid}/lembretes/${id}`,data:resto};});
  await semearFirestore(page,[...sementes,...estados]);await navegar(page,'/lembretes');await page.reload();
  await expect(lista.getByRole('listitem')).toHaveCount(2);await expect(sino).toHaveAccessibleName('1 lembrete não lido');
  await expect(lista.getByText(/Cartão de teste/)).toHaveCount(0);
});

test('pagamentos parciais somam e quitação remove aviso de dívida em tempo real',async({page})=>{
  await navegar(page,'/dividas');await page.getByRole('button',{name:'Registrar pagamento',exact:true}).click();
  await page.getByLabel('Valor pago (R$)').fill('30');await page.getByRole('button',{name:'Registrar',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await navegar(page,'/lembretes');
  await expect(page.getByRole('listitem').filter({hasText:'Cartão de teste'})).toContainText('50,00');
  await page.getByRole('listitem').filter({hasText:'Cartão de teste'}).getByRole('link',{name:'Ver detalhes'}).click();
  await page.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await page.getByLabel('Valor pago (R$)').fill('50');await page.getByRole('button',{name:'Registrar',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await navegar(page,'/lembretes');
  await expect(page.getByRole('listitem').filter({hasText:'Cartão de teste'})).toHaveCount(0);
});

test('histórico não troca o mês dos lembretes, ações cabem no celular e push foi removido',async({page})=>{
  await page.getByRole('button',{name:'Mês anterior'}).click();await navegar(page,'/lembretes');
  await expect(page.locator('.lista-lembretes').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('button',{name:/Ativar notificações|Desativar notificações|Ativar avisos/})).toHaveCount(0);
  await page.setViewportSize({width:320,height:568});
  await expect(page.locator('.tira-conta .botao-lembrete')).toHaveAccessibleName('3 lembretes não lidos');
  const ler=page.getByRole('button',{name:'Marcar como lido'}).first();await ler.scrollIntoViewIfNeeded();await expect(ler).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const meta=page.locator('.lista-lembretes .lancamento-meta').first();expect(await meta.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  if(process.env.PLANEJA_PREVIEW_DIR)await page.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,'lembretes-celular.png'),fullPage:true});
});
