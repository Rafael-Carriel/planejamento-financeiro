import { defineConfig } from 'vitest/config';

// Configuração dos testes, separada da do app de propósito: a camada de domínio
// é pura (sem React, sem DOM), então roda no ambiente `node`, que é mais leve, e
// não carrega os plugins de build (PWA, React) que só servem à aplicação.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
