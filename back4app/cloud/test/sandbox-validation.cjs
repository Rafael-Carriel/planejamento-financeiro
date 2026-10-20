'use strict';
// Explicit manual integration test. Never loaded by npm test and never targets production.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { Database } = require('./fake-db');
const { mount } = require('../routes');
const workspace = path.resolve(__dirname, '../../../..');
const key = fs.readFileSync(path.join(workspace, 'work/.env.sandbox-validation'), 'utf8').trim().replace(/^ASAAS_API_KEY=/, '');
if (!key.startsWith('$aact_')) throw new Error('Missing sandbox key');
const gateway = async (route, method = 'GET', body, retry = false) => {
  const response = await fetch('https://api-sandbox.asaas.com/v3' + route, { method,
    headers: { access_token: key, 'Content-Type': 'application/json', 'User-Agent': 'Planeja-QA/1.0' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
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
  if (process.argv.includes('--cleanup')) {
    const saved = JSON.parse(fs.readFileSync(path.join(workspace, 'work/sandbox-pending-refund.json'), 'utf8'));
    customer = {id:saved.customer}; subscription = saved.subscription;
    results.push({name:'Estorno Pix no provedor',result:'BLOCKED',message:'Asaas notificou falha da transferência; painel informa que não é possível confirmar transferência Pix nesse ambiente.'});
    return;
  }
  if (process.argv.includes('--resume-refund')) {
    const saved = JSON.parse(fs.readFileSync(path.join(workspace, 'work/sandbox-pending-refund.json'), 'utf8'));
    customer = {id:saved.customer}; subscription = saved.subscription;
    const db = new Database(); db.rows = new Map(saved.rows); const app = express();
    const service = mount(app, {db,asaas:gateway,now:()=>new Date(saved.clock),env:{USAGE_MODE:'lifetime',ASAAS_ENV:'sandbox'},auth:{verifyIdToken:async()=>({uid:saved.uid,email_verified:true})}});
    const payment = await gateway(`/payments/${saved.payment}`);
    console.log('QA refund lookup:', JSON.stringify({id:payment.id,invoiceUrl:payment.invoiceUrl,value:payment.value,dueDate:payment.dueDate,status:payment.status,refunds:payment.refunds?.map(r=>({status:r.status,value:r.value}))}));
    if (payment.status !== 'REFUNDED' && !payment.refunds?.some(r=>r.status==='DONE')) { waitingAuthorization=true; throw new Error('Estorno ainda não concluído no Asaas: '+JSON.stringify({status:payment.status,refunds:payment.refunds?.map(r=>({status:r.status,value:r.value}))})); }
    await service.syncPayment(payment);
    assert.equal((await db.doc(`billingAccounts/${saved.uid}`).get()).data().blocks,0);
    pass('Estorno confirmado no Asaas após cancelamento revoga cota paga');
    return;
  }
  const stamp = Date.now(), uid = `planeja-qa-${stamp}`;
  customer = await gateway('/customers', 'POST', { name: `Planeja QA ${stamp}`, cpfCnpj: '24971563792', notificationDisabled: true, externalReference: uid });
  assert.equal(customer.notificationDisabled, true); pass('Cliente fictício criado sem email, telefone ou notificações');
  const db = new Database(), app = express(); let clock = new Date();
  const service = mount(app, { db, asaas: gateway, now: () => clock,
    env: { USAGE_MODE: 'lifetime', ASAAS_ENV: 'sandbox', ADMIN_UIDS: 'owner' },
    auth: { verifyIdToken: async token => { if (token !== uid && token !== 'owner') throw new Error('invalid'); return { uid: token, email_verified: true }; } } });
  await db.doc('billingSystem/config').set({ enabled: true, usageMode: 'lifetime' });
  await db.doc(`billingAccounts/${uid}`).set({ customerId: customer.id });
  const api = (method, route, body, token = uid) => request(app)[method](`/billing${route}`).set('Authorization', `Bearer ${token}`).send(body);
  const me = async () => (await api('get', '/me')).body;
  let checkout = await api('post', '/checkout', { blocks: 1, accepted: true });
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
  let account = (await db.doc(`billingAccounts/${uid}`).get()).data(); subscription = account.subscriptionId;
  assert.ok(subscription); assert.equal((await me()).limit, 20); pass('Assinatura R$20 criada; pendência mantém limite gratuito');
  if (process.argv.includes('--card')) {
    const pending = (await gateway(`/subscriptions/${subscription}/payments?limit=100`)).data[0];
    assert.ok(pending);
    await gateway(`/payments/${pending.id}/payWithCreditCard`, 'POST', {
      creditCard:{holderName:'Planeja QA',number:'5162306219378829',expiryMonth:'05',expiryYear:'2030',ccv:'318'},
      creditCardHolderInfo:{name:'Planeja QA',email:'qa@example.invalid',cpfCnpj:'24971563792',postalCode:'89223005',addressNumber:'277',phone:'4738010919'},
      remoteIp:'203.0.113.10'
    });
    await service.syncPayment(await gateway(`/payments/${pending.id}`));
    assert.equal((await me()).limit,50); pass('Cartão oficial de testes confirmado libera cota');
    await new Promise(resolve=>setTimeout(resolve,15000));
    await gateway(`/payments/${pending.id}/refund`,'POST',{description:'Homologação de cartão sandbox Planeja'});
    const reversed = await gateway(`/payments/${pending.id}`);
    await service.syncPayment(reversed); assert.equal((await me()).limit,20);
    pass('Estorno de cartão confirmado no Asaas revoga cota');
    return;
  }
  assert.equal((await api('post', '/checkout', { blocks: 1, accepted: true })).status, 200);
  let list = await gateway(`/subscriptions?customer=${customer.id}&limit=100`);
  assert.equal(list.data.filter(s => !s.deleted).length, 1); pass('Repetir checkout não duplica assinatura no Asaas');
  list = await gateway(`/subscriptions/${subscription}/payments?limit=100`);
  assert.ok(list.data.length); let first = list.data[0];
  assert.equal(first.value, 20);
  // Select PIX on the existing charge, then simulate settlement through sandbox-only API.
  await gateway(`/payments/${first.id}`, 'PUT', { billingType: 'PIX' });
  await gateway(`/sandbox/payment/${first.id}/confirm`, 'POST', {});
  first = await gateway(`/payments/${first.id}`); await service.syncPayment(first);
  assert.equal((await me()).limit, 50); pass('Pagamento confirmado libera 50 inserções');
  for (let i = 0; i < 50; i++) {
    const r = await api('post', '/transactions', { id: `sandbox-${i}`, data: { descricao: 'QA', tipo: 'saida', categoria: 'Outros', valor: 1, data: clock.toISOString() } });
    assert.equal(r.status, 200);
  }
  assert.equal((await api('post', '/transactions', { id: 'sandbox-51', data: { descricao: 'QA', tipo: 'saida', categoria: 'Outros', valor: 1, data: clock.toISOString() } })).status, 402);
  pass('50 inserções aceitas; 51ª bloqueada');
  checkout = await api('post', '/checkout', { blocks: 2, accepted: true });
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
  const upgradeOrder = (await db.doc(`billingOrders/${checkout.body.orderId}`).get()).data();
  assert.equal((await me()).limit, 50);
  await gateway(`/payments/${upgradeOrder.paymentId}`, 'PUT', { billingType: 'PIX' });
  await gateway(`/sandbox/payment/${upgradeOrder.paymentId}/confirm`, 'POST', {});
  await service.syncPayment(await gateway(`/payments/${upgradeOrder.paymentId}`));
  assert.equal((await me()).limit, 80);
  assert.equal((await gateway(`/subscriptions/${subscription}`)).value, 40); pass('Ampliação paga libera 80 e próxima mensalidade passa a R$40');
  await gateway(`/subscriptions/${subscription}/paymentBook?month=12&year=2026`);
  list = await gateway(`/subscriptions/${subscription}/payments?limit=100`);
  const renewal = list.data.filter(p => p.dueDate > first.dueDate && !p.deleted).sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0];
  assert.ok(renewal, 'No renewal charge generated'); assert.equal(renewal.value, 40);
  await gateway(`/payments/${renewal.id}`, 'PUT', { billingType: 'PIX' });
  await gateway(`/sandbox/payment/${renewal.id}/confirm`, 'POST', {});
  clock = new Date(`${renewal.dueDate}T12:00:00Z`);
  await service.syncPayment(await gateway(`/payments/${renewal.id}`));
  assert.equal((await me()).limit, 80); assert.equal((await me()).count, 50); pass('Renovação R$40 mantém 80 e consumo acumulado não reinicia');
  assert.equal((await api('post', '/cancel', {})).status, 200);
  assert.equal((await me()).limit, 80); assert.equal((await me()).subscriptionId, null); pass('Cancelamento encerra renovação e preserva período pago');
  // Sandbox settlement/refunds are asynchronous. Do not confuse an accepted
  // refund request with a completed refund, or retry an uncertain POST.
  await new Promise(resolve => setTimeout(resolve, 15000));
  await gateway(`/payments/${renewal.id}/refund`, 'POST', { description: 'Homologação sandbox Planeja' });
  let refunded;
  for (let attempt = 0; attempt < 10; attempt++) {
    refunded = await gateway(`/payments/${renewal.id}`);
    if (refunded.status === 'REFUNDED' || refunded.refunds?.some(r => r.status === 'DONE')) break;
    if (refunded.refunds?.some(r => r.status === 'AWAITING_CRITICAL_ACTION_AUTHORIZATION')) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log('Sandbox refund state:', JSON.stringify({status:refunded.status,refunds:refunded.refunds?.map(r=>({status:r.status,value:r.value}))}));
  if (refunded.refunds?.some(r => r.status === 'AWAITING_CRITICAL_ACTION_AUTHORIZATION')) {
    waitingAuthorization = true;
    fs.writeFileSync(path.join(workspace, 'work/sandbox-pending-refund.json'), JSON.stringify({ uid, customer:customer.id, subscription, payment:renewal.id, clock:clock.toISOString(), rows:[...db.rows] }));
    await service.syncPayment(refunded); assert.equal((await me()).limit, 80);
    pass('Estorno aguardando autorização conserva acesso até conclusão');
    results.push({name:'Estorno concluído',result:'PENDING',message:'Autorizar ação crítica no painel sandbox'});
    return;
  }
  await service.syncPayment(refunded);
  assert.equal((await me()).limit, 20); pass('Estorno após cancelamento revoga cota paga');
  assert.equal((await api('get', '/admin/payments', undefined, 'owner')).status, 200); pass('Administração consulta pagamentos conciliados');
}
main().catch(error => { results.push({ name: 'Integration failure', result: 'FAIL', message: error.message }); console.error(error.message); process.exitCode = 1; }).finally(async () => {
  try { if (!waitingAuthorization) { if (subscription) await gateway(`/subscriptions/${subscription}`, 'DELETE'); if (customer) await gateway(`/customers/${customer.id}`, 'DELETE'); pass('Dados exclusivos da execução arquivados no sandbox'); } }
  catch (error) { results.push({ name: 'Cleanup', result: 'FAIL', message: error.message }); process.exitCode = 1; }
  fs.writeFileSync(path.join(workspace, 'work/sandbox-validation-results.json'), JSON.stringify({ at: new Date().toISOString(), environment: 'sandbox', results }, null, 2));
});
