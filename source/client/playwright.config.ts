import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1360, height: 860 }, locale: 'uk-UA' },
  webServer: [
    { command: 'node ../mock-server/server.mjs', port: 8480, reuseExistingServer: true },
    { command: 'npx vite preview', port: 4173, reuseExistingServer: true },
  ],
});
