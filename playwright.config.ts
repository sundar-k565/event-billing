import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node --import tsx scripts/test-support/webserver.ts',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
