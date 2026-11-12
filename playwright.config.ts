import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * By default the tests run against the local preview server (tools/preview), so they work before the store is
 * connected. Set STORE_URL (and PREVIEW_THEME_ID / STOREFRONT_PASSWORD) to run the same tests against Shopify.
 */
const storeUrl = process.env.STORE_URL;
const localChromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: storeUrl ? 2 : 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: storeUrl ?? 'http://localhost:9292',
    trace: 'off',
    launchOptions: fs.existsSync(localChromium) && !process.env.CI ? { executablePath: localChromium } : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: storeUrl ? undefined : { command: 'npm run preview', url: 'http://localhost:9292', reuseExistingServer: true, timeout: 60_000 },
});
