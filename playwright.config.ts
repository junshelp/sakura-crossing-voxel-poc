import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', webServer: { command: 'npm run build && npm run preview -- --host 127.0.0.1', port: 4173, reuseExistingServer: false }, use: { baseURL: 'http://127.0.0.1:4173' } });
