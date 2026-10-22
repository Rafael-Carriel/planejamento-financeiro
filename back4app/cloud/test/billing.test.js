'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { Database } = require('./fake-db');
const { mount } = require('../routes');
const { tier, period, monthAfter, entitlement } = require('../policy');

const today = new Date('2026-10-20T12:00:00Z');
const record = { descricao: 'Mercado', valor: 20, tipo: 'saida', categoria: 'Alimentação', data: '2026-10-19T12:00:00Z' };
async function setup(gateway, extraEnv = {}) {
  const db = new Database(), app = express();
  const remote = new Map();
  const calls = [];
  const asaas = async (path, method = 'GET', body) => {
    calls.push({ path, method, body });
    if (gateway) return gateway(path, method, body);
    if (!remote.has(path)) throw new Error(`Unexpected gateway call ${path}`);
    return remote.get(path);
  };
  const auth = { verifyIdToken: async token => {
    if (!['user', 'owner'].includes(token)) throw new Error('revoked');
    return { uid: token, email: `${token}@example.com`, email_verified: true };
  }, getUser: async uid => ({ uid, email: `${uid}@example.com`, emailVerified: true }),
  listUsers: async () => ({ users: [] }) };
  const service = mount(app, { db, auth, asaas, env: { USAGE_MODE: 'lifetime', ADMIN_UIDS: 'owner', ASAAS_ENV: 'sandbox',
    ASAAS_WEBHOOK_TOKEN: 'test-webhook-secret', ALLOWED_ORIGINS: 'http://localhost:5173', ...extraEnv }, now: () => today });
  await db.doc('billingSystem/config').set({ enabled: true, usageMode: 'lifetime' });
  const api = (method, path, body, token = 'user') => request(app)[method](`/billing${path}`).set('Authorization', `Bearer ${token}`).send(body);
  return { db, app, api, remote, calls, service };
}

