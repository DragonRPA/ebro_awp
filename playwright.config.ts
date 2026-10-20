import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1, // 동시성 경합 및 DB 충돌 방지
  retries: 0,
  timeout: 180000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
