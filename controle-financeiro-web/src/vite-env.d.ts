/// <reference types="vite/client" />

// Tipos das variáveis de ambiente do projeto. O `vite/client` já declara o
// `import.meta.env`; aqui só acrescentamos as chaves que este app usa, para o
// TypeScript reclamar de erro de digitação no nome da variável.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}
