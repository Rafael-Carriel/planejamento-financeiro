/// Dublê do módulo `firebase/firestore` usado nos testes E2E.
///
/// É um banco em memória com o subconjunto da API que o app usa: referências
/// (`doc`/`collection`), consultas (`query`/`where`/`orderBy`), leituras,
/// escritas, transações, lotes e assinaturas em tempo real (`onSnapshot`).
///
/// Os dados de partida podem ser injetados por `window.__E2E_SEED__` (lista de
/// `{ path, data }`), permitindo que um teste comece com lançamentos prontos.
/// Datas no formato `{ "__date": "<ISO>" }` são convertidas em `Timestamp`.

export const FONTE_FIREBASE_FIRESTORE = `
export class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() { return new Date(this.seconds * 1000 + Math.round(this.nanoseconds / 1e6)); }
  toMillis() { return this.seconds * 1000 + Math.round(this.nanoseconds / 1e6); }
  isEqual(outro) { return this.toMillis() === outro.toMillis(); }
  static now() { return Timestamp.fromDate(new Date()); }
  static fromDate(data) {
    const ms = data.getTime();
    return new Timestamp(Math.floor(ms / 1000), Math.round((ms % 1000) * 1e6));
  }
  static fromMillis(ms) { return Timestamp.fromDate(new Date(ms)); }
}

const MARCADOR_REMOCAO = '__E2E_DELETE_FIELD__';
const colecoes = new Map();
const inscritos = new Map();
let sementeAplicada = false;

function ehObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !(valor instanceof Timestamp) && !(valor instanceof Date);
}

function hidratar(valor) {
  if (Array.isArray(valor)) return valor.map(hidratar);
  if (ehObjeto(valor)) {
    if (typeof valor.__date === 'string') return Timestamp.fromDate(new Date(valor.__date));
    const saida = {};
    for (const chave of Object.keys(valor)) saida[chave] = hidratar(valor[chave]);
    return saida;
  }
  return valor;
}

function resolverSentinelas(valor) {
  if (Array.isArray(valor)) return valor.map(resolverSentinelas);
  if (ehObjeto(valor)) {
    if (valor.__serverTimestamp) return Timestamp.now();
    if (valor.__deleteField) return MARCADOR_REMOCAO;
    const saida = {};
    for (const chave of Object.keys(valor)) saida[chave] = resolverSentinelas(valor[chave]);
    return saida;
  }
  return valor;
}

function mesclar(destino, origem) {
  const saida = Object.assign({}, destino);
  for (const chave of Object.keys(origem)) {
    const valor = origem[chave];
    if (valor === MARCADOR_REMOCAO) {
      delete saida[chave];
    } else if (ehObjeto(valor) && ehObjeto(saida[chave])) {
      saida[chave] = mesclar(saida[chave], valor);
    } else {
      saida[chave] = valor;
    }
  }
  return saida;
}

function mapa(caminho) {
  if (!colecoes.has(caminho)) colecoes.set(caminho, new Map());
  return colecoes.get(caminho);
}

function dividir(caminho) {
  const corte = caminho.lastIndexOf('/');
  return { colecao: caminho.slice(0, corte), id: caminho.slice(corte + 1) };
}

function aplicarSemente() {
  if (sementeAplicada) return;
  sementeAplicada = true;
  const semente = window.__E2E_SEED__;
  if (!Array.isArray(semente)) return;
  for (const item of semente) {
    const corte = item.path.lastIndexOf('/');
    mapa(item.path.slice(0, corte)).set(item.path.slice(corte + 1), hidratar(item.data));
  }
}

function valorDoCampo(dados, campo) {
  let atual = dados;
  for (const parte of campo.split('.')) {
    if (atual === null || typeof atual !== 'object') return undefined;
    atual = atual[parte];
  }
  return atual;
}

function comparar(a, operador, b) {
  const va = a instanceof Timestamp ? a.toMillis() : a instanceof Date ? a.getTime() : a;
  const vb = b instanceof Timestamp ? b.toMillis() : b instanceof Date ? b.getTime() : b;
  switch (operador) {
    case '==': return va === vb;
    case '!=': return va !== vb;
    case '>': return va > vb;
    case '>=': return va >= vb;
    case '<': return va < vb;
    case '<=': return va <= vb;
    case 'in': return Array.isArray(b) && b.some(function (x) { return comparar(a, '==', x); });
    case 'array-contains': return Array.isArray(va) && va.indexOf(vb) !== -1;
    default: return true;
  }
}

function baseDaConsulta(alvo) {
  if (alvo.__tipo === 'col') return { caminho: alvo.caminho, restricoes: [] };
  if (alvo.__tipo === 'query') {
    const base = baseDaConsulta(alvo.base);
    return { caminho: base.caminho, restricoes: base.restricoes.concat(alvo.restricoes) };
  }
  return { caminho: dividir(alvo.caminho).colecao, restricoes: [] };
}

function documentosDaConsulta(alvo) {
  const base = baseDaConsulta(alvo);
  let docs = Array.from(mapa(base.caminho).entries()).map(function (par) {
    return { id: par[0], dados: par[1] };
  });

  for (const restricao of base.restricoes) {
    if (restricao.__tipo === 'where') {
      docs = docs.filter(function (d) {
        return comparar(valorDoCampo(d.dados, restricao.campo), restricao.operador, restricao.valor);
      });
    } else if (restricao.__tipo === 'orderBy') {
      docs.sort(function (x, y) {
        const vx = valorDoCampo(x.dados, restricao.campo);
        const vy = valorDoCampo(y.dados, restricao.campo);
        const ax = vx instanceof Timestamp ? vx.toMillis() : vx;
        const ay = vy instanceof Timestamp ? vy.toMillis() : vy;
        if (ax === ay) return 0;
        const resultado = ax > ay ? 1 : -1;
        return restricao.direcao === 'desc' ? -resultado : resultado;
      });
    } else if (restricao.__tipo === 'limit') {
      docs = docs.slice(0, restricao.n);
    }
  }

  return { caminho: base.caminho, docs: docs };
}

function snapshotDoc(ref, dados) {
  return {
    id: ref.id,
    ref: ref,
    exists: function () { return dados !== undefined; },
    data: function () { return dados; },
    get: function (campo) { return dados ? valorDoCampo(dados, campo) : undefined; },
  };
}

function snapshotConsulta(caminho, docs) {
  const documentos = docs.map(function (d) {
    return snapshotDoc({ __tipo: 'doc', caminho: caminho + '/' + d.id, id: d.id }, d.dados);
  });
  return {
    docs: documentos,
    empty: documentos.length === 0,
    size: documentos.length,
    forEach: function (cb) { documentos.forEach(cb); },
    docChanges: function () { return []; },
  };
}

function notificar(caminho) {
  const alvos = inscritos.get(caminho);
  if (alvos) alvos.forEach(function (fn) { fn(); });
}

export function doc(_db, ...partes) {
  const caminho = partes.join('/');
  return { __tipo: 'doc', caminho: caminho, id: partes[partes.length - 1] };
}

export function collection(_db, ...partes) {
  return { __tipo: 'col', caminho: partes.join('/') };
}

export function query(base, ...restricoes) {
  return { __tipo: 'query', base: base, restricoes: restricoes };
}

export function where(campo, operador, valor) {
  return { __tipo: 'where', campo: campo, operador: operador, valor: valor };
}

export function orderBy(campo, direcao) {
  return { __tipo: 'orderBy', campo: campo, direcao: direcao || 'asc' };
}

export function limit(n) {
  return { __tipo: 'limit', n: n };
}

export function serverTimestamp() {
  return { __serverTimestamp: true };
}

export function deleteField() {
  return { __deleteField: true };
}

export async function getDoc(ref) {
  aplicarSemente();
  return snapshotDoc(ref, mapa(dividir(ref.caminho).colecao).get(ref.id));
}

export async function getDocs(alvo) {
  aplicarSemente();
  const resultado = documentosDaConsulta(alvo);
  return snapshotConsulta(resultado.caminho, resultado.docs);
}

export async function addDoc(col, dados) {
  aplicarSemente();
  const id = 'e2e-' + Math.random().toString(36).slice(2, 10);
  mapa(col.caminho).set(id, resolverSentinelas(dados));
  notificar(col.caminho);
  return { __tipo: 'doc', caminho: col.caminho + '/' + id, id: id };
}

export async function setDoc(ref, dados, opcoes) {
  aplicarSemente();
  const alvo = dividir(ref.caminho);
  const atual = mapa(alvo.colecao).get(alvo.id) || {};
  const novos = resolverSentinelas(dados);
  mapa(alvo.colecao).set(alvo.id, opcoes && opcoes.merge ? mesclar(atual, novos) : novos);
  notificar(alvo.colecao);
}

export async function updateDoc(ref, dados) {
  aplicarSemente();
  const alvo = dividir(ref.caminho);
  const atual = mapa(alvo.colecao).get(alvo.id);
  if (atual === undefined) throw new Error('No document to update: ' + ref.caminho);
  mapa(alvo.colecao).set(alvo.id, mesclar(atual, resolverSentinelas(dados)));
  notificar(alvo.colecao);
}

export async function deleteDoc(ref) {
  aplicarSemente();
  const alvo = dividir(ref.caminho);
  mapa(alvo.colecao).delete(alvo.id);
  notificar(alvo.colecao);
}

export function onSnapshot(alvo, aoReceber, aoFalhar) {
  aplicarSemente();

  const emissor = function () {
    try {
      if (alvo.__tipo === 'doc') {
        const alvoDoc = dividir(alvo.caminho);
        aoReceber(snapshotDoc(alvo, mapa(alvoDoc.colecao).get(alvoDoc.id)));
      } else {
        const resultado = documentosDaConsulta(alvo);
        aoReceber(snapshotConsulta(resultado.caminho, resultado.docs));
      }
    } catch (erro) {
      if (aoFalhar) aoFalhar(erro);
    }
  };

  emissor();

  const caminho = alvo.__tipo === 'doc' ? dividir(alvo.caminho).colecao : baseDaConsulta(alvo).caminho;
  if (!inscritos.has(caminho)) inscritos.set(caminho, new Set());
  inscritos.get(caminho).add(emissor);

  return function () {
    const alvos = inscritos.get(caminho);
    if (alvos) alvos.delete(emissor);
  };
}

export function runTransaction(_db, callback) {
  aplicarSemente();
  const operacao = {
    get: function (ref) { return getDoc(ref); },
    set: function (ref, dados, opcoes) {
      const alvo = dividir(ref.caminho);
      const atual = mapa(alvo.colecao).get(alvo.id) || {};
      const novos = resolverSentinelas(dados);
      mapa(alvo.colecao).set(alvo.id, opcoes && opcoes.merge ? mesclar(atual, novos) : novos);
      notificar(alvo.colecao);
    },
    update: function (ref, dados) { void updateDoc(ref, dados); },
    delete: function (ref) { void deleteDoc(ref); },
  };
  return Promise.resolve(callback(operacao));
}

export function writeBatch(_db) {
  const fila = [];
  return {
    set: function (ref, dados, opcoes) { fila.push(function () { return setDoc(ref, dados, opcoes); }); },
    update: function (ref, dados) { fila.push(function () { return updateDoc(ref, dados); }); },
    delete: function (ref) { fila.push(function () { return deleteDoc(ref); }); },
    commit: function () { return fila.reduce(function (p, op) { return p.then(op); }, Promise.resolve()); },
  };
}

export const persistentLocalCache = function () { return {}; };
export function initializeFirestore() { return {}; }
export function getFirestore() { return { name: '[e2e]' }; }
export function enableIndexedDbPersistence() { return Promise.resolve(); }
`;
