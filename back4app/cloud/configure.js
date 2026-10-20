'use strict';
// Run with server credentials already in the environment; never prints secrets.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')) });
async function main() {
  const user = await admin.auth().getUserByEmail('rafaelcarriel.deo@gmail.com');
  if (!user.emailVerified) throw new Error('Verifique o e-mail do proprietário no Planeja antes de habilitar o administrador.');
  console.log(`ADMIN_UIDS=${user.uid}`);
  if (process.argv.includes('--enable')) {
    await admin.firestore().doc('billingSystem/config').set({ enabled: true, usageMode: 'lifetime', updatedAt: new Date() });
    console.log('Contagem acumulada ativada. As regras publicadas devem bloquear inserções diretas.');
  } else console.log('Somente consulta: nenhuma configuração foi alterada.');
}
main().catch(() => { console.error('Não foi possível configurar. Confira a credencial de servidor e a existência do e-mail verificado do proprietário.'); process.exitCode = 1; });
