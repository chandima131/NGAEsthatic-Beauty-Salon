import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  plugins: [react(), sites()],
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { watch: { usePolling: process.platform === 'win32', ignored: ['**/outputs/**', '**/dist/**'] } },
  build: { outDir: 'dist/client' },
});
