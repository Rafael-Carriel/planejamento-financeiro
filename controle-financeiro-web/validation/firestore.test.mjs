import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { serverTimestamp,query,where } from 'firebase/firestore';

const requireBackend = createRequire(new URL('../../back4app/cloud/package.json', import.meta.url));
const admin = requireBackend('firebase-admin');
const express = requireBackend('express');
const request = requireBackend('supertest');
const { mount } = requireBackend('./routes');
const projectId = 'demo-planeja-validation';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080') throw new Error('Teste recusado fora do emulador local isolado.');
let env, serverDb, app, firebaseApp;
const now = new Date('2026-10-20T12:00:00Z');
const input = { descricao: 'Teste isolado', valor: 20, categoria: 'Outros', tipo: 'saida', data: '2026-10-20T12:00:00Z', observacao: null, recorrenciaId: null };
const row = () => ({ ...input, data: Timestamp.fromDate(now), criadoEm: Timestamp.fromDate(now), atualizadoEm: Timestamp.fromDate(now) });
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 18080,
    rules: await readFile(new URL('../../controle_financeiro/firestore.rules', import.meta.url), 'utf8') } });
  firebaseApp = admin.initializeApp({ projectId }, 'validation-local-only');
  serverDb = admin.firestore(firebaseApp);
  app = express();
  mount(app, { db: serverDb, auth: { verifyIdToken: async token => {
    if (!['user-a', 'user-b', 'owner'].includes(token)) throw new Error('invalid');
    return { uid: token, email_verified: true };
  } }, asaas: async () => { throw new Error('No external network allowed in emulator test'); },
  env: { USAGE_MODE: 'lifetime', ADMIN_UIDS: 'owner', ASAAS_ENV: 'sandbox' }, now: () => now });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); await firebaseApp?.delete(); });
const api = (uid, data) => request(app).post('/billing/transactions').set('Authorization', `Bearer ${uid}`).send(data);
async function active() { await serverDb.doc('billingSystem/config').set({ enabled: true, usageMode: 'lifetime', activationId: 'validation' }); }

test('regras preservam legado antes da ativação e bloqueiam inserção direta após ativar', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  await assertSucceeds(setDoc(doc(db, 'usuarios/user-a/transacoes/legacy'), row()));
  await active();
  await assertFails(setDoc(doc(db, 'usuarios/user-a/transacoes/bypass'), row()));
  await assertSucceeds(updateDoc(doc(db, 'usuarios/user-a/transacoes/legacy'), { descricao: 'Editado' }));
  await assertFails(updateDoc(doc(db, 'usuarios/user-a/transacoes/legacy'), { criadoEm: Timestamp.fromMillis(0) }));
  await assertSucceeds(deleteDoc(doc(db, 'usuarios/user-a/transacoes/legacy')));
});
test('nenhum usuário lê outros usuários, assinaturas ou dados administrativos', async () => {
  await serverDb.doc('usuarios/user-b').set({ nome: 'Pessoa B', email: 'b@example.invalid' });
  const db = env.authenticatedContext('user-a').firestore();
  await assertFails(getDoc(doc(db, 'usuarios/user-b')));
  await assertFails(getDocs(collection(db, 'usuarios')));
  for (const name of ['billingAccounts','billingOrders','billingPayments','billingEvents','billingSystem']) {
    await assertFails(getDoc(doc(db, `${name}/any`)));
    await assertFails(setDoc(doc(db, `${name}/any`), { admin: true, blocks: 100 }));
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'usuarios/user-a')));
});
test('contador real: 8 operações simultâneas disputam a última vaga sem ultrapassar 20', async () => {
  await active();
  const batch = serverDb.batch();
  for (let i = 0; i < 19; i++) batch.set(serverDb.doc(`usuarios/user-a/transacoes/old-${i}`), { ...input, data: now, criadoEm: now, atualizadoEm: now });
  await batch.commit();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => api('user-a', { id: `race-${i}`, data: input })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 402).length, 7);
  assert.equal((await serverDb.collection('usuarios/user-a/transacoes').get()).size, 20);
  assert.equal((await serverDb.doc('billingAccounts/user-a/usage/total').get()).data().count, 20);
});
test('repetição idêntica não consome novamente; exclusão não recupera cota', async () => {
  await active();
  const body = { id: 'stable-id', data: input };
  assert.equal((await api('user-a', body)).status, 200);
  assert.equal((await api('user-a', body)).status, 200);
  await deleteDoc(doc(env.authenticatedContext('user-a').firestore(), 'usuarios/user-a/transacoes/stable-id'));
  assert.equal((await serverDb.doc('billingAccounts/user-a/usage/total').get()).data().count, 1);
});
test('dados aceitos no backend permanecem editáveis pelas regras publicadas', async () => {
  await active();
  assert.equal((await api('user-a', { id: 'valid', data: { ...input, descricao: 'x'.repeat(120) } })).status, 200);
  assert.equal((await api('user-a', { id: 'invalid', data: { ...input, descricao: 'x'.repeat(121) } })).status, 400);
  await assertSucceeds(updateDoc(doc(env.authenticatedContext('user-a').firestore(), 'usuarios/user-a/transacoes/valid'), { descricao: 'Corrigido' }));
});
test('coleções do Planeora mantêm isolamento e escrita de transações pelo servidor', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  await assertSucceeds(setDoc(doc(db, 'users/user-a'), { companyId: 'user-a', companyName: 'Teste', name: 'Teste', email: 'teste@example.invalid', role: 'owner' }));
  await assertSucceeds(setDoc(doc(db, 'companies/user-a'), { name: 'Teste', ownerId: 'user-a' }));
  await assertFails(setDoc(doc(db, 'companies/user-a/transactions/direct'), { type: 'income' }));
  await assertFails(setDoc(doc(db, 'companies/user-a/billing/current'), { plan: 'unlimited' }));
  await assertFails(getDoc(doc(env.authenticatedContext('user-b').firestore(), 'companies/user-a')));
});

