/**
 * Ornis product CSV: Shopify's product CSV columns plus metafield columns.
 * One row per variant; the first row of a product carries the product-level fields.
 * Pure parsing and validation, used by validate-products and import-products.
 */
import {
  childrensIssues, compareAtAllowed, duplicateValues, findPlaceholders, handleIssues, hasSpecJunk, isBadColourName,
  makeSku, normaliseSize, priceIssues, restrictedCategories, seoIssues, sizesInOrder, titleIssues, wordCount,
  type PriceHistoryEntry,
} from './rules.js';

export const MF = {
  fabric: 'Fabric (product.metafields.custom.fabric)',
  care: 'Care (product.metafields.custom.care)',
  fitNote: 'Fit note (product.metafields.custom.fit_note)',
  sizeChart: 'Size chart (product.metafields.custom.size_chart)',
  modelInfo: 'Model info (product.metafields.custom.model_info)',
  deliveryMin: 'Delivery min days (product.metafields.custom.delivery_min_days)',
  deliveryMax: 'Delivery max days (product.metafields.custom.delivery_max_days)',
  priceHistory: 'Price history (product.metafields.custom.price_history)',
  supplierName: 'Supplier name (product.metafields.custom.supplier_name)',
  supplierUrl: 'Supplier URL (product.metafields.custom.supplier_url)',
  supplierSku: 'Supplier SKU (product.metafields.custom.supplier_sku)',
  restrictedCheck: 'Restricted check (product.metafields.custom.restricted_check)',
  completeTheLook: 'Complete the look (product.metafields.custom.complete_the_look)',
} as const;

export const COLUMNS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
  'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable',
  'Variant Image', 'Variant Weight Unit', 'Cost per item',
  'Image Src', 'Image Position', 'Image Alt Text',
  'SEO Title', 'SEO Description', 'Status',
  ...Object.values(MF),
];

export type Row = Record<string, string>;

export interface ProductGroup {
  handle: string;
  firstLine: number; // 1-based CSV line number including header
  rows: Row[];
  lines: number[];
}

export interface Problem { handle: string; line: number; level: 'error' | 'warning'; message: string }

