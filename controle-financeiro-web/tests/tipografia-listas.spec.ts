import { test, expect, navegar } from './fixtures';
import { autenticar } from './support/autenticacao';
import { semearFirestore } from './support/mocks';
import { join } from 'node:path';
for (const width of [320,390,768,1440]) {
 test(`listas preenchidas sem sobreposição em ${width}px`,async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00Z'));
  await page.setViewportSize({width,height:900});
  await semearFirestore(page,[
   {path:'usuarios/e2e-ana.teste/transacoes/conta',data:{descricao:'Empréstimo para reforma e despesas da casa',tipo:'saida',valor:120.91,categoria:'Dívidas',data:{__date:'2026-11-04T12:00:00Z'}}},
   {path:'usuarios/e2e-ana.teste/recorrencias/emprestimo',data:{descricao:'Empréstimo para reforma e despesas da casa',tipo:'saida',valor:156.34,categoria:'Dívidas',diaDoMes:1,inicio:{__date:'2026-11-01T12:00:00Z'},parcelas:17,ativa:true,modoLancamento:'confirmar'}},
   {path:'usuarios/e2e-ana.teste/recorrencias/salario',data:{descricao:'Salário',tipo:'entrada',valor:4200.80,categoria:'Salário',diaDoMes:5,inicio:{__date:'2026-11-01T12:00:00Z'},ativa:true,modoLancamento:'confirmar'}}
  ]);
  await autenticar(page);
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.fonts.check('750 16px "Planeora Sans"'))).toBe(true);
  for (const [rota,titulo] of [['/','Painel'],['/recorrencias','Recorrências'],['/previsao','Previsão']]) {
   await navegar(page,'#'+rota);await expect(page.locator('h1')).toHaveText(titulo);
   await expect(page.locator('.lancamento').first()).toBeVisible();
   const problemas=await page.locator('.lancamento').evaluateAll(rows=>rows.flatMap(row=>{
    const nodes=[...row.querySelectorAll(':scope > .lancamento-selo,:scope > .lancamento-textos,:scope > .lancamento-valor,:scope > .lancamento-acoes,:scope > .lancamento-acao')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().height);
    const erros:string[]=[];
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
     const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();
     if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)erros.push(nodes[i].className+' / '+nodes[j].className);
    }return erros;
   }));expect(problemas,rota).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(process.env.PLANEJA_PREVIEW_DIR&&width===390){
    const alvo=rota==='/previsao'?page.locator('.previsao-mes-cabeca').first().locator('..'):rota==='/'?page.locator('.cartao').filter({hasText:'Últimos lançamentos'}).last():page.locator('.grade-resumo');
    await alvo.screenshot({path:join(process.env.PLANEJA_PREVIEW_DIR,`tipografia-${titulo}.png`),animations:'disabled'});
   }
  }
  await navegar(page,'#/previsao');
  const selecao=page.getByRole('checkbox',{name:/Selecionar Empréstimo/}).last();
  await selecao.check();await expect(selecao).toBeChecked();
 });
}
