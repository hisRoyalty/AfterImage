import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  reporter: [['line']],
  use: { baseURL: 'http://localhost:4173/', browserName: 'chromium', viewport: { width: 1280, height: 840 } },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: true, timeout: 60000 },
});
