import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from '@openai/sites-vite-plugin';

export default defineConfig({
  plugins: [react(), sites()],
  server: { watch: { usePolling: process.platform === 'win32', ignored: ['**/outputs/**', '**/dist/**'] } },
  build: { outDir: 'dist/client' },
});