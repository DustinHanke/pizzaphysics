import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        pizza: resolve(import.meta.dirname, 'index.html'),
        noodles: resolve(import.meta.dirname, 'noodles.html'),
      },
    },
  },
});
