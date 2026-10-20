'use strict';
const admin = require('firebase-admin');
const { mount } = require('./routes');
const { client } = require('./asaas');

let service;
function initialize(app) {
  let firebaseApp = admin.apps.find(existing => existing.name === 'planeja-billing');
  if (!firebaseApp) {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '', 'base64').toString('utf8') || '{}');
    if (credentials.project_id !== 'controle-financeiro-rafael') throw new Error('Projeto Firebase divergente.');
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(credentials) }, 'planeja-billing');
  }
  const env = { ...process.env, USAGE_MODE: 'lifetime', ADMIN_EMAIL: 'rafaelcarriel.deo@gmail.com',
    ASAAS_ENV: process.env.ASAAS_ENV || 'production',
    ASAAS_API_KEY: process.env.ASAAS_API_KEY || Buffer.from(process.env.ASAAS_API_KEY_BASE64 || '', 'base64').toString('utf8') };
  service = mount(app, { db: admin.firestore(firebaseApp), auth: admin.auth(firebaseApp), asaas: client(env), env });
  return service;
}
module.exports = { initialize, reconcile: () => service.reconcile() };
