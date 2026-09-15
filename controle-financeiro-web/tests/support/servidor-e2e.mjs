import { createServer } from 'vite';

/// Servidor de desenvolvimento usado pelos testes E2E.
///
/// É um wrapper fino em volta do Vite para duas coisas que o `playwright.config`
/// não alcança:
///   1. desligar o `open: true` do `vite.config.ts` (senão cada execução abre
///      uma aba do navegador);
///   2. pré-otimizar as dependências que o app importa de forma dinâmica
///      (jsPDF) e a de mensagens, para o Vite não recarregar a página no meio
///      de um teste ao descobrir um módulo novo.
///
/// O modo `test` faz o Vite carregar `.env.test`.

const porta = Number(process.env.E2E_PORT ?? 4173);

const servidor = await createServer({
  mode: 'test',
  logLevel: 'warn',
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/messaging',
      'jspdf',
      'jspdf-autotable',
    ],
  },
  server: {
    host: '127.0.0.1',
    port: porta,
    strictPort: true,
    open: false,
    hmr: false,
  },
});

await servidor.listen();
process.stdout.write(`[e2e] Vite servindo em http://127.0.0.1:${porta}\n`);

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    void servidor.close().finally(() => process.exit(0));
  });
}
