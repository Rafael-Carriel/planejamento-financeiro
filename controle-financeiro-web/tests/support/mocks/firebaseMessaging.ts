/// Dublê do módulo `firebase/messaging` usado nos testes E2E.
///
/// Notificações push dependem de service worker e de uma chave VAPID real, que
/// não existem no ambiente de teste. As funções respondem sem rede: `getToken`
/// rejeita com uma mensagem clara, que é exatamente o que a UI já sabe mostrar.

export const FONTE_FIREBASE_MESSAGING = `
const MENSAGEM = 'Notificações push não estão disponíveis no ambiente de teste.';

export function getMessaging() {
  return { app: '[e2e]' };
}

export function isSupported() {
  return Promise.resolve(false);
}

export function getToken() {
  return Promise.reject(new Error(MENSAGEM));
}

export function deleteToken() {
  return Promise.resolve();
}

export function onMessage() {
  return function () {};
}
`;
