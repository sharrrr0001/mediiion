import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the running dev stack (`pnpm infra:up && pnpm dev`).
 * In CI, webServer starts it. Uses the dev OTP outbox (never enabled in production).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm --dir ../.. dev',
    url: `${BASE_URL}/p/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