test('checkout simultâneo com repetição real da transação cria só uma assinatura externa', async () => {
  await active(); let created = 0;
  await serverDb.doc('billingAccounts/user-a').set({customerId:'qa-customer'});
  const checkoutApp = express();
  mount(checkoutApp, {db:serverDb, auth:{verifyIdToken:async()=>({uid:'user-a',email_verified:true})},
    env:{USAGE_MODE:'lifetime',ASAAS_ENV:'sandbox'}, now:()=>now,
    asaas:async(path,method='GET')=>{
      if(path==='/subscriptions' && method==='POST') return {id:`qa-sub-${++created}`};
      if(path.startsWith('/subscriptions?') || path.includes('/payments?')) return {data:[]};
      throw new Error('Unexpected test gateway request');
    }});
  const responses = await Promise.all(Array.from({length:6},()=>request(checkoutApp).post('/billing/checkout')
    .set('Authorization','Bearer test').send({blocks:1,accepted:true})));
  assert.equal(responses.filter(r=>r.status===200).length,6);
  assert.equal(created,1);
  assert.equal((await serverDb.collection('billingOrders').get()).size,1);
});

test('pedidos LGPD pertencem ao titular; administrador só altera andamento',async()=>{
  await serverDb.doc('billingSystem/owner').set({uid:'owner'});
  const a=env.authenticatedContext('user-a',{email_verified:true}).firestore();
  const b=env.authenticatedContext('user-b',{email_verified:true}).firestore();
  const owner=env.authenticatedContext('owner',{email_verified:true}).firestore();
  const payload={uid:'user-a',tipo:'exclusao',mensagem:'Teste',status:'recebida',criadoEm:serverTimestamp(),versao:'2026-10-20'};
  await assertSucceeds(setDoc(doc(a,'solicitacoesPrivacidade/qa'),payload));
  await assertFails(setDoc(doc(b,'solicitacoesPrivacidade/forged'),payload));
  await assertFails(getDoc(doc(b,'solicitacoesPrivacidade/qa')));
  await assertFails(updateDoc(doc(a,'solicitacoesPrivacidade/qa'),{status:'concluida'}));
  await assertFails(setDoc(doc(env.authenticatedContext('unverified',{email_verified:false}).firestore(),'solicitacoesPrivacidade/no'),{...payload,uid:'unverified'}));
  await assertSucceeds(getDocs(query(collection(a,'solicitacoesPrivacidade'),where('uid','==','user-a'))));
  await assertSucceeds(getDocs(collection(owner,'solicitacoesPrivacidade')));
  await assertSucceeds(updateDoc(doc(owner,'solicitacoesPrivacidade/qa'),{status:'em_analise',atualizadoEm:serverTimestamp()}));
  await assertFails(updateDoc(doc(owner,'solicitacoesPrivacidade/qa'),{uid:'owner'}));
  await assertFails(deleteDoc(doc(a,'solicitacoesPrivacidade/qa')));
});

