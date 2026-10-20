import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
if (existsSync('.env.local')) loadEnvFile('.env.local');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop-firefox',
      testMatch: '**/hardening.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    { name: 'mobile-webkit', testMatch: '**/hardening.spec.ts', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      APP_ENV: 'test',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
      NEXT_TELEMETRY_DISABLED: '1',
      DATABASE_ENABLED: process.env.TEST_READER_URL ? 'true' : 'false',
      DATABASE_URL: process.env.TEST_READER_URL || '',
      DIRECT_URL: '',
      CATALOG_ALLOW_SAMPLES: process.env.TEST_READER_URL ? 'true' : 'false',
      AUTH_ENABLED: process.env.TEST_ACCOUNT_DATABASE_URL ? 'true' : 'false',
      ACCOUNT_DATABASE_URL: process.env.TEST_ACCOUNT_DATABASE_URL || '',
      CART_ENABLED: process.env.TEST_COMMERCE_DATABASE_URL ? 'true' : 'false',
      LOCAL_CHECKOUT_ENABLED: process.env.TEST_COMMERCE_DATABASE_URL ? 'true' : 'false',
      COMMERCE_DATABASE_URL: process.env.TEST_COMMERCE_DATABASE_URL || '',
      PAYMENTS_ENABLED: process.env.TEST_PAYMENT_DATABASE_URL ? 'true' : 'false',
      PAYMENT_DATABASE_URL: process.env.TEST_PAYMENT_DATABASE_URL || '',
      ADMIN_DATABASE_URL: process.env.TEST_ADMIN_DATABASE_URL || '',
      COMMUNICATIONS_DATABASE_URL: process.env.TEST_COMMUNICATIONS_DATABASE_URL || '',
      EMAIL_ENABLED: 'false',
      EMAIL_CAPTURE_ENABLED: process.env.TEST_COMMUNICATIONS_DATABASE_URL ? 'true' : 'false',
    },
  },
});
