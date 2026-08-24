import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/// Lê uma variável de ambiente obrigatória do Vite.
///
/// Falhar aqui, alto e claro, é melhor que o app subir e só quebrar quando o
/// usuário tentar entrar: o erro de configuração aparece na tela de largada.
function obrigatoria(nome: string, valor: string | undefined): string {
  const limpo = (valor ?? '').trim();
  if (limpo.length === 0) {
    throw new Error(
      `Configuração do Firebase incompleta: falta ${nome}.\n\n` +
        'Rode ".\\configurar-web.ps1" na pasta do projeto para gerar o arquivo ' +
        '.env.local, ou copie o .env.example para .env.local e preencha à mão. ' +
        'Depois reinicie o "npm run dev" — o Vite só lê o .env.local ao iniciar.',
    );
  }
  return limpo;
}

const opcoes: FirebaseOptions = {
  apiKey: obrigatoria('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: obrigatoria('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: obrigatoria('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: obrigatoria('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
};

export const app = initializeApp(opcoes);
export const auth = getAuth(app);
export const bancoDeDados = getFirestore(app);

// Mantém a sessão entre recarregamentos da página. É o padrão do SDK web, mas
// deixamos explícito para não depender de mudança de default.
void setPersistence(auth, browserLocalPersistence).catch((erro: unknown) => {
  console.warn('Não foi possível fixar a persistência da sessão.', erro);
});