test('faixas acumuladas: 20 grátis, 21–50 por R$20, 51–80 por R$40', () => {
  for (const [count, price, limit] of [[0,0,20],[20,0,20],[21,20,50],[50,20,50],[51,40,80],[80,40,80],[81,60,110]]) {
    assert.deepEqual(tier(count), { blocks: price / 20, price, limit });
  }
});
test('contagem acumulada não reinicia; meses respeitam São Paulo e fevereiro', () => {
  assert.equal(period(today, 'lifetime'), period(new Date('2027-01-01'), 'lifetime'));
  assert.equal(period(new Date('2026-11-01T01:00:00Z'), 'monthly'), '2026-10');
  assert.equal(monthAfter('2027-01-31').toISOString(), '2027-02-28T03:00:00.000Z');
  assert.equal(entitlement({ blocks: 3, validUntil: today }, today), 0);
});
test('21ª inserção é bloqueada; apagar dados e reabrir não devolve consumo', async () => {
  const { db, api } = await setup();
  for (let i = 0; i < 20; i++) assert.equal((await api('post', '/transactions', { id: `entry-${i}`, data: record })).status, 200);
  assert.equal((await api('post', '/transactions', { id: 'twenty-one', data: record })).status, 402);
  db.rows.delete('usuarios/user/transacoes/entry-0');
  assert.equal((await api('post', '/transactions', { id: 'new-after-delete', data: record })).status, 402);
  assert.equal((await api('get', '/me')).body.count, 20);
});
test('pedidos simultâneos na última vaga: só um passa', async () => {
  const { db, api } = await setup();
  await db.doc('billingAccounts/user/usage/total').set({ count: 19 });
  const results = await Promise.all(['a','b'].map(id => api('post', '/transactions', { id, data: record })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 402]);
});
test('repetir uma ocorrência automática não consome duas vezes', async () => {
  const { api } = await setup();
  const body = { id: 'automatica-salario-2026-10', data: record };
  await api('post', '/transactions', body); await api('post', '/transactions', body);
  assert.equal((await api('get', '/me')).body.count, 1);
});
test('dados inválidos, token inválido e administrador forjado são recusados', async () => {
  const { api } = await setup();
  assert.equal((await api('post', '/transactions', { id: 'a', data: { ...record, valor: -1 } })).status, 400);
  assert.equal((await api('get', '/me', undefined, 'revoked')).status, 401);
  assert.equal((await api('get', '/admin/users')).status, 403);
  assert.equal((await api('get', '/admin/payments')).status, 403);
  assert.equal((await api('get', '/admin/users', undefined, 'owner')).status, 200);
});
test('somente o e-mail verificado do proprietário vincula o UID administrativo', async () => {
  const { api, db } = await setup(undefined, { ADMIN_UIDS: '', ADMIN_EMAIL: 'owner@example.com' });
  assert.equal((await api('get', '/admin/users')).status, 403);
  assert.equal((await api('get', '/admin/users', undefined, 'owner')).status, 200);
  assert.equal((await db.doc('billingSystem/owner').get()).data().uid, 'owner');
});
test('diagnóstico Asaas exige administrador e faz somente consulta sem expor clientes', async () => {
  const { api, calls } = await setup(async (path, method) => {
    assert.equal(path, '/myAccount/status'); assert.equal(method, 'GET');
    return { general: 'PENDING', documentation: 'PENDING', commercialInfo: 'APPROVED',
      bankAccountInfo: 'unexpected private data', cpfCnpj: 'private-identifier' };
  });
  assert.equal((await api('get', '/admin/asaas-status')).status, 403);
  assert.equal(calls.length, 0);
  const result = await api('get', '/admin/asaas-status', undefined, 'owner');
  assert.deepEqual(result.body, { connected: true, environment: 'sandbox', account: {
    general: 'PENDING', commercialInfo: 'APPROVED', documentation: 'PENDING', bankAccountInfo: 'UNKNOWN' } });
  assert.equal(calls.length, 1);
});
test('histórico existente é incluído na primeira contagem; administrador tem isenção', async () => {
  const { db, api } = await setup();
  await db.doc('usuarios/user/transacoes/old').set(record);
  assert.equal((await api('get', '/me')).body.count, 1);
  await db.doc('billingAccounts/owner/usage/total').set({ count: 200 });
  assert.equal((await api('post', '/transactions', { id: 'admin', data: record }, 'owner')).status, 200);
});
test('quota paga expirada não permite novas inserções', async () => {
  const { db, api } = await setup();
  await db.doc('billingAccounts/user').set({ blocks: 2, validUntil: new Date('2026-10-19') });
  await db.doc('billingAccounts/user/usage/total').set({ count: 20 });
  assert.equal((await api('post', '/transactions', { id: 'a', data: record })).status, 402);
});
test('configuração desligada bloqueia cobrança e inserção pela API', async () => {
  const { db, api } = await setup();
  await db.doc('billingSystem/config').set({ enabled: false, usageMode: 'lifetime' });
  assert.equal((await api('post', '/checkout', { blocks: 1, accepted: true })).status, 503);
  assert.equal((await api('post', '/transactions', { id: 'a', data: record })).status, 503);
});
test('consultar durante a configuração não congela o consumo antes da ativação', async () => {
  const { api, db } = await setup();
  await db.doc('billingSystem/config').set({ enabled: false, usageMode: 'lifetime' });
  assert.equal((await api('get', '/me')).body.count, 0);
  assert.equal((await db.doc('billingAccounts/user/usage/total').get()).exists, false);
  await db.doc('usuarios/user/transacoes/before-activation').set(record);
  await db.doc('billingSystem/config').set({ enabled: true, usageMode: 'lifetime' });
  assert.equal((await api('get', '/me')).body.count, 1);
});
test('primeira ativação inclui inserções posteriores a um contador antigo de configuração', async () => {
  const { api, db } = await setup();
  await db.doc('billingAccounts/user/usage/total').set({ count: 1 });
  await db.doc('usuarios/user/transacoes/a').set(record);
  await db.doc('usuarios/user/transacoes/b').set(record);
  await db.doc('billingSystem/config').set({ enabled: true, usageMode: 'lifetime', activationId: 'first-live' });
  assert.equal((await api('get', '/me')).body.count, 2);
});

