import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load the root .env (CI provides real env vars instead), then point the API at the throwaway test DB.
config({ path: resolve(__dirname, '../../.env'), quiet: true });
const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
  DEV_OUTBOX: 'true',
  EMAIL_PROVIDER: 'console',
  REFRESH_COOKIE_PATH: '/auth',
  WEB_ORIGINS: 'http://localhost:3001',
  LOG_LEVEL: 'info',
  // Tests never call real AI providers, whatever keys are in .env.
  LLM_PROVIDER: 'mock',
  STT_PROVIDER: 'mock',
  // Fake secret so webhook signature checks can be tested; never a real key.
  RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret',
  JOBS_ENABLED: 'false',
};
// Global setup runs in this process, workers inherit it.
Object.assign(process.env, testEnv);

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: testEnv,
  },
});
