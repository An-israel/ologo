import { describe, expect, it } from 'vitest';
import {
  compareAtAllowed, draftAltText, duplicateValues, findPlaceholders, handleFromTitle, hasSpecJunk, isBadColourName,
  looksLikeFormulaCompareAt, makeSku, mixedPrices, normaliseColour, normaliseSize, priceIssues, restrictedCategories,
  seoIssues, sortSizes, sizesInOrder, stripSpecJunk, titleIssues, childrensIssues, isSupplierHosted,
} from '../../scripts/lib/rules.js';

describe('placeholders and spec junk', () => {
  it('finds Shopify sample text from the audit', () => {
    expect(findPlaceholders('Use collapsible tabs for more detailed information')).toContain('Use collapsible tabs');
    expect(findPlaceholders('Open media {{ index }} in modal')).toEqual(expect.arrayContaining(['{{', '}}', 'Open media']));
    expect(findPlaceholders('A soft cotton jumper.')).toEqual([]);
  });
  it('strips supplier spec dumps but keeps prose', () => {
    const html = '<p>Soft knit jumper for cold days.</p><p>Brand Name: NONE</p><p>CN: Guangdong</p><p>Origin: Mainland China</p><p>Choice: yes</p><img src="https://ae01.alicdn.com/x.jpg">';
    expect(hasSpecJunk(html)).toBe(true);
    const clean = stripSpecJunk(html);
    expect(clean).toBe('<p>Soft knit jumper for cold days.</p>');
    expect(hasSpecJunk(clean)).toBe(false);
  });
});

describe('titles and handles', () => {
  it('flags long titles and supplier words', () => {
    expect(titleIssues("Men's Slim Stretch Denim Jeans")).toEqual([]);
    expect(titleIssues('2025 New Hot Brand Clothing Women Sweater').length).toBeGreaterThanOrEqual(3);
    expect(titleIssues('x'.repeat(71))[0]).toMatch(/under 70/);
  });
  it('builds short readable handles', () => {
    expect(handleFromTitle("Men's Slim Stretch Denim Jeans")).toBe('mens-slim-stretch-denim-jeans');
    expect(handleFromTitle('2025 New Fashion Women Knitted Cardigan With Pockets Long Sleeve')).toBe('women-knitted-cardigan-pockets-long-sleeve');
  });
});

describe('variants', () => {
  it('rejects codes and "as the picture" colour names', () => {
    for (const bad of ['image color 1', 'image colour 5', 'Kj1C7960A', 'as the picture', '7', 'Color 3']) expect(isBadColourName(bad)).toBe(true);
    for (const good of ['Black', 'Sky Blue', 'Off White']) expect(isBadColourName(good)).toBe(false);
  });
  it('normalises colour names and duplicates', () => {
    expect(normaliseColour('red red')).toEqual({ value: 'Red', needsReview: false });
    expect(normaliseColour('BLACK')).toEqual({ value: 'Black', needsReview: false });
    expect(normaliseColour('dusty rose')).toEqual({ value: 'Dusty Rose', needsReview: false });
    expect(normaliseColour('image color 2')).toEqual({ value: 'image color 2', needsReview: true });
    expect(normaliseColour('image color 2', { 'image color 2': 'Navy' })).toEqual({ value: 'Navy', needsReview: false });
    expect(duplicateValues(['Black', 'black', 'Red'])).toEqual(['black']);
  });
  it('orders sizes XS to 3XL and kids ages', () => {
    expect(sortSizes(['L', 'M', 'S', 'XXL', 'XL'])).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect(sizesInOrder(['L', 'M', 'S', 'XXL', 'XL'])).toBe(false);
    expect(normaliseSize('2xl')).toBe('XXL');
    expect(normaliseSize('XXXL')).toBe('3XL');
    expect(normaliseSize('2-3Y')).toBe('2-3 years');
    expect(sortSizes(['4-5 years', '6-12 months', '2-3 years', '12-18 months'])).toEqual(['6-12 months', '12-18 months', '2-3 years', '4-5 years']);
  });
  it('makes SKUs in the ORN format', () => {
    expect(makeSku('mens-slim-stretch-denim-jeans', 'Sky Blue', 'M')).toBe('ORN-MESLSTDE-SKYBLUE-M');
    expect(makeSku('silk-scrunchie-set')).toBe('ORN-SISCSE');
  });
});

