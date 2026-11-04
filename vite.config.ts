import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        challenge: resolve(__dirname, 'challenge/index.html'),
        mobile: resolve(__dirname, 'm/index.html'),
      },
    },
  },
  server: { port: 5173 },
});
