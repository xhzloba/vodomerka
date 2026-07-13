import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/vokino-api': {
        target: 'https://api.vokino.pro',
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/vokino-api/, '/v2'),
      },
      '/vokino-image': {
        target: 'https://proxy.vokino.pro',
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/vokino-image/, ''),
      },
      '/vokino-uploads': {
        target: 'https://api.vokino.pro',
        changeOrigin: true,
        secure: true,
        rewrite: (requestPath) => requestPath.replace(/^\/vokino-uploads/, '/uploads'),
      },
    },
  },
});
