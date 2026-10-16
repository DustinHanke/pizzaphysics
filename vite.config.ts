import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Standalone GPT Sites preview: only the noodle experience is mounted at /.
export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(import.meta.dirname, 'index.html'),
    },
  },
});