describe('prices', () => {
  it('enforces .99 or whole pounds and the 2.5x margin', () => {
    expect(priceIssues(24.99, 8)).toEqual([]);
    expect(priceIssues(25, 10)).toEqual([]);
    expect(priceIssues(22.43)[0]).toMatch(/\.99/);
    expect(priceIssues(19.99, 9)[0]).toMatch(/2\.5 times/);
  });
  it('allows a was-price only with 28+ days of real history', () => {
    const today = new Date('2026-11-12T00:00:00Z');
    expect(compareAtAllowed(null, 20, null, today)).toBe(true);
    expect(compareAtAllowed(44.99, 19.99, null, today)).toBe(false);
    expect(compareAtAllowed(29.99, 24.99, [{ date: '2026-09-01', price: 29.99 }, { date: '2026-11-01', price: 24.99 }], today)).toBe(true);
    expect(compareAtAllowed(29.99, 24.99, [{ date: '2026-10-20', price: 29.99 }, { date: '2026-11-01', price: 24.99 }], today)).toBe(false);
  });
  it('detects the audit patterns', () => {
    expect(looksLikeFormulaCompareAt(19.99, 44.36)).toBe(true);
    expect(looksLikeFormulaCompareAt(19.99, 24.99)).toBe(false);
    expect(mixedPrices([22.43, 22.99])).toBe(true);
    expect(mixedPrices([22.99, 22.99])).toBe(false);
    expect(mixedPrices([19.99, 24.99])).toBe(false);
  });
});

describe('SEO', () => {
  it('requires a short title and a 140-155 character description', () => {
    expect(seoIssues('Men\'s Slim Stretch Denim Jeans | Ornis', 'a'.repeat(150))).toEqual([]);
    expect(seoIssues(undefined, undefined)).toHaveLength(2);
    expect(seoIssues('x'.repeat(61), 'short')).toHaveLength(2);
  });
});

describe('restricted products', () => {
  it('flags the beauty items from the audit', () => {
    expect(restrictedCategories('Vitamin C Brightening Face Serum')).toContain('cosmetics');
    expect(restrictedCategories("Men's Care Spray")).toContain('cosmetics');
    expect(restrictedCategories('Biotin Hair Gummies 60 pack')).toContain('supplements');
    expect(restrictedCategories('Makeup Brush Set 12 pieces')).toEqual([]);
    expect(restrictedCategories('Heated Hair Straightener with UK plug')).toContain('electricals');
    expect(restrictedCategories("Girls' Fleece Hoodie")).toContain('childrens-clothing');
    expect(restrictedCategories("Women's Fleece Hoodie")).toEqual([]);
  });
  it('checks children\'s wording and drawstrings', () => {
    expect(childrensIssues('Girls Sexy Nightwear Set', 'girls-nightwear-set', [], '')).toHaveLength(1);
    expect(childrensIssues("Boys' Hoodie", 'boys-hoodie', [], 'Hood with drawstring')).toHaveLength(1);
  });
});

describe('images', () => {
  it('spots supplier-hosted images and drafts alt text', () => {
    expect(isSupplierHosted('https://ae01.alicdn.com/kf/abc.jpg')).toBe(true);
    expect(isSupplierHosted('https://cdn.shopify.com/s/files/1/abc.jpg')).toBe(false);
    expect(draftAltText('Cable Knit Jumper', 'Cream', 0)).toBe('Cable Knit Jumper in Cream, front view');
  });
});
