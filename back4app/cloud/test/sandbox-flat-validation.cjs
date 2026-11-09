'use strict';
// Explicit manual integration test. Never loaded by npm test and never targets production.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { Database } = require('./fake-db');
const { mount } = require('../routes');
const workspace = path.resolve(__dirname, '../../..');
const key = fs.readFileSync(path.join(workspace, 'work/.env.sandbox-validation'), 'utf8').trim().replace(/^ASAAS_API_KEY=/, '');
if (!key.startsWith('$aact_')) throw new Error('Missing sandbox key');
const gateway = async (route, method = 'GET', body, retry = false) => {
  calls.push({route,method});
  const response = await fetch('https://api-sandbox.asaas.com/v3' + route, { method,
    headers: { access_token: key, 'Content-Type': 'application/json', 'User-Agent': 'Planeja-QA/1.0' },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) });
  const data = response.status === 204 ? {} : response.headers.get('content-type')?.includes('application/pdf') ? (await response.arrayBuffer(), {}) : await response.json();
  if (response.status >= 500 && method === 'PUT' && !retry) return gateway(route, method, body, true);
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
    // Only synthetic QA entities are involved; never print credentials or customer responses.
    throw new Error(`${method} ${route}: HTTP ${response.status} ${JSON.stringify(data.errors?.map(e => ({ code: e.code, description: e.description })))}`);
  }
  return data;
};
const results = [];
const pass = name => { results.push({ name, result: 'PASS' }); console.log('PASS:', name); };
let customer, subscription;
const calls = [];
async function main() {
  const uid = `planeora-flat-qa-${Date.now()}`;
  customer = await gateway('/customers', 'POST', { name: uid, cpfCnpj: '24971563792', notificationDisabled: true, externalReference: uid });
  assert.equal(customer.notificationDisabled, true); pass('Cliente exclusivo de teste sem notificações');
  const db = new Database(), app = express(); let clock = new Date();
  const service = mount(app, {db, asaas:gateway, now:()=>clock,
    env:{USAGE_MODE:'lifetime',BILLING_MODEL:'flat-v1',ASAAS_ENV:'sandbox'},
    auth:{verifyIdToken:async token=>{assert.equal(token,uid);return {uid,email_verified:true};}}});
  await db.doc('billingSystem/config').set({enabled:true,usageMode:'lifetime',billingModel:'flat-v1'});
  await db.doc(`billingAccounts/${uid}`).set({customerId:customer.id});
  const api=(method,route,body)=>request(app)[method](`/billing${route}`).set('Authorization',`Bearer ${uid}`).send(body);
  const me=async()=>(await api('get','/me')).body;
  let response=await api('post','/checkout',{planId:'flat-v1',accepted:true});
  assert.equal(response.status,200,JSON.stringify(response.body));
  subscription=(await db.doc(`billingAccounts/${uid}`).get()).data().subscriptionId;
  assert.ok(subscription);assert.equal((await me()).unlimited,false);pass('Assinatura pendente mantém limite gratuito');
  response=await api('post','/checkout',{planId:'flat-v1',accepted:true});assert.equal(response.status,200);
  const subscriptions=await gateway(`/subscriptions?customer=${customer.id}&limit=100`);
  assert.equal(subscriptions.data.filter(s=>!s.deleted).length,1);pass('Repetição não duplica assinatura no provedor');
  let payment=(await gateway(`/subscriptions/${subscription}/payments?limit=100`)).data[0];
  assert.equal(payment.value,19.9);pass('Cobrança criada no Asaas por R$19,90');
  if(process.argv.includes('--card')) {
    // Approval card from https://docs.asaas.com/docs/faq-sandbox; never production.
    await assert.rejects(()=>gateway(`/payments/${payment.id}/payWithCreditCard`,'POST',{
      creditCard:{holderName:'Planeora QA',number:'5184019740373151',expiryMonth:'05',expiryYear:'2030',ccv:'123'},
      creditCardHolderInfo:{name:'Planeora QA',email:'qa@example.invalid',cpfCnpj:'24971563792',postalCode:'89223005',addressNumber:'277',phone:'4738010919'},remoteIp:'203.0.113.10'
    }),/HTTP 400/);
    await service.syncPayment(await gateway(`/payments/${payment.id}`));
    assert.equal((await me()).unlimited,false);
    pass('Cartão recusado não libera Ilimitado');
    await gateway(`/payments/${payment.id}/payWithCreditCard`,'POST',{
      creditCard:{holderName:'Planeora QA',number:'4444444444444444',expiryMonth:'05',expiryYear:'2030',ccv:'123'},
      creditCardHolderInfo:{name:'Planeora QA',email:'qa@example.invalid',cpfCnpj:'24971563792',postalCode:'89223005',addressNumber:'277',phone:'4738010919'},remoteIp:'203.0.113.10'
    });
  } else {
    await gateway(`/payments/${payment.id}`,'PUT',{billingType:'PIX'});
    await gateway(`/sandbox/payment/${payment.id}/confirm`,'POST',{});
  }
  payment=await gateway(`/payments/${payment.id}`);await service.syncPayment(payment);
  assert.equal((await me()).unlimited,true);assert.equal((await me()).limit,null);pass('Confirmação do Asaas libera Ilimitado');
  for(let i=0;i<55;i++)assert.equal((await api('post','/transactions',{id:`qa-${i}`,data:{descricao:'QA',tipo:'saida',categoria:'Outros',valor:1,data:clock.toISOString()}})).status,200);
  pass('Mais de 50 registros aceitos após confirmação');
  await service.syncPayment(payment);assert.equal((await me()).unlimited,true);pass('Reprocessamento preserva acesso sem duplicar pagamento');
  response=await api('post','/cancel',{});assert.equal(response.status,200);
  assert.equal((await me()).subscriptionId,null);assert.equal((await me()).unlimited,true);pass('Cancelamento no Asaas preserva período pago');
  const canceledSubscriptions=await gateway(`/subscriptions?customer=${customer.id}&limit=100`);
  assert.equal(canceledSubscriptions.data.filter(s=>!s.deleted&&s.status!=='INACTIVE').length,0);
  pass('Asaas sem assinatura ativa para gerar próxima renovação');
  const remaining=await gateway(`/payments?customer=${customer.id}&limit=100`);
  assert.equal(remaining.data.filter(p=>!p.deleted&&['PENDING','OVERDUE'].includes(p.status)).length,0);
  pass('Nenhuma cobrança pendente deixada após cancelamento');
  const retained=await gateway(`/payments/${payment.id}`);
  assert.ok(['RECEIVED','CONFIRMED'].includes(retained.status));
  assert.equal((retained.refunds||[]).length,0);
  assert.equal(calls.some(c=>c.route.endsWith('/refund')),false);
  pass('Cancelamento não solicita estorno e preserva cobrança paga');
  response=await api('post','/cancel',{});assert.equal(response.status,200);
  await service.syncPayment(retained);
  assert.equal((await me()).subscriptionId,null);assert.equal((await me()).unlimited,true);
  pass('Cancelar novamente e reconciliar não reativa renovação');
  const end=new Date((await me()).validUntil).getTime();
  clock=new Date(end-1);assert.equal((await me()).unlimited,true);
  clock=new Date(end);assert.equal((await me()).unlimited,false);assert.equal((await me()).limit,20);
  assert.equal((await db.collection(`usuarios/${uid}/transacoes`).get()).size,55);
  pass('Acesso termina na data exata sem excluir histórico');
  const data={descricao:'QA novo mes',tipo:'saida',categoria:'Outros',valor:1,data:clock.toISOString()};
  for(let i=0;i<20;i++)assert.equal((await api('post','/transactions',{id:`free-${i}`,data})).status,200);
  assert.equal((await api('post','/transactions',{id:'free-blocked',data})).status,402);
  pass('Após vencimento: 20 registros gratuitos, 21º bloqueado');

}
main().catch(error=>{results.push({name:'Integração',result:'FAIL',message:error.message});console.error(error.message);process.exitCode=1;}).finally(async()=>{
  try{if(subscription)await gateway(`/subscriptions/${subscription}`,'DELETE');if(customer)await gateway(`/customers/${customer.id}`,'DELETE');pass('Entidades exclusivas do teste arquivadas');}
  catch(error){results.push({name:'Limpeza',result:'FAIL',message:error.message});process.exitCode=1;}
  fs.writeFileSync(path.join(workspace,process.argv.includes('--card')?'analises/Validacao-Asaas-Ilimitado-Cartao.json':'analises/Validacao-Asaas-Ilimitado.json'),JSON.stringify({at:new Date().toISOString(),environment:'sandbox',results},null,2));
});
