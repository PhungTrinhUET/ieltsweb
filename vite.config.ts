import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'IELTS Practice – Luyện thi IELTS',
        short_name: 'IELTS',
        description: 'Luyện Reading, Listening, Speaking, Writing IELTS với AI chấm bài',
        lang: 'vi',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7fb',
        theme_color: '#0f766e',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
});
