/**
 * smoke-test (health check, item 56): loads home, a collection, a product, search, adds to bag and opens checkout.
 * Run after every deploy and right after publishing. Exits 1 on any failure.
 *
 *   STORE_URL=https://ornis.shop npm run smoke
 *   STORE_URL=https://<store>.myshopify.com PREVIEW_THEME_ID=123 STOREFRONT_PASSWORD=... npm run smoke
 */
import { chromium, type Page } from 'playwright';
import { findPlaceholders } from './lib/rules.js';

const base = (process.env.STORE_URL ?? 'https://ornis.shop').replace(/\/$/, '');
const themeId = process.env.PREVIEW_THEME_ID;
const withTheme = (path: string) => `${base}${path}${themeId ? `${path.includes('?') ? '&' : '?'}preview_theme_id=${themeId}` : ''}`;

async function unlock(page: Page) {
  if (!process.env.STOREFRONT_PASSWORD) return;
  await page.goto(`${base}/password`);
  if (await page.locator('input[type="password"]').count()) {
    await page.fill('input[type="password"]', process.env.STOREFRONT_PASSWORD);
    await page.press('input[type="password"]', 'Enter');
    await page.waitForLoadState('domcontentloaded');
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results: Array<[string, boolean, string]> = [];
  const step = async (name: string, fn: () => Promise<string | void>) => {
    try { results.push([name, true, (await fn()) ?? '']); } catch (e) { results.push([name, false, (e as Error).message]); }
  };
  await unlock(page);

  await step('home page loads', async () => {
    const res = await page.goto(withTheme('/'));
    if (!res?.ok()) throw new Error(`HTTP ${res?.status()}`);
    const found = findPlaceholders(await page.locator('main').innerText());
    if (found.length) throw new Error(`placeholder text: ${found.join(', ')}`);
  });
  let productUrl = '';
  await step('collection loads with products', async () => {
    await page.goto(withTheme('/collections/all'));
    const href = await page.locator('.card__title a').first().getAttribute('href');
    if (!href) throw new Error('no product cards');
    productUrl = href.split('?')[0];
    return productUrl;
  });
  await step('search finds products', async () => {
    await page.goto(withTheme('/search?q=a&options%5Bprefix%5D=last'));
    if ((await page.locator('[data-product-list] > li').count()) === 0) throw new Error('no results');
  });
  await step('product page adds to bag', async () => {
    await page.goto(withTheme(productUrl));
    const button = page.locator('[data-add-to-bag]');
    if ((await button.getAttribute('aria-disabled')) === 'true') {
      // choose the first available size
      const options = page.locator('variant-picker .option-pill:not(.is-unavailable)');
      if (await options.count()) await options.last().click();
    }
    await button.click();
    await page.locator('#CartDrawer[open]').waitFor({ timeout: 10_000 });
    const count = await page.locator('#CartDrawer .cart-item').count();
    if (!count) throw new Error('bag is empty after add');
  });
  await step('checkout opens', async () => {
    await page.locator('#CartDrawer button[name="checkout"]').click();
    await page.waitForURL(/checkouts|checkout/, { timeout: 20_000 });
    return page.url().replace(/\?.*/, '');
  });

  await browser.close();
  for (const [name, ok, note] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`);
  if (results.some(([, ok]) => !ok)) {
    console.error('\nSmoke test failed. If this is the live store right after publishing, republish the backup theme now (docs/RUNBOOK.md).');
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
