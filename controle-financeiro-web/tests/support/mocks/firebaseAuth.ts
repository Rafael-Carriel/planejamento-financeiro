/// Dublê do módulo `firebase/auth` usado nos testes E2E.
///
/// Mantém a sessão no `localStorage` (chave `e2e:usuario`) e avisa os ouvintes
/// registrados por `onAuthStateChanged`, reproduzindo o suficiente do fluxo de
/// e-mail/senha para o app entrar e sair de uma conta de teste sem rede.

export const CHAVE_SESSAO_E2E = 'e2e:usuario';

export const FONTE_FIREBASE_AUTH = `
const CHAVE_SESSAO = 'e2e:usuario';

export const browserLocalPersistence = { type: 'LOCAL' };
export const inMemoryPersistence = { type: 'NONE' };
export const indexedDBLocalPersistence = { type: 'LOCAL' };

const sessao = { currentUser: null };
const ouvintes = new Set();

function lerSessao() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_SESSAO);
    return bruto ? JSON.parse(bruto) : null;
  } catch (erro) {
    return null;
  }
}

function gravarSessao(usuario) {
  try {
    if (usuario) window.localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario));
    else window.localStorage.removeItem(CHAVE_SESSAO);
  } catch (erro) {
    // Sem localStorage o teste segue com a sessão só em memória.
  }
}

function montarUsuario(base) {
  return {
    uid: base.uid,
    email: base.email,
    displayName: base.displayName || null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    getIdToken: function () { return Promise.resolve('token-e2e'); },
    getIdTokenResult: function () { return Promise.resolve({ token: 'token-e2e', claims: {} }); },
  };
}

function notificar() {
  for (const ouvinte of ouvintes) ouvinte(sessao.currentUser);
}

export function getAuth() {
  const salvo = lerSessao();
  sessao.currentUser = salvo ? montarUsuario(salvo) : null;
  return sessao;
}

export function setPersistence() {
  return Promise.resolve();
}

export function onAuthStateChanged(_auth, aoMudar) {
  ouvintes.add(aoMudar);
  Promise.resolve().then(function () { aoMudar(sessao.currentUser); });
  return function () { ouvintes.delete(aoMudar); };
}

export async function signInWithEmailAndPassword(_auth, email, senha) {
  if (String(senha).length < 6) {
    throw new Error('E-mail ou senha não conferem.');
  }
  const usuario = montarUsuario({
    uid: 'e2e-' + String(email).split('@')[0],
    email: email,
    displayName: null,
  });
  sessao.currentUser = usuario;
  gravarSessao(usuario);
  notificar();
  return { user: usuario, providerId: 'password', operationType: 'signIn' };
}

export async function createUserWithEmailAndPassword(_auth, email, senha) {
  return signInWithEmailAndPassword(_auth, email, senha);
}

export async function signOut() {
  sessao.currentUser = null;
  gravarSessao(null);
  notificar();
}

export async function sendPasswordResetEmail() {}
export async function sendEmailVerification() {}

export async function updateProfile(usuario, dados) {
  if (dados && dados.displayName) usuario.displayName = dados.displayName;
  gravarSessao(usuario);
  notificar();
}

export async function updateEmail(usuario, email) {
  usuario.email = email;
  gravarSessao(usuario);
  notificar();
}

export async function updatePassword() {}
export function connectAuthEmulator() {}
`;
