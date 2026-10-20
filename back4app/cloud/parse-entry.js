'use strict';
// Parse adapter: works on the existing Back4App Free plan without Web Hosting.
const { initialize } = require('./runtime');
function createDispatcher(initializeRuntime) {
const handlers = new Map();
const adapter = {
  disable() {}, use() {},
  get(path, ...chain) { handlers.set(`GET ${path}`, chain); },
  post(path, ...chain) { handlers.set(`POST ${path}`, chain); },
};
let service;
function getService() { return service || (service = initializeRuntime(adapter)); }
function dispatch(method, path, request) {
  getService();
  return new Promise((resolve, reject) => {
    const chain = handlers.get(`${method} /billing${path}`);
    if (!chain) return reject(new Error('Operação inválida.'));
    const req = { body: request.params.data || {}, query: request.params.query || {},
      get: name => name === 'authorization' ? `Bearer ${request.params.firebaseToken || ''}` : undefined };
    const res = { json: resolve };
    let index = 0;
    function next(error) {
      if (error) return reject(error);
      const handler = chain[index++];
      if (!handler) return reject(new Error('Operação incompleta.'));
      Promise.resolve(handler(req, res, next)).catch(reject);
    }
    next();
  });
}
return { dispatch, reconcile: () => getService().reconcile() };
}
const dispatcher = createDispatcher(initialize);
const operations = {
  planejaMe: ['GET', '/me'], planejaCheckout: ['POST', '/checkout'],
  planejaCreateTransaction: ['POST', '/transactions'], planejaCancel: ['POST', '/cancel'],
  planejaSync: ['POST', '/sync'], planejaAdminUsers: ['GET', '/admin/users'],
  planejaAdminPayments: ['GET', '/admin/payments'], planejaActivate: ['POST', '/admin/activate'],
  planejaAsaasStatus: ['GET', '/admin/asaas-status'],
};
if (typeof Parse !== 'undefined') for (const [name, [method, path]] of Object.entries(operations)) {
  Parse.Cloud.define(name, async request => {
    try { return await dispatcher.dispatch(method, path, request); }
    catch (error) {
      throw new Parse.Error(141, error.status && error.status < 500 ? error.message : 'Serviço temporariamente indisponível. Tente novamente.');
    }
  });
}
if (typeof Parse !== 'undefined') Parse.Cloud.define('planejaHealth', () => ({ service: 'planeja-billing', version: 1, counting: 'lifetime' }));
module.exports = { ...dispatcher, createDispatcher };