test('aceite legal é datado pelo servidor e não pode ser reescrito',async()=>{
  const db=env.authenticatedContext('user-a').firestore();
  const ref=doc(db,'usuarios/user-a/aceitesLegais/2026-10-20');
  await assertSucceeds(setDoc(ref,{versao:'2026-10-20',termosAceitos:true,privacidadeLida:true,criadoEm:serverTimestamp()}));
  await assertFails(updateDoc(ref,{termosAceitos:false}));
  await assertFails(getDoc(doc(env.authenticatedContext('user-b').firestore(),'usuarios/user-a/aceitesLegais/2026-10-20')));
  await assertFails(setDoc(doc(db,'usuarios/user-a/aceitesLegais/2020-01-01'),{versao:'2020-01-01',termosAceitos:true,privacidadeLida:true,criadoEm:serverTimestamp()}));
});

test('campos financeiros legados são preservados e não podem conceder plano pelo cliente',async()=>{
  const db=env.authenticatedContext('user-a',{email:'a@example.invalid',email_verified:true}).firestore();
  await serverDb.doc('usuarios/user-a').set({nome:'Pessoa',email:'a@example.invalid',plano:'pago',planoAtivoAte:now,asaasClienteId:'legacy-client',asaasAssinaturaId:'legacy-sub',versaoTermos:'legado',configuracoes:{tema:'dark'}});
  await assertSucceeds(updateDoc(doc(db,'usuarios/user-a'),{nome:'Novo nome'}));
  await assertFails(updateDoc(doc(db,'usuarios/user-a'),{plano:'ilimitado'}));
  await assertFails(updateDoc(doc(db,'usuarios/user-a'),{asaasClienteId:'forged'}));
  await assertFails(setDoc(doc(env.authenticatedContext('user-b').firestore(),'usuarios/user-b'),{nome:'B',email:'b@example.invalid',plano:'pago'}));
  await assertSucceeds(setDoc(doc(db,'solicitacoesDeAssinatura/user-a'),{email:'a@example.invalid',status:'pendente',criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,'solicitacoesDeAssinatura/user-a'),{status:'aprovada'}));
});
test('SAC isola protocolos e permite resposta somente do administrador verificado', async () => {
  await serverDb.doc('billingSystem/owner').set({uid:'owner'});
  const own=env.authenticatedContext('user-a',{email_verified:true}).firestore();
  const other=env.authenticatedContext('user-b',{email_verified:true}).firestore();
  const owner=env.authenticatedContext('owner',{email_verified:true}).firestore();
  const ref=doc(own,'chamadosAtendimento/protocolo');
  const data={uid:'user-a',assunto:'Suporte',mensagem:'Preciso de ajuda',resposta:'',status:'recebido',criadoEm:serverTimestamp()};
  await assertSucceeds(setDoc(ref,data));
  await assertSucceeds(getDocs(query(collection(own,'chamadosAtendimento'),where('uid','==','user-a'))));
  await assertFails(getDoc(doc(other,'chamadosAtendimento/protocolo')));
  await assertFails(updateDoc(ref,{resposta:'Resposta falsa',status:'respondido',atualizadoEm:serverTimestamp()}));
  await assertFails(setDoc(doc(other,'chamadosAtendimento/falso'),data));
  await assertFails(setDoc(doc(env.authenticatedContext('user-a',{email_verified:false}).firestore(),'chamadosAtendimento/naoverificado'),data));
  await assertFails(setDoc(doc(own,'chamadosAtendimento/longo'),{...data,mensagem:'x'.repeat(2001)}));
  await assertSucceeds(updateDoc(doc(owner,'chamadosAtendimento/protocolo'),{resposta:'Atendimento do Planeora',status:'respondido',atualizadoEm:serverTimestamp()}));
  assert.equal((await getDoc(ref)).data().resposta,'Atendimento do Planeora');
  await assertFails(updateDoc(doc(owner,'chamadosAtendimento/protocolo'),{uid:'user-b'}));
  await assertFails(deleteDoc(ref));
});
test('lembretes privados aceitam leitura/dispensa sem ampliar acesso nem alterar cobrança',async()=>{
  const dono=env.authenticatedContext('user-a').firestore();const outro=env.authenticatedContext('user-b').firestore();
  const aviso={titulo:'Conta pendente',descricao:null,tipo:'recorrencia',data:Timestamp.fromDate(now),lido:false,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()};
  const ref=doc(dono,'usuarios/user-a/lembretes/auto-v1-teste');
  await assertSucceeds(setDoc(ref,aviso));await assertSucceeds(updateDoc(ref,{lido:true,descartado:true,atualizadoEm:serverTimestamp()}));
  await assertSucceeds(getDoc(ref));await assertFails(getDoc(doc(outro,'usuarios/user-a/lembretes/auto-v1-teste')));
  await assertFails(updateDoc(ref,{descartado:'sim'}));await assertFails(setDoc(doc(dono,'usuarios/user-b/lembretes/invasao'),aviso));
  await assertFails(setDoc(doc(dono,'billingSystem/config'),{enabled:false}));
});