async function subscriptionFixture() {
  const ctx = await setup();
  await ctx.db.doc('billingOrders/order-1').set({ uid: 'user', kind: 'subscription', customerId: 'cus_1', blocks: 1 });
  await ctx.db.doc('billingAccounts/user').set({ customerId: 'cus_1', subscriptionId: 'sub_1', subscriptionBlocks: 1 });
  ctx.remote.set('/subscriptions/sub_1', { id: 'sub_1', externalReference: 'order-1', value: 20 });
  const payment = { id: 'pay_1', subscription: 'sub_1', customer: 'cus_1', value: 20,
    status: 'PENDING', dueDate: '2026-10-20', billingType: 'PIX', invoiceUrl: 'https://www.asaas.com/i/test' };
  return { ...ctx, payment };
}
test('assinatura pendente não libera limite; pagamento confirmado libera; estorno revoga', async () => {
  const { service, api, payment } = await subscriptionFixture();
  await service.syncPayment(payment);
  assert.equal((await api('get', '/me')).body.limit, 20);
  await service.syncPayment({ ...payment, status: 'CONFIRMED' });
  assert.equal((await api('get', '/me')).body.limit, 50);
  await service.syncPayment({ ...payment, status: 'REFUNDED' });
  assert.equal((await api('get', '/me')).body.limit, 20);
});
test('webhook autenticado consulta o estado atual e ignora eventos duplicados', async () => {
  const { app, api, remote, payment, calls } = await subscriptionFixture();
  remote.set('/payments/pay_1', { ...payment, status: 'RECEIVED' });
  const payload = { id: 'evt_1', event: 'PAYMENT_OVERDUE', payment: { id: 'pay_1', status: 'OVERDUE' } };
  assert.equal((await request(app).post('/billing/webhook').send(payload)).status, 401);
  assert.equal((await request(app).post('/billing/webhook').set('asaas-access-token', 'test-webhook-secret').send(payload)).status, 200);
  assert.equal((await api('get', '/me')).body.limit, 50);
  const previous = calls.length;
  await request(app).post('/billing/webhook').set('asaas-access-token', 'test-webhook-secret').send(payload);
  assert.equal(calls.length, previous);
});
test('cliente divergente no Asaas não recebe benefício', async () => {
  const { service, api, payment } = await subscriptionFixture();
  await assert.rejects(() => service.syncPayment({ ...payment, status: 'RECEIVED', customer: 'cus_other' }));
  assert.equal((await api('get', '/me')).body.limit, 20);
});
test('cliques repetidos no checkout não criam duas assinaturas', async () => {
  let subscriptions = 0;
  const ctx = await setup(async (path, method) => {
    if (path.startsWith('/customers?')) return { data: [{ id: 'cus_1', externalReference: 'user' }] };
    if (path === '/subscriptions' && method === 'POST') { subscriptions++; return { id: 'sub_1' }; }
    if (path.startsWith('/subscriptions/sub_1/payments')) return { data: [] };
    throw new Error(path);
  });
  const body = { blocks: 1, accepted: true, cpfCnpj: '12345678901' };
  assert.equal((await ctx.api('post', '/checkout', body)).status, 200);
  assert.equal((await ctx.api('post', '/checkout', body)).status, 200);
  assert.equal(subscriptions, 1);
  assert.equal((await ctx.api('post', '/checkout', { ...body, blocks: 2 })).status, 409);
});
test('resultado incerto de criação não permite cancelar e criar assinatura duplicada', async () => {
  let attempts = 0;
  const ctx = await setup(async (path, method) => {
    if (path.startsWith('/customers?')) return { data: [{ id: 'cus_1', externalReference: 'user' }] };
    if (path === '/subscriptions' && method === 'POST') { attempts++; throw new Error('Gateway timeout'); }
    if (path.startsWith('/subscriptions?')) return { data: [] };
    throw new Error(path);
  });
  const body = { blocks: 1, accepted: true, cpfCnpj: '12345678901' };
  assert.equal((await ctx.api('post', '/checkout', body)).status, 500);
  assert.equal((await ctx.api('post', '/cancel', {})).status, 409);
  assert.equal((await ctx.api('post', '/checkout', body)).status, 200);
  assert.equal(attempts, 1);
});
test('cancelar mantém o acesso já pago sem reativar renovação por evento antigo', async () => {
  const { service, db, api, payment } = await subscriptionFixture();
  await service.syncPayment({ ...payment, status: 'RECEIVED' });
  await db.doc('billingAccounts/user').set({ subscriptionId: null, canceled: true, subscriptionBlocks: 0 }, { merge: true });
  await service.syncPayment({ ...payment, status: 'RECEIVED' });
  const data = (await api('get', '/me')).body;
  assert.equal(data.limit, 50); assert.equal(data.subscriptionId, null); assert.equal(data.monthlyPrice, 0);
});
test('ampliação só libera após pagar diferença e ajusta a próxima mensalidade', async () => {
  const { service, api, db, remote, calls, payment } = await subscriptionFixture();
  await service.syncPayment({ ...payment, status: 'RECEIVED' });
  await db.doc('billingOrders/upgrade-1').set({ uid: 'user', kind: 'upgrade', customerId: 'cus_1', blocks: 2,
    value: 20, basePaymentId: 'pay_1', validUntil: monthAfter('2026-10-20') });
  const upgrade = { id: 'pay_2', customer: 'cus_1', value: 20, externalReference: 'upgrade-1',
    status: 'PENDING', dueDate: '2026-10-20', billingType: 'PIX', invoiceUrl: 'https://www.asaas.com/i/upgrade' };
  await service.syncPayment(upgrade);
  assert.equal((await api('get', '/me')).body.limit, 50);
  remote.set('/subscriptions/sub_1', { id: 'sub_1', value: 20, externalReference: 'order-1' });
  await service.syncPayment({ ...upgrade, status: 'RECEIVED' });
  assert.equal((await api('get', '/me')).body.limit, 80);
  assert.equal(calls.find(c => c.method === 'PUT' && c.path === '/subscriptions/sub_1').body.value, 40);
  await service.syncPayment({ ...upgrade, status: 'REFUNDED' });
  assert.equal((await api('get', '/me')).body.limit, 50);
});
test('adaptador Parse funciona sem Web Hosting e preserva a autenticação', async () => {
  const { createDispatcher } = require('../parse-entry');
  const db = new Database();
  const dispatcher = createDispatcher(adapter => mount(adapter, { db, auth: {
    verifyIdToken: async token => { if (token !== 'valid') throw new Error('invalid'); return { uid: 'u1' }; },
  }, asaas: async () => { throw new Error('Unexpected external call'); }, env: { USAGE_MODE: 'lifetime', ASAAS_ENV: 'sandbox' }, now: () => today }));
  const result = await dispatcher.dispatch('GET', '/me', { params: { firebaseToken: 'valid' } });
  assert.equal(result.count, 0); assert.equal(result.limit, 20);
  await assert.rejects(() => dispatcher.dispatch('GET', '/admin/users', { params: { firebaseToken: 'valid' } }));
  await assert.rejects(() => dispatcher.dispatch('GET', '/me', { params: { firebaseToken: 'bad' } }));
});

