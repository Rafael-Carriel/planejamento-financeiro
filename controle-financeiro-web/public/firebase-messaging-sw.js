/*
 * Service worker do Firebase Cloud Messaging (FCM).
 *
 * Ele tem dois papéis:
 *   1. Existir — sem um service worker registrado, o getToken() do FCM falha.
 *   2. Mostrar a notificação quando o aviso chega com o app fechado
 *      (onBackgroundMessage).
 *
 * É usado de dois jeitos: sozinho, num escopo próprio, quando não há outro
 * service worker (npm run dev); e importado pelo sw.js do Workbox em produção
 * (vite.config.ts > workbox.importScripts), que é quem controla o escopo '/'.
 *
 * TODO: preencha o firebaseConfig abaixo com os mesmos valores do .env.local
 * (Firebase Console > Configurações do projeto > Seus apps > app da Web).
 * Enquanto estiver vazio, o worker registra e ativa normalmente, mas o aviso
 * não aparece com o app fechado — só o token é gerado e salvo.
 *
 * Observação: arquivos em public/ não passam pelo Vite, então não há como ler
 * as variáveis do .env.local aqui; os valores são colados à mão, como faz o
 * app Flutter com o google-services.json.
 */

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

if (firebaseConfig.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

  firebase.initializeApp(firebaseConfig);
  const mensageria = firebase.messaging();

  // Mostra a notificação com o app fechado. O título e o corpo vêm da
  // mensagem enviada pelo backend (Cloud Functions); se vier sem a parte de
  // notification, mostra o básico para o aviso não passar em branco.
  mensageria.onBackgroundMessage((payload) => {
    const titulo = (payload.notification && payload.notification.title) || 'Planeja';
    const corpo = (payload.notification && payload.notification.body) || '';
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: './logo-192.png',
      badge: './logo-192.png',
    });
  });
}

// Abre (ou foca) o app quando a notificação é tocada.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // O focus só funciona para janelas dentro do escopo deste worker; quando
      // não consegue, abre o app de novo.
      for (const janela of janelas) {
        try {
          await janela.focus();
          return;
        } catch {
          // Fora do escopo: tenta a próxima ou cai no openWindow abaixo.
        }
      }
      await self.clients.openWindow('./');
    })(),
  );
});
