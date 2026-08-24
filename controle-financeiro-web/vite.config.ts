import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuração do Vite. `base: './'` deixa o build funcionar tanto no Firebase
// Hosting quanto aberto de uma subpasta qualquer.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
