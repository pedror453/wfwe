import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Збірка працює і як Windows-програма (file://), і з веб-сервера шлюзу: дозволяємо лише власні скрипти та запити до сервера.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http: https:; object-src 'none'; base-uri 'none'; form-action 'none'";
const csp = (): Plugin => ({
  name: 'kermo-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('</title>', `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  plugins: [react(), csp()],
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{ts,tsx}'] },
});
