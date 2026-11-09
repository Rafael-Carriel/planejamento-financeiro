'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { Database } = require('./fake-db');
const { mount } = require('../routes');
const { randomUUID } = require('node:crypto');
const input = { descricao:'Mercado', valor:12, tipo:'saida', categoria:'Mercado', data:'2026-09-15T12:00:00Z' };
async function setup() {
  const db = new Database(), app = express(), calls = [], remote = new Map();
  let date = new Date('2026-11-07T12:00:00Z');
  const service = mount(app, { db, auth:{verifyIdToken:async token=>{if(!['user','owner'].includes(token))throw Error();return {uid:token,email:`${token}@example.test`,email_verified:true};}},
    env:{USAGE_MODE:'lifetime',BILLING_MODEL:'flat-v1',ADMIN_UIDS:'owner',ASAAS_ENV:'sandbox',ANALYTICS_ENABLED:'true'}, now:()=>date,
    asaas:async(path,method='GET',body)=>{calls.push({path,method,body});if(remote.has(path))return remote.get(path);throw Error(`Unexpected ${path}`);} });
  await db.doc('billingSystem/config').set({enabled:true,usageMode:'lifetime',billingModel:'flat-v1'});
  const api = (method,path,body,token='user')=>request(app)[method](`/billing${path}`).set('Authorization',`Bearer ${token}`).send(body);
  return {db,api,service,calls,remote,setDate:d=>date=new Date(d)};
}
test('gratuito renova pelo mês da criação em Brasília, não pela data financeira',async()=>{
  const {db,api,setDate}=await setup();
  for(let i=0;i<20;i++)assert.equal((await api('post','/transactions',{id:`t${i}`,data:input})).status,200);
  assert.equal((await api('post','/transactions',{id:'blocked',data:input})).status,402);
  db.rows.delete('usuarios/user/transacoes/t0');
  assert.equal((await api('post','/transactions',{id:'deleted',data:input})).status,402);
  setDate('2026-12-01T02:59:59Z');assert.equal((await api('get','/me')).body.count,20);
  setDate('2026-12-01T03:00:00Z');assert.equal((await api('get','/me')).body.count,0);
  assert.equal((await api('post','/transactions',{id:'december',data:input})).status,200);
});
test('última vaga mensal é atômica e repetição não consome cota',async()=>{
  const {api}=await setup();for(let i=0;i<19;i++)await api('post','/transactions',{id:`r${i}`,data:input});
  const result=await Promise.all(['a','b'].map(id=>api('post','/transactions',{id,data:input})));
  assert.deepEqual(result.map(r=>r.status).sort(),[200,402]);
  assert.equal((await api('post','/transactions',{id:'r0',data:input})).status,200);
  assert.equal((await api('get','/me')).body.count,20);
});
async function seedPaid(ctx) {
  await ctx.db.doc('billingAccounts/user').set({customerId:'cus',subscriptionId:'sub',subscriptionBlocks:1,subscriptionPlanVersion:'flat-v1'});
  await ctx.db.doc('billingOrders/order').set({uid:'user',kind:'subscription',blocks:1,value:19.9,planVersion:'flat-v1',customerId:'cus',subscriptionId:'sub'});
  return {id:'pay',customer:'cus',subscription:'sub',value:19.9,status:'CONFIRMED',dueDate:'2026-11-07',billingType:'PIX',invoiceUrl:'https://sandbox.asaas.com/i/pay'};
}
test('pagamento pendente não libera; confirmado libera além de 50; estorno revoga',async()=>{
  const ctx=await setup(), p=await seedPaid(ctx);
  await ctx.service.syncPayment({...p,status:'PENDING'});assert.equal((await ctx.api('get','/me')).body.unlimited,false);
  await ctx.service.syncPayment(p);assert.equal((await ctx.api('get','/me')).body.limit,null);
  for(let i=0;i<55;i++)assert.equal((await ctx.api('post','/transactions',{id:`p${i}`,data:input})).status,200);
  await ctx.service.syncPayment({...p,status:'REFUNDED'});assert.equal((await ctx.api('post','/transactions',{id:'refund',data:input})).status,402);
  assert.equal((await ctx.api('get','/me')).body.monthlyPrice,19.9);
});
test('valor ou cliente divergentes nunca liberam Ilimitado',async()=>{
  const ctx=await setup(),p=await seedPaid(ctx);
  await assert.rejects(()=>ctx.service.syncPayment({...p,value:20}),/Valor divergente/);
  await assert.rejects(()=>ctx.service.syncPayment({...p,customer:'other'}),/Cliente divergente/);
  assert.equal((await ctx.api('get','/me')).body.unlimited,false);
});
test('cancelamento preserva acesso pago, evento repetido não reativa, expiração volta à cota',async()=>{
  const ctx=await setup(),p=await seedPaid(ctx);ctx.remote.set('/subscriptions/sub',{});
  await ctx.service.syncPayment(p);await ctx.api('post','/cancel',{});await ctx.service.syncPayment(p);
  assert.equal(ctx.calls.some(c=>c.path.endsWith('/refund')),false);
  assert.equal(ctx.calls.filter(c=>c.method==='DELETE'&&c.path==='/subscriptions/sub').length,1);
  let a=(await ctx.api('get','/me')).body;assert.equal(a.unlimited,true);assert.equal(a.subscriptionId,null);assert.equal(a.monthlyPrice,0);
  ctx.setDate('2026-12-08T12:00:00Z');a=(await ctx.api('get','/me')).body;assert.equal(a.unlimited,false);assert.equal(a.limit,20);
});
test('assinante antigo mantém cota e preço e não é migrado no checkout',async()=>{
  const ctx=await setup();await ctx.db.doc('billingAccounts/user').set({subscriptionId:'legacy',subscriptionBlocks:3,blocks:3,validUntil:new Date('2026-12-07T03:00:00Z')});
  const a=(await ctx.api('get','/me')).body;assert.equal(a.legacy,true);assert.equal(a.limit,110);assert.equal(a.monthlyPrice,60);assert.equal(a.usageMode,'lifetime');
  assert.equal((await ctx.api('post','/checkout',{planId:'flat-v1',accepted:true})).status,409);assert.equal(ctx.calls.length,0);
});
test('novo cliente não consegue contratar oferta legada por chamada antiga',async()=>{
  const ctx=await setup();assert.equal((await ctx.api('post','/checkout',{blocks:1,accepted:true})).status,400);
});
test('checkout novo só cobra preço fixo e recupera pedido sem duplicar',async()=>{
  const ctx=await setup();await ctx.db.doc('billingAccounts/user').set({customerId:'cus'});
  ctx.remote.set('/subscriptions',{id:'sub'});ctx.remote.set('/subscriptions/sub/payments?limit=100',{data:[]});
  const body={planId:'flat-v1',accepted:true};assert.equal((await ctx.api('post','/checkout',body)).status,200);assert.equal((await ctx.api('post','/checkout',body)).status,200);
  const created=ctx.calls.filter(c=>c.method==='POST');assert.equal(created.length,1);assert.equal(created[0].body.value,19.9);
});
test('medição rejeita valores financeiros e eventos de pagamento forjados; deduplica visitas',async()=>{
  const {api,db}=await setup();const e={name:'landing_view',consent:true,visitor:randomUUID(),session:randomUUID(),device:'mobile',campaign:'teste'};
  assert.equal((await api('post','/events',{...e,valor:500})).status,400);
  assert.equal((await api('post','/events',{...e,name:'subscription_paid'})).status,400);
  assert.equal((await api('post','/events',{...e,consent:false})).status,400);
  await api('post','/events',e);await api('post','/events',e);
  assert.equal([...db.rows.keys()].filter(k=>k.startsWith('productEvents/')).length,1);
  assert.equal((await api('get','/admin/funnel')).status,403);
  assert.equal((await api('get','/admin/funnel',undefined,'owner')).body.totals.landing_view,1);
});
test('ativação exige três registros e retorno em outro dia em até sete dias',async()=>{
  const ctx=await setup();for(let i=0;i<3;i++)await ctx.api('post','/transactions',{id:`x${i}`,data:input});
  const e={name:'return_visit',consent:true,visitor:randomUUID(),session:randomUUID(),device:'mobile'};
  await ctx.api('post','/events',e);assert.equal((await ctx.api('get','/admin/funnel',undefined,'owner')).body.totals.activation_completed,undefined);
  ctx.setDate('2026-11-08T12:00:00Z');await ctx.api('post','/events',{...e,session:randomUUID()});
  assert.equal((await ctx.api('get','/admin/funnel',undefined,'owner')).body.totals.activation_completed,1);
});


test('confirmação repetida preserva a data da conversão após mudança de estado',async()=>{
  const ctx=await setup(), payment=await seedPaid(ctx);
  await ctx.service.syncPayment(payment);
  const before=(await ctx.db.collection('productEvents').get()).docs.find(d=>d.data().name==='subscription_paid').data().createdAt;
  ctx.setDate('2026-11-08T12:00:00Z');
  await ctx.service.syncPayment({...payment,status:'REFUNDED'});
  await ctx.service.syncPayment(payment);
  const events=(await ctx.db.collection('productEvents').get()).docs.filter(d=>d.data().name==='subscription_paid');
  assert.equal(events.length,1);assert.equal(new Date(events[0].data().createdAt).getTime(),new Date(before).getTime());
});