test('datas impossíveis e descrição incompatível com regras são rejeitadas', async () => {
  const { api } = await setup();
  for (const data of ['2026-02-30T12:00:00Z', '2026-13-01T12:00:00Z', '2026-10-20', 'invalid']) {
    assert.equal((await api('post', '/transactions', { id: 'invalid', data: { ...record, data } })).status, 400);
  }
  assert.equal((await api('post', '/transactions', { id: 'long', data: { ...record, descricao: 'a'.repeat(121) } })).status, 400);
  assert.equal((await api('post', '/transactions', { id: 'max', data: { ...record, descricao: 'a'.repeat(120) } })).status, 200);
});

test('estorno concluído após cancelamento independe da assinatura removida no provedor', async () => {
  const { service, db, api, payment, remote } = await subscriptionFixture();
  await service.syncPayment({ ...payment, status: 'RECEIVED' });
  remote.delete('/subscriptions/sub_1');
  await db.doc('billingAccounts/user').set({ subscriptionId: null, canceled: true }, { merge: true });
  await service.syncPayment({ ...payment, status: 'RECEIVED', refunds: [{ status: 'PENDING', value: 20 }] });
  assert.equal((await api('get', '/me')).body.limit, 50);
  await service.syncPayment({ ...payment, status: 'RECEIVED', refunds: [{ status: 'DONE', value: 20 }] });
  assert.equal((await api('get', '/me')).body.limit, 20);
});
