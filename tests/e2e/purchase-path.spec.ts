import { expect, test } from '@playwright/test';
import { clearCart, isDesktop, unlock, url } from './helpers.js';

test.beforeEach(async ({ page }) => { await unlock(page); await clearCart(page); });

test('home > category > filter by size > product > colour and size > add to bag > drawer > checkout', async ({ page }) => {
  await page.goto(url('/'));
  await page.getByRole('link', { name: 'Women', exact: true }).first().click();
  await expect(page).toHaveURL(/\/collections\/women/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Filter by size M (sidebar on desktop, drawer on phones)
  if (!isDesktop(page)) await page.getByRole('button', { name: /Filter and sort/ }).click();
  const scope = isDesktop(page) ? page.locator('[data-facets-desktop]') : page.locator('dialog[open]');
  await scope.getByRole('checkbox', { name: /^M\b/ }).check();
  await expect(page).toHaveURL(/filter\.v\.option\.size=M/);
  if (!isDesktop(page)) await page.locator('dialog[open] .drawer__footer button').click();
  await expect(page.locator('[data-active-filters] .chip')).toContainText('M');

  await page.locator('.card__title a', { hasText: 'Cable Knit Jumper' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Cable Knit Jumper/);

  await page.locator('label.option-swatch[title="Navy"]').click();
  await page.locator('variant-picker label.option-pill', { hasText: /^M(,|$)/ }).click();
  await expect(page).toHaveURL(/variant=/);
  await page.locator('[data-add-to-bag]').click();

  const drawer = page.locator('#CartDrawer');
  await expect(drawer).toHaveAttribute('open', '');
  await expect(drawer.locator('.cart-item')).toHaveCount(1);
  await expect(drawer.locator('.cart-item__meta')).toContainText('Navy / M');
  await expect(drawer.locator('.free-delivery')).toContainText(/away from free UK delivery/);
  await expect(page.locator('#LiveRegion')).toHaveText(/Added to your bag/);

  await drawer.getByRole('button', { name: /Checkout/ }).click();
  await expect(page).toHaveURL(/checkout/);
});

test('sold-out size cannot be added', async ({ page }) => {
  await page.goto(url('/products/womens-cable-knit-jumper'));
  await page.locator('label.option-swatch[title="Navy"]').click();
  const xs = page.locator('variant-picker label.option-pill', { hasText: 'XS' });
  await expect(xs).toHaveClass(/is-unavailable/);
  await expect(xs).toBeVisible(); // crossed out but still readable
  await xs.click();
  const button = page.locator('[data-add-to-bag]');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveText(/Sold out/);
  await button.click({ force: true });
  await expect(page.locator('#CartDrawer')).not.toHaveAttribute('open', '');
});

test('quantity stepper and remove update the bag', async ({ page }) => {
  await page.goto(url('/products/cable-knit-beanie'));
  await page.locator('[data-add-to-bag]').click();
  const drawer = page.locator('#CartDrawer');
  await expect(drawer.locator('.cart-item')).toHaveCount(1);
  await drawer.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(drawer.locator('input[data-line="1"]')).toHaveValue('2');
  await drawer.getByRole('button', { name: /Remove/ }).click();
  await expect(drawer.locator('.cart-empty')).toBeVisible();
});
