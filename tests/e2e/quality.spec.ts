import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PLACEHOLDER_STRINGS } from '../../scripts/lib/rules.js';
import { TEMPLATES, unlock, url } from './helpers.js';

test.beforeEach(async ({ page }) => { await unlock(page); });

for (const path of TEMPLATES) {
  test(`axe: no serious or critical issues on ${path}`, async ({ page }) => {
    await page.goto(url(path));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('.shopify-payment-button').analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
  });

  test(`no placeholder text on ${path}`, async ({ page }) => {
    await page.goto(url(path));
    const text = await page.locator('body').innerText();
    const html = await page.content();
    const visible = PLACEHOLDER_STRINGS.filter((p) => !['{{', '}}', 'alicdn.com'].includes(p) && text.toLowerCase().includes(p.toLowerCase()));
    const inSource = ['alicdn.com', 'translation missing', 'Liquid error'].filter((p) => html.includes(p));
    const braces = /\{\{|\}\}/.test(text);
    expect([...visible, ...inSource, ...(braces ? ['{{ or }}'] : [])]).toEqual([]);
    expect(text).not.toContain('—');
  });

  test(`one H1 and headings in order on ${path}`, async ({ page }) => {
    await page.goto(url(path));
    await expect(page.locator('main h1')).toHaveCount(1);
    const levels = await page.locator('main :is(h1,h2,h3,h4,h5,h6)').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null || e.classList.contains('visually-hidden')).map((e) => Number(e.tagName[1])));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1], `heading jumps at index ${i}: ${levels.join(',')}`).toBeLessThanOrEqual(1);
  });
}

test('every internal link and menu target resolves', async ({ page, request }) => {
  const seen = new Set<string>();
  const broken: string[] = [];
  for (const path of TEMPLATES.filter((p) => !p.includes('does-not-exist'))) {
    await page.goto(url(path));
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    for (const href of hrefs) {
      if (!href || href === '#' ) { broken.push(`${path}: empty link`); continue; }
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/policies/') || href.startsWith('/account') || href.startsWith('/checkouts')) continue;
      const clean = href.split('#')[0];
      if (seen.has(clean)) continue;
      seen.add(clean);
      const res = await request.get(url(clean));
      if (res.status() >= 400) broken.push(`${path} -> ${clean} (${res.status()})`);
    }
  }
  expect(broken).toEqual([]);
});

test('works at 320 px wide without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/', '/collections/women', '/products/womens-cable-knit-jumper', '/cart']) {
    await page.goto(url(path));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
