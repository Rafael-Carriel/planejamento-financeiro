import { FirebaseError } from 'firebase/app';
import { deleteToken, getToken, getMessaging, isSupported } from 'firebase/messaging';
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { app, auth, bancoDeDados } from '../firebase/config';

/// Notificações push na web com Firebase Cloud Messaging (FCM).
///
/// Daqui para o Firestore, o fluxo é: pedir permissão ao navegador, gerar o
/// token FCM deste navegador e gravá-lo em `usuarios/{uid}/configuracoes.
/// notificacoes`. O token é o endereço para onde o backend envia os avisos —
/// lançamento de recorrência, dívida atrasada, orçamento estourado.
///
/// TODO — o que falta para o aviso chegar de ponta a ponta:
///
/// 1. Chave VAPID (VAPID_KEY abaixo): gere um par de chaves em
///    Firebase Console > Configurações do projeto > Cloud Messaging >
///    Certificados Web Push > Gerar par de chaves, e cole a chave pública.
///    Sem ela o getToken() falha.
///
/// 2. Regras do Firestore: o campo `configuracoes` ainda não é aceito por
///    `perfilValido()` em controle_financeiro/firestore.rules — a gravação do
///    token vai ser recusada até acrescentar 'configuracoes' à lista do
///    hasOnly e publicar (`firebase deploy --only firestore:rules`).
///
/// 3. Cloud Functions (o envio, que é backend e fica fora daqui): um
///    agendador diário lê as recorrências e dívidas que vencem no dia, busca
///    o token em `usuarios/{uid}/configuracoes.notificacoes.tokenWeb` e envia
///    com admin.messaging().send({ token, notification: { title, body } }).
///
/// 4. Service worker (public/firebase-messaging-sw.js): ele mostra a
///    notificação com o app fechado; preencha o firebaseConfig dele com os
///    mesmos valores do .env.local.

// Chave pública Web Push (VAPID) gerada localmente.
// Para gerar nova chave: npx web-push generate-vapid-keys --json
const VAPID_KEY = 'BARPQjy3dAmkJjl5nSa82C-8DkphWQcET8VrlQrzU1BcC5w95zK297VzWpcyTIiv-qQn0YmeORveC2Oe3DJphOY';

/// Garante um service worker para o FCM assinar o push.
///
/// Deixado à solta, o SDK registraria '/firebase-messaging-sw.js' no escopo
/// '/' — o mesmo escopo do sw.js do Workbox (o PWA) em produção, e dois
/// scripts não podem dividir um escopo. Então entregamos nós mesmos a
/// inscrição: o worker que já existe (o do PWA, que importa o nosso script de
/// mensagem via vite.config.ts) ou, quando não há nenhum (npm run dev), o
/// nosso num escopo próprio, que nunca briga com o do PWA.
async function prepararServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registroExistente = await navigator.serviceWorker.getRegistration();
  const registro =
    registroExistente ??
    (await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './fm/' }));

  // Assinar o push com o worker ainda instalando falha em alguns navegadores;
  // o SDK do Firebase espera a ativação quando registra o worker padrão —
  // fazemos o mesmo com o que entregamos.
  const chegando = registro.installing ?? registro.waiting;
  if (!registro.active && chegando) {
    await new Promise<void>((resolver, rejeitar) => {
      const aoMudar = () => {
        if (chegando.state === 'activated') {
          chegando.removeEventListener('statechange', aoMudar);
          resolver();
        } else if (chegando.state === 'redundant') {
          chegando.removeEventListener('statechange', aoMudar);
          rejeitar(new Error('O service worker de notificações não conseguiu ativar. Recarregue a página.'));
        }
      };
      chegando.addEventListener('statechange', aoMudar);
    });
  }

  return registro;
}

/// Pede permissão de notificação ao navegador e, se concedida, gera o token
/// FCM e o grava no Firestore. Só devolve `true` quando tudo deu certo —
/// qualquer tropeço vira um erro com mensagem que diz o que fazer.
export async function solicitarPermissao(): Promise<boolean> {
  const usuario = auth.currentUser;
  if (!usuario) {
    throw new Error('Nenhum usuário autenticado.');
  }

  // Antes de incomodar o usuário com o aviso do navegador: sem chave VAPID o
  // getToken falha logo depois, então a chave vem primeiro.
  if (VAPID_KEY.length === 0) {
    throw new Error(
      'A chave VAPID ainda não foi configurada em servicoNotificacoes.ts. ' +
        'Gere uma em Firebase Console > Configurações do projeto > Cloud Messaging.',
    );
  }

  // isSupported() enxerga o que o Notification não vê: service worker e
  // IndexedDB, que o FCM precisa para funcionar.
  const suportado = await isSupported();
  if (!suportado || typeof Notification === 'undefined') {
    throw new Error('Este navegador não suporta notificações push.');
  }

  const permissao = await Notification.requestPermission();
  if (permissao === 'denied') {
    throw new Error(
      'As notificações estão bloqueadas para este site. Libere nas configurações do navegador ' +
        '(ícone à esquerda do endereço) e tente de novo.',
    );
  }
  if (permissao !== 'granted') {
    throw new Error('Você não permitiu as notificações. Toque de novo no sino e aceite o aviso do navegador.');
  }

  const registro = await prepararServiceWorker();
  const mensageria = getMessaging(app);
  const token = await getToken(mensageria, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registro,
  });

  if (!token) {
    throw new Error('O navegador não devolveu o token de notificação. Tente de novo.');
  }

  await salvarToken(usuario.uid, token);
  return true;
}

