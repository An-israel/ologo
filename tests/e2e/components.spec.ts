import { expect, test } from '@playwright/test';
import { unlock, url } from './helpers.js';

test.beforeEach(async ({ page }) => { await unlock(page); });

test('predictive search finds a product by part of its name and works with the keyboard', async ({ page }) => {
  await page.goto(url('/'));
  await page.getByRole('link', { name: 'Search' }).click();
  const input = page.getByRole('combobox', { name: /Search the shop/ });
  await expect(input).toBeFocused();
  await input.fill('cable');
  await expect(page.locator('[data-predictive-results] [role="option"]').first()).toBeVisible();
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /PredictiveOption-product-1/);
  await input.press('Enter');
  await expect(page).toHaveURL(/\/products\//);
});

test('size guide drawer opens, traps focus and closes with Escape', async ({ page }) => {
  await page.goto(url('/products/womens-cable-knit-jumper'));
  const opener = page.locator('legend').getByRole('button', { name: /Size guide/ });
  await opener.click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toHaveAttribute('aria-labelledby', /SizeGuideTitle/);
  await expect(dialog.getByRole('table')).toBeVisible();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')) || document.activeElement === document.body)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('delivery estimate skips a weekend and a bank holiday (fixed test date)', async ({ page }) => {
  // Monday 21 December 2026, 09:00 UK. Processing 3, delivery 3 to 7 working days (preview data).
  await page.clock.setFixedTime(new Date('2026-12-21T09:00:00Z'));
  await page.goto(url('/products/womens-cable-knit-jumper'));
  // Processing 22, 23, 24 -> dispatch Thu 24. Delivery skips Fri 25 and Mon 28 (bank holidays), the weekend,
  // Fri 1 Jan (bank holiday) and the next weekend: 3 working days -> Thu 31 Dec, 7 working days -> Thu 7 Jan.
  await expect(page.locator('.product__estimate [data-estimate-text]')).toHaveText('Order today, arrives between Thu 31 Dec and Thu 7 Jan');
});

test('announcement bar can be paused and stepped through', async ({ page }) => {
  await page.goto(url('/'));
  const bar = page.locator('announcement-bar');
  await bar.getByRole('button', { name: 'Next announcement' }).click();
  await expect(bar.locator('[data-slide]:not([hidden])')).toHaveText('14-day returns');
  const pause = bar.locator('[data-pause]');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
});

test('no marketing or analytics pixels load before consent', async ({ page }) => {
  const tracked: string[] = [];
  page.on('request', (r) => { if (/facebook\.(com|net)|tiktok|analytics\.google|googletagmanager|doubleclick/.test(r.url())) tracked.push(r.url()); });
  await page.goto(url('/'));
  await page.waitForTimeout(1500);
  expect(tracked).toEqual([]);
});
