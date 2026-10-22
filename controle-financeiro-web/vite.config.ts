import { defineConfig, loadEnv } from 'vite';
import { execFileSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { ATENDIMENTO } from './src/legal';

// Configuração do Vite. `base: './'` deixa o build funcionar tanto no Firebase
// Hosting quanto aberto de uma subpasta qualquer.
export default defineConfig(({command,mode}) => {
  if(command==='build' && (!ATENDIMENTO.nome || ATENDIMENTO.rota!=='/atendimento')) throw new Error('Configure o SAC antes de publicar.');
  return {
  plugins: [
    {
      name:'planeora-release-info',
      generateBundle(){
        const env=loadEnv(mode,process.cwd(),'VITE_');
        const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
        this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({app:'Planeora',mode,projectId:env.VITE_FIREBASE_PROJECT_ID,revision,builtAt:new Date().toISOString(),legalVersion:'2026-10-20',supportConfigured:Boolean(ATENDIMENTO.nome&&ATENDIMENTO.rota)})});
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.ico'],
      manifest: {
        name: 'Planeora - Planejamento Financeiro',
        short_name: 'Planeora',
        description: 'Controle financeiro pessoal: entradas, saídas, categorias e planejamento mensal.',
        theme_color: '#0E1626',
        background_color: '#0E1626',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cleanup for old browser caches and retired push subscriptions; no messaging SDK.
        importScripts: ['./firebase-messaging-sw.js'],
        globPatterns: ['**/*.{html,js,css,ico,png,svg,webp,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            // Cache de imagens
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
            },
          },
        ],
      },
    }),
  ],
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
};
});
