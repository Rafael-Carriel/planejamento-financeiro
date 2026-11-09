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
let customer, subscription, waitingAuthorization = false;
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
    // Official Asaas sandbox example; synthetic test card, never production.
    await gateway(`/payments/${payment.id}/payWithCreditCard`,'POST',{
      creditCard:{holderName:'Planeora QA',number:'5162306219378829',expiryMonth:'05',expiryYear:'2030',ccv:'318'},
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
  const current=clock;clock=new Date(new Date((await me()).validUntil).getTime()+1000);
  assert.equal((await me()).unlimited,false);assert.equal((await me()).limit,20);pass('Expiração local do período conciliado retorna ao gratuito');clock=current;
  await new Promise(resolve=>setTimeout(resolve,15000));
  await gateway(`/payments/${payment.id}/refund`,'POST',{description:'Homologacao sandbox Planeora Ilimitado'});
  let refunded;
  for(let attempt=0;attempt<8;attempt++){
    refunded=await gateway(`/payments/${payment.id}`);
    if(refunded.status==='REFUNDED'||refunded.refunds?.some(r=>['DONE','AWAITING_CRITICAL_ACTION_AUTHORIZATION'].includes(r.status)))break;
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  await service.syncPayment(refunded);
  if(refunded.status==='REFUNDED'||refunded.refunds?.some(r=>r.status==='DONE')){
    assert.equal((await me()).unlimited,false);pass('Estorno concluído no Asaas revoga acesso');
  }else{
    results.push({name:'Estorno concluído no Asaas',result:'PENDING',status:refunded.status,refunds:refunded.refunds?.map(r=>({status:r.status}))});
    console.log('PENDING: estorno no provedor; não contado como aprovado');
  }
}
main().catch(error=>{results.push({name:'Integração',result:'FAIL',message:error.message});console.error(error.message);process.exitCode=1;}).finally(async()=>{
  try{if(subscription)await gateway(`/subscriptions/${subscription}`,'DELETE');if(customer)await gateway(`/customers/${customer.id}`,'DELETE');pass('Entidades exclusivas do teste arquivadas');}
  catch(error){results.push({name:'Limpeza',result:'FAIL',message:error.message});process.exitCode=1;}
  fs.writeFileSync(path.join(workspace,process.argv.includes('--card')?'analises/Validacao-Asaas-Ilimitado-Cartao.json':'analises/Validacao-Asaas-Ilimitado.json'),JSON.stringify({at:new Date().toISOString(),environment:'sandbox',results},null,2));
});
