import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'browser.spec.mjs', workers: 1,
  use: { baseURL: process.env.DEMO_URL || 'http://localhost:8765/', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: process.env.DEMO_URL ? undefined : { command: 'python3 -m http.server 8765', url: 'http://localhost:8765/', reuseExistingServer: true },
});