/// Grava o token em `usuarios/{uid}/configuracoes.notificacoes`.
///
/// O merge é profundo: `configuracoes` pode um dia guardar outras preferências
/// e nada é apagado aqui. O token da web tem campo próprio (`tokenWeb`) para
/// não misturar com `tokensFcm`, que pertence ao app Flutter.
export async function salvarToken(uid: string, token: string): Promise<void> {
  const referencia = doc(bancoDeDados, 'usuarios', uid);

  await setDoc(
    referencia,
    {
      configuracoes: {
        notificacoes: {
          tokenWeb: token,
          ativadoEm: serverTimestamp(),
        },
      },
    },
    { merge: true },
  );
}

/// Desliga as notificações deste navegador: apaga o token do Firestore e
/// cancela a inscrição de push, quando possível.
///
/// A permissão concedida ao navegador continua lá — revogá-la por código não
/// existe. O que decide se chega aviso é o token no Firestore, que é o que o
/// backend consulta antes de enviar.
export async function removerToken(): Promise<void> {
  const usuario = auth.currentUser;
  if (!usuario) {
    throw new Error('Nenhum usuário autenticado.');
  }

  const referencia = doc(bancoDeDados, 'usuarios', usuario.uid);
  await updateDoc(referencia, {
    'configuracoes.notificacoes': deleteField(),
    atualizadoEm: serverTimestamp(),
  });

  // Best effort: se a inscrição já não existir, não há o que limpar — e o
  // token no Firestore, que é o que vale, já foi apagado.
  try {
    await deleteToken(getMessaging(app));
  } catch (falha: unknown) {
    console.warn('Não foi possível cancelar a inscrição de push no FCM.', falha);
  }
}

/// O token de notificação salvo para este usuário, ou null quando as
/// notificações estão desligadas.
///
/// É o estado do botão — e manda mais que a permissão do navegador, porque
/// permissão concedida não pode ser revogada por código: quem desligou fica
/// desligado mesmo com o navegador ainda autorizado.
export async function lerTokenSalvo(uid: string): Promise<string | null> {
  const referencia = doc(bancoDeDados, 'usuarios', uid);
  const documento = await getDoc(referencia);
  if (!documento.exists()) return null;

  const dados = documento.data();
  const token = dados.configuracoes?.notificacoes?.tokenWeb;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/// Traduz o erro do Firebase para uma frase que diz o que fazer — o mesmo
/// espírito de mensagemDeErro, cobrindo os códigos que o Messaging devolve.
export function mensagemDeErroDeNotificacao(erro: unknown): string {
  const codigo = erro instanceof FirebaseError ? erro.code : '';

  switch (codigo) {
    case 'messaging/permission-blocked':
      return 'As notificações estão bloqueadas para este site. Libere nas configurações do navegador e tente de novo.';
    case 'messaging/permission-default':
      return 'Você fechou o aviso de permissão. Toque de novo no sino e aceite.';
    case 'messaging/unsupported-browser':
      return 'Este navegador não suporta notificações push.';
    case 'messaging/failed-service-worker-registration':
      return 'Não foi possível registrar o service worker de notificações. Recarregue a página e tente de novo.';
    case 'messaging/token-subscribe-failed':
    case 'messaging/token-update-failed':
      return 'Não foi possível gerar o token de notificação. Confira a chave VAPID e a conexão, e tente de novo.';
    case 'messaging/missing-app-config-values':
      return 'Configuração do Firebase incompleta: falta VITE_FIREBASE_MESSAGING_SENDER_ID no .env.local.';
    case 'permission-denied':
      return 'O Firestore recusou a operação. As regras precisam aceitar o campo configuracoes — veja o TODO em servicoNotificacoes.ts.';
    case 'unavailable':
      return 'O Firestore está inacessível agora. Verifique a conexão.';
    default:
      if (erro instanceof Error && erro.message.length > 0) return erro.message;
      return 'Não deu para concluir. Tente de novo.';
  }
}
