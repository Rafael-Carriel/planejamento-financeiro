/// Dublê do módulo `firebase/app` servido pelo Vite durante os testes E2E.
///
/// Ele substitui o SDK real por uma implementação mínima, em memória, para que
/// os testes nunca falem com o Firebase de produção. O conteúdo é JavaScript
/// puro porque o navegador o recebe no lugar do pacote pré-bundizado.

export const FONTE_FIREBASE_APP = `
export class FirebaseError extends Error {
  constructor(codigo, mensagem) {
    super(mensagem || codigo);
    this.name = 'FirebaseError';
    this.code = codigo;
  }
}

const APP_FALSO = { name: '[e2e]', options: {}, automaticDataCollectionEnabled: false };

export function initializeApp() {
  return APP_FALSO;
}

export function getApp() {
  return APP_FALSO;
}

export function getApps() {
  return [APP_FALSO];
}

export function deleteApp() {
  return Promise.resolve();
}
`;
