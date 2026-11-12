import type { Page } from '@playwright/test';

/** Adds preview_theme_id when testing an unpublished theme on the real store. */
export function url(path: string): string {
  const id = process.env.PREVIEW_THEME_ID;
  if (!id) return path;
  return `${path}${path.includes('?') ? '&' : '?'}preview_theme_id=${id}`;
}

export async function unlock(page: Page) {
  const password = process.env.STOREFRONT_PASSWORD;
  if (!password) return;
  await page.goto('/password');
  const input = page.locator('input[type="password"]');
  if (await input.count()) {
    await page.locator('details summary').click().catch(() => {});
    await input.fill(password);
    await input.press('Enter');
  }
}

export async function clearCart(page: Page) {
  await page.request.post('/cart/clear.js').catch(() => {});
  await page.request.get('/cart/clear').catch(() => {});
}

export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 990;

/** Templates checked by axe, the placeholder scan and the link check. */
export const TEMPLATES = ['/', '/collections/women', '/products/womens-cable-knit-jumper', '/cart', '/search?q=knit', '/pages/contact', '/pages/faq', '/pages/delivery', '/pages/returns', '/pages/size-guide', '/pages/about', '/this-page-does-not-exist'];
