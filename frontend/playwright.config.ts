import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a real stack (see `make e2e`): E2E_BASE_URL defaults to the
 * isolated test stack on localhost:48100. Set PW_CHROMIUM to use a browser binary you already have.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:48100',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
