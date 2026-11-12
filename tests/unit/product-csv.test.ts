import { describe, expect, it } from 'vitest';
import { readCsv } from '../../scripts/lib/csv.js';
import { groupByHandle, validateGroups, MF } from '../../scripts/lib/product-csv.js';

const today = new Date('2026-11-12T00:00:00Z');

function example() {
  return readCsv('templates/ornis_products_example.csv');
}

describe('product CSV validator', () => {
  it('passes the filled example with no errors', () => {
    const problems = validateGroups(groupByHandle(example()), { today });
    expect(problems.filter((p) => p.level === 'error')).toEqual([]);
  });

  it('reports broken variant data from the audit in plain English', () => {
    const rows = example();
    rows[0]['Option1 Value'] = 'image color 1';
    rows[1]['Option2 Value'] = 'XXL';
    rows[2]['Option2 Value'] = 'M';
    rows[3]['Variant Price'] = '22.43';
    rows[4]['Variant Compare At Price'] = '47.43';
    rows[5]['Variant SKU'] = rows[4]['Variant SKU'];
    const problems = validateGroups(groupByHandle(rows), { today }).filter((p) => p.level === 'error').map((p) => p.message);
    expect(problems.join('\n')).toMatch(/not a real colour name/);
    expect(problems.join('\n')).toMatch(/\.99 or be a whole pound/);
    expect(problems.join('\n')).toMatch(/not supported by the price history/);
    expect(problems.join('\n')).toMatch(/used more than once/);
    expect(problems.join('\n')).toMatch(/different prices/);
  });

  it('refuses restricted products until the check is done', () => {
    const rows = example();
    rows[0].Title = 'Vitamin C Glow Face Serum';
    rows[0][MF.restrictedCheck] = 'FALSE';
    const problems = validateGroups(groupByHandle(rows), { today });
    expect(problems.some((p) => /Restricted category \(.*cosmetics/.test(p.message))).toBe(true);
    rows[0][MF.restrictedCheck] = 'TRUE';
    expect(validateGroups(groupByHandle(rows), { today }).some((p) => /Restricted category/.test(p.message))).toBe(false);
  });

  it('needs at least 4 images, alt text and a size chart for clothing', () => {
    const rows = example();
    rows[3]['Image Src'] = '';
    rows[0]['Image Alt Text'] = '';
    rows[0][MF.sizeChart] = '';
    const messages = validateGroups(groupByHandle(rows), { today }).map((p) => p.message).join('\n');
    expect(messages).toMatch(/Only 3 image/);
    expect(messages).toMatch(/no alt text/);
    expect(messages).toMatch(/size chart/);
    // Prepared images in a folder count too
    const withFolder = validateGroups(groupByHandle(rows), { today, imageCount: () => 5 }).map((p) => p.message).join('\n');
    expect(withFolder).not.toMatch(/Only 3 image/);
  });
});