export function groupByHandle(rows: Row[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  rows.forEach((row, i) => {
    const handle = (row.Handle ?? '').trim();
    const line = i + 2;
    if (!groups.has(handle)) groups.set(handle, { handle, firstLine: line, rows: [], lines: [] });
    const g = groups.get(handle)!;
    g.rows.push(row);
    g.lines.push(line);
  });
  return [...groups.values()];
}

const num = (v: string | undefined) => (v === undefined || v.trim() === '' ? undefined : Number(v));

export function parsePriceHistory(raw: string | undefined): PriceHistoryEntry[] | null {
  if (!raw?.trim()) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('must be a JSON list');
  return parsed.map((e) => ({ date: String(e.date), price: Number(e.price) }));
}

export function tagsOf(row: Row): string[] {
  return (row.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
}

export interface ValidateOptions {
  /** Number of prepared images found for a handle (from work/images/<handle>/), when known. */
  imageCount?: (handle: string) => number | undefined;
  existingSkus?: Set<string>;
  today?: Date;
}

/** Validate grouped CSV rows against the data standard. Returns plain-English problems. */
export function validateGroups(groups: ProductGroup[], opts: ValidateOptions = {}): Problem[] {
  const problems: Problem[] = [];
  const skuSeen = new Map<string, string>();
  const add = (handle: string, line: number, level: Problem['level'], message: string) => problems.push({ handle, line, level, message });

  for (const g of groups) {
    const p = g.rows[0];
    const h = g.handle;
    const L = g.firstLine;
    if (!h) { add('(blank)', L, 'error', 'Handle is empty. Every row needs the product handle.'); continue; }
    handleIssues(h).forEach((m) => add(h, L, 'error', m));

    const title = p.Title ?? '';
    titleIssues(title).forEach((m) => add(h, L, 'error', m));

    const body = p['Body (HTML)'] ?? '';
    const words = wordCount(body);
    if (words < 60 || words > 120) add(h, L, 'error', `Description has ${words} words; write 60 to 120 words in British English.`);
    if (hasSpecJunk(body)) add(h, L, 'error', 'Description contains supplier spec lines (for example "Brand Name:" or "Origin:"). Remove them.');
    const placeholders = findPlaceholders(`${title} ${body} ${p['SEO Title'] ?? ''} ${p['SEO Description'] ?? ''}`);
    if (placeholders.length) add(h, L, 'error', `Placeholder text found: ${placeholders.join(', ')}.`);
    if (/—/.test(`${title} ${body}`)) add(h, L, 'warning', 'Customer copy contains an em dash; use a comma or full stop instead.');
    if (/\b(color|favorite|sweater|pants)\b/i.test(`${title} ${body}`)) add(h, L, 'warning', 'Use British English (colour, favourite, jumper, trousers).');

    if (!p.Type?.trim()) add(h, L, 'error', 'Product type is empty.');
    const tags = tagsOf(p);
    for (const prefix of ['gender:', 'category:', 'season:', 'price:']) {
      if (!tags.some((t) => t.toLowerCase().startsWith(prefix))) add(h, L, 'error', `Tags need a "${prefix}" tag (for example ${prefix}${prefix === 'gender:' ? 'women' : prefix === 'category:' ? 'knitwear' : prefix === 'season:' ? 'winter' : 'under-25'}).`);
    }

    seoIssues(p['SEO Title'], p['SEO Description']).forEach((m) => add(h, L, 'error', m));

    // Options and variants
    const o1 = (p['Option1 Name'] ?? '').trim();
    const o2 = (p['Option2 Name'] ?? '').trim();
    const names = [o1, o2].filter(Boolean);
    for (const name of names) {
      if (!['Colour', 'Size', 'Title'].includes(name)) add(h, L, 'error', `Option name "${name}" must be "Colour" or "Size".`);
    }
    const colourIdx = o1 === 'Colour' ? 1 : o2 === 'Colour' ? 2 : 0;
    const sizeIdx = o1 === 'Size' ? 1 : o2 === 'Size' ? 2 : 0;
    const colours: string[] = [];
    const sizes: string[] = [];
    const variantRows = g.rows.map((row, i) => ({ row, line: g.lines[i] })).filter(({ row }) => (row['Variant Price'] ?? '').trim() !== '' || (row['Option1 Value'] ?? '').trim() !== '');
    const prices: number[] = [];
    let priceHistory: PriceHistoryEntry[] | null = null;
    try { priceHistory = parsePriceHistory(p[MF.priceHistory]); } catch (e) { add(h, L, 'error', `Price history is not valid JSON: ${(e as Error).message}. Use [{"date":"2026-10-01","price":24.99}].`); }

    const combos = new Set<string>();
    for (const { row, line } of variantRows) {
      const colour = colourIdx ? (row[`Option${colourIdx} Value`] ?? '').trim() : '';
      const size = sizeIdx ? (row[`Option${sizeIdx} Value`] ?? '').trim() : '';
      if (colourIdx) {
        if (isBadColourName(colour)) add(h, line, 'error', `Colour "${colour}" is not a real colour name. Use names like "Sky Blue" or "Black".`);
        else if (colour !== colour.replace(/\b[a-z]/g, (c) => c.toUpperCase())) add(h, line, 'error', `Colour "${colour}" must be in Title Case.`);
        if (!colours.includes(colour)) colours.push(colour);
      }
      if (sizeIdx) {
        if (normaliseSize(size) !== size) add(h, line, 'error', `Size "${size}" should be written "${normaliseSize(size)}".`);
        if (!sizes.includes(size)) sizes.push(size);
      }
      const combo = `${colour}|${size}`;
      if (combos.has(combo)) add(h, line, 'error', `Duplicate variant ${colour} ${size}.`);
      combos.add(combo);

      const price = num(row['Variant Price']);
      const cost = num(row['Cost per item']);
      if (price === undefined || Number.isNaN(price)) add(h, line, 'error', 'Variant price is missing.');
      else {
        prices.push(price);
        priceIssues(price, cost).forEach((m) => add(h, line, 'error', m));
        const compare = num(row['Variant Compare At Price']);
        if (compare && !compareAtAllowed(compare, price, priceHistory, opts.today)) {
          add(h, line, 'error', `Compare-at price £${compare.toFixed(2)} is not supported by the price history. Leave it empty unless the item really sold at that price for at least 28 days.`);
        }
      }
      if (cost === undefined) add(h, line, 'warning', 'Cost per item is empty; the weekly report cannot check the 2.5x margin.');

      const sku = (row['Variant SKU'] ?? '').trim();
      const expected = makeSku(h, colour || undefined, size || undefined);
      if (!sku) add(h, line, 'error', `SKU is empty. Use ${expected}.`);
      else {
        if (!sku.startsWith('ORN-')) add(h, line, 'error', `SKU "${sku}" must follow ORN-<handle-code>-<colour>-<size>, for example ${expected}.`);
        if (skuSeen.has(sku) && skuSeen.get(sku) !== `${h}|${combo}`) add(h, line, 'error', `SKU "${sku}" is used more than once.`);
        if (opts.existingSkus?.has(sku)) add(h, line, 'warning', `SKU "${sku}" already exists in the store; this row will update it.`);
        skuSeen.set(sku, `${h}|${combo}`);
      }
      const grams = num(row['Variant Grams']);
      if (!grams || grams <= 0) add(h, line, 'error', 'Weight (Variant Grams) is empty; shipping rates need it.');
    }
    if (variantRows.length === 0) add(h, L, 'error', 'No variant rows with a price.');
    if (new Set(prices.map((x) => x.toFixed(2))).size > 1 && !sizeIdx) add(h, L, 'error', 'Colours have different prices. Use one price per product.');
    if (colourIdx && sizeIdx) {
      // Same price across colours for each size
      const bySize = new Map<string, Set<string>>();
      for (const { row } of variantRows) {
        const size = (row[`Option${sizeIdx} Value`] ?? '').trim();
        const price = row['Variant Price'];
        if (!bySize.has(size)) bySize.set(size, new Set());
        bySize.get(size)!.add(price);
      }
      if ([...bySize.values()].some((s) => s.size > 1)) add(h, L, 'error', 'Colours of the same size have different prices. Use the same price across colours.');
    }
    duplicateValues(colours).forEach((d) => add(h, L, 'error', `Colour "${d}" appears twice with different capitals.`));
    if (sizes.length > 1 && !sizesInOrder(sizes)) add(h, L, 'error', `Sizes are out of order (${sizes.join(', ')}). Use XS to 3XL, or ages in order.`);

    // Images
    const imageRows = g.rows.filter((r) => (r['Image Src'] ?? '').trim());
    const prepared = opts.imageCount?.(h);
    const imageTotal = Math.max(imageRows.length, prepared ?? 0);
    if (imageTotal < 4) add(h, L, 'error', `Only ${imageTotal} image(s). Every product needs at least 4 (put them in work/images/${h}/ and run prepare-images).`);
    for (const r of imageRows) {
      if (/alicdn\.com|aliexpress/i.test(r['Image Src'])) add(h, L, 'warning', 'Image is hosted by the supplier; import-products re-uploads it to Shopify.');
      if (!(r['Image Alt Text'] ?? '').trim()) add(h, L, 'error', `Image ${r['Image Position'] || ''} has no alt text. Describe the item, colour and view.`);
    }

    // Size chart for clothing
    const category = tags.find((t) => t.toLowerCase().startsWith('category:'))?.toLowerCase() ?? '';
    const isClothing = sizeIdx > 0 && !/beauty|accessor|jewel|bag|gift/.test(category);
    if (isClothing && !p[MF.sizeChart]?.trim()) add(h, L, 'error', 'Clothing needs a size chart (Size chart column: the size_chart handle, for example womens-tops).');
    if (isClothing && !p[MF.fabric]?.trim()) add(h, L, 'warning', 'Fabric is empty. Fill it only with what the supplier states.');

    // Delivery
    const dmin = num(p[MF.deliveryMin]);
    const dmax = num(p[MF.deliveryMax]);
    if ((dmin === undefined) !== (dmax === undefined)) add(h, L, 'error', 'Fill both delivery min and max days, or neither.');
    if (dmax !== undefined && dmax > 12) add(h, L, 'error', `Delivery takes up to ${dmax} working days; the sourcing rule is 12 or fewer.`);

    // Restricted products
    const text = `${title} ${p.Type ?? ''} ${tags.join(' ')} ${body}`;
    const restricted = restrictedCategories(text);
    if (restricted.length && (p[MF.restrictedCheck] ?? '').trim().toLowerCase() !== 'true') {
      add(h, L, 'error', `Restricted category (${restricted.join(', ')}). Complete the checks in docs/OPERATOR_GUIDE.md section 2, then set Restricted check to TRUE.`);
    }
    if (restricted.includes('childrens-clothing')) childrensIssues(title, h, tags, body).forEach((m) => add(h, L, 'error', m));
  }
  return problems;
}
