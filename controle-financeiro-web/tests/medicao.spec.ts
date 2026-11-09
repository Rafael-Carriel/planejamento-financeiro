import {test,expect} from './fixtures';

test.skip(!process.env.E2E_ANALYTICS, 'Executar com medição fictícia habilitada.');
test('medição exige escolha, filtra campanha e para depois da recusa',async({page})=>{
  const events:Record<string,unknown>[]=[];
  await page.route('https://billing.example.invalid/functions/*',async route=>{
    if(route.request().url().endsWith('/planejaEvent')) events.push(route.request().postDataJSON().data);
    await route.fulfill({json:{result:{accepted:true}}});
  });
  await page.goto('/?utm_source=teste&utm_campaign=email%40pessoa.com#/conheca');
  await expect(page.getByRole('button',{name:'Permitir medição'})).toBeVisible();
  expect(events).toHaveLength(0);
  await page.getByRole('button',{name:'Permitir medição'}).click();
  await expect.poll(()=>events.length).toBe(1);
  expect(events[0]).toMatchObject({name:'landing_view',consent:true,source:'teste'});
  expect(events[0]).not.toHaveProperty('campaign');
  await page.getByRole('button',{name:'Preferências de medição',exact:true}).click();
  await page.getByRole('button',{name:'Recusar medição'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('planeora-visitante'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button',{name:'Preferências de medição',exact:true})).toBeVisible();
  expect(events).toHaveLength(1);
});
