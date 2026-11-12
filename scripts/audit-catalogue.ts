/**
 * audit-catalogue (read-only): one row per problem per product in reports/catalogue-audit.csv.
 * This is the to-do list for cleaning the existing catalogue. It never changes anything.
 *
 *   npm run audit
 */
import { allProducts, optionIndex, type Product } from './lib/catalogue.js';
import { writeCsv } from './lib/csv.js';
import { RunLog } from './lib/log.js';
import {
  compareAtAllowed, duplicateValues, findPlaceholders, handleIssues, hasSpecJunk, isBadColourName, isSupplierHosted,
  looksLikeFormulaCompareAt, mixedPrices, restrictedCategories, seoIssues, sizesInOrder, titleIssues, wordCount,
} from './lib/rules.js';
import { ShopifyClient } from './lib/shopify.js';

export interface Finding { handle: string; title: string; status: string; problem: string; detail: string; fix: string }

export function auditProduct(p: Product, today = new Date()): Finding[] {
  const out: Finding[] = [];
  const add = (problem: string, detail: string, fix: string) => out.push({ handle: p.handle, title: p.title, status: p.status, problem, detail, fix });

  const placeholders = findPlaceholders(`${p.title} ${p.descriptionHtml}`);
  if (placeholders.length) add('placeholder text', placeholders.join(', '), 'Rewrite the description (normalise-products strips spec text).');
  if (hasSpecJunk(p.descriptionHtml)) add('spec junk', 'Description contains "Brand Name:", "CN:", "Origin:" or similar', 'normalise-products');
  const words = wordCount(p.descriptionHtml);
  if (words < 60) add('missing description', `${words} words`, 'Write 60 to 120 words (Path B CSV re-import).');
  if (/<img[^>]+(alicdn|aliexpress)/i.test(p.descriptionHtml)) add('supplier-hosted image', 'Images inside the description load from the supplier', 'normalise-products');

  titleIssues(p.title).forEach((m) => add('title', m, 'Rename by hand or in the CSV.'));
  handleIssues(p.handle).forEach((m) => add('long handle', m, 'normalise-products (adds a redirect)'));
  seoIssues(p.seo.title ?? undefined, p.seo.description ?? undefined).forEach((m) => add('SEO', m, 'Fill SEO title and description in the CSV.'));

  const colourIdx = optionIndex(p, ['colour', 'color']);
  const sizeIdx = optionIndex(p, ['size']);
  for (const o of p.options) {
    if (!['Colour', 'Size', 'Title'].includes(o.name)) add('variant option name', `"${o.name}" should be "Colour" or "Size"`, 'normalise-products');
  }
  if (colourIdx >= 0) {
    const values = p.options[colourIdx].optionValues.map((v) => v.name);
    values.filter(isBadColourName).forEach((v) => add('bad colour name', `"${v}"`, 'Add a line to templates/variant-mapping.csv, then normalise-products'));
    duplicateValues(values).forEach((v) => add('duplicate colour', `"${v}"`, 'normalise-products'));
    values.filter((v) => v !== v.replace(/\b[a-z]/g, (c) => c.toUpperCase())).forEach((v) => add('colour capitals', `"${v}" should be Title Case`, 'normalise-products'));
  }
  if (sizeIdx >= 0) {
    const sizes = p.options[sizeIdx].optionValues.map((v) => v.name);
    if (!sizesInOrder(sizes)) add('sizes out of order', sizes.join(', '), 'normalise-products');
  }

  const prices = p.variants.map((v) => v.price);
  if (mixedPrices(prices)) add('mixed prices', [...new Set(prices.map((x) => x.toFixed(2)))].join(' / '), 'normalise-products (equalises to the highest price)');
  let history = null;
  try { history = p.metafields.price_history ? JSON.parse(p.metafields.price_history) : null; } catch { add('price history', 'Not valid JSON', 'Fix custom.price_history'); }
  for (const v of p.variants) {
    if (v.compareAtPrice && v.compareAtPrice > v.price) {
      if (looksLikeFormulaCompareAt(v.price, v.compareAtPrice)) add('formula compare-at price', `${v.title}: £${v.price.toFixed(2)} was £${v.compareAtPrice.toFixed(2)}`, 'normalise-products (clears it)');
      else if (!compareAtAllowed(v.compareAtPrice, v.price, history, today)) add('unproven compare-at price', `${v.title}: was £${v.compareAtPrice.toFixed(2)}`, 'normalise-products (clears it)');
    }
    if (!v.weightGrams) add('missing weight', v.title, 'Set weight in the CSV.');
    if (!v.sku) add('missing SKU', v.title, 'normalise-products');
  }

  if (p.images.length < 4) add('too few images', `${p.images.length} image(s)`, 'Add images (prepare-images, then import).');
  p.images.filter((i) => isSupplierHosted(i.url)).forEach((i) => add('supplier-hosted image', i.url, 'normalise-products'));
  const noAlt = p.images.filter((i) => !i.alt?.trim()).length;
  if (noAlt) add('missing alt text', `${noAlt} of ${p.images.length} images`, 'normalise-products drafts alt text for review');

  const isClothing = sizeIdx >= 0 && !/beauty|accessor|jewel|bag/i.test(p.productType);
  if (isClothing && !p.metafields.size_chart) add('no size chart', '', 'Set custom.size_chart');

  const restricted = restrictedCategories(`${p.title} ${p.productType} ${p.tags.join(' ')} ${p.descriptionHtml}`);
  if (restricted.length && p.metafields.restricted_check !== 'true') {
    add('restricted category', restricted.join(', '), p.status === 'ACTIVE' ? 'Set to Draft until the owner confirms it can be sold legally (normalise-products --draft-restricted).' : 'Keep in Draft until checked.');
  }
  return out;
}

async function main() {
  const log = new RunLog('audit-catalogue');
  const client = new ShopifyClient({ log });
  const findings: Finding[] = [];
  let count = 0;
  for await (const product of allProducts(client)) {
    count += 1;
    findings.push(...auditProduct(product));
    if (count % 25 === 0) console.log(`  checked ${count} products...`);
  }
  const file = 'reports/catalogue-audit.csv';
  writeCsv(file, findings as unknown as Record<string, unknown>[], ['handle', 'title', 'status', 'problem', 'detail', 'fix']);
  const byProblem = findings.reduce<Record<string, number>>((acc, f) => { acc[f.problem] = (acc[f.problem] ?? 0) + 1; return acc; }, {});
  const clean = count - new Set(findings.map((f) => f.handle)).size;
  log.info('summary', { products: count, findings: findings.length, clean, byProblem });
  console.log(`\nChecked ${count} products. ${clean} meet the standard, ${count - clean} need work.`);
  console.table(byProblem);
  console.log(`Report: ${file}\nLog: ${log.file}`);
}

if (process.argv[1]?.endsWith('audit-catalogue.ts')) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
