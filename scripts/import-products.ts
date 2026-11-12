/**
 * import-products (Path B): creates or updates products from the Ornis CSV, always as Draft.
 *
 *   npm run import -- products.csv            # dry run: validates and shows what would be created/updated
 *   npm run import -- products.csv --apply    # import the valid products
 *
 * - Validates first (same rules as validate-products). Products with errors are not imported; their rows go to
 *   failed_rows.csv with the reason, ready to fix and re-run.
 * - Idempotent: uses Shopify's productSet keyed by handle, so re-running updates instead of duplicating, and
 *   images already uploaded (same file name) are reused, not uploaded again.
 * - Images come from work/images/<handle>/prepared/ (run prepare-images first) or from allow-listed URLs.
 * - Saga (item 19): if the images fail after the product exists, it stays Draft and the row goes to failed_rows.csv.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.js';
import { productByHandle, type Product } from './lib/catalogue.js';
import { readCsv, writeCsv } from './lib/csv.js';
import { isAllowedImageUrl, naturalSort } from './lib/images.js';
import { acquireLock } from './lib/lock.js';
import { RunLog } from './lib/log.js';
import { groupByHandle, MF, tagsOf, validateGroups, type ProductGroup } from './lib/product-csv.js';
import { assertNoUserErrors, CircuitOpenError, ShopifyClient } from './lib/shopify.js';
import { PRODUCT_METAFIELDS } from './lib/store-plan.js';
import { preparedImageCount } from './validate-products.js';

const args = parseArgs();
const file = args.positional[0];
const log = new RunLog('import-products');
const failed: Array<Record<string, string>> = [];
let client: ShopifyClient;

const MF_KEYS: Record<string, string> = {
  [MF.fabric]: 'fabric', [MF.care]: 'care', [MF.fitNote]: 'fit_note', [MF.sizeChart]: 'size_chart', [MF.modelInfo]: 'model_info',
  [MF.deliveryMin]: 'delivery_min_days', [MF.deliveryMax]: 'delivery_max_days', [MF.priceHistory]: 'price_history',
  [MF.supplierName]: 'supplier_name', [MF.supplierUrl]: 'supplier_url', [MF.supplierSku]: 'supplier_sku',
  [MF.restrictedCheck]: 'restricted_check', [MF.completeTheLook]: 'complete_the_look',
};

function fail(g: ProductGroup, reason: string) {
  g.rows.forEach((row, i) => failed.push({ ...row, 'Failed reason': reason, 'CSV line': String(g.lines[i]) }));
  log.error('product.failed', { handle: g.handle, reason });
}

/** Cache lookups during a run (item 2). */
const cache = new Map<string, string | null>();
async function cached(key: string, load: () => Promise<string | null>): Promise<string | null> {
  if (!cache.has(key)) cache.set(key, await load());
  return cache.get(key)!;
}

async function metafieldValue(key: string, raw: string): Promise<string | null> {
  const v = raw.trim();
  if (!v) return null;
  switch (key) {
    case 'care': return JSON.stringify(v.split('|').map((s) => s.trim()).filter(Boolean));
    case 'restricted_check': return /^(true|yes|1)$/i.test(v) ? 'true' : 'false';
    case 'price_history': return JSON.stringify(JSON.parse(v));
    case 'size_chart': {
      const id = await cached(`size_chart:${v}`, async () => (await client.request(`query($h: MetaobjectHandleInput!) { metaobjectByHandle(handle: $h) { id } }`, { h: { type: 'size_chart', handle: v } })).metaobjectByHandle?.id ?? null);
      if (!id) throw new Error(`Size chart "${v}" does not exist. Create it in Content > Metaobjects > Size chart first.`);
      return id;
    }
    case 'complete_the_look': {
      const ids: string[] = [];
      for (const handle of v.split('|').map((s) => s.trim()).filter(Boolean)) {
        const id = await cached(`product:${handle}`, async () => (await client.request(`query($h: String!) { productByIdentifier(identifier: { handle: $h }) { id } }`, { h: handle })).productByIdentifier?.id ?? null);
        if (id) ids.push(id);
        else log.warn('complete-the-look.missing', { handle });
      }
      return ids.length ? JSON.stringify(ids) : null;
    }
    default: return v;
  }
}

async function uploadLocal(filePath: string): Promise<string> {
  const stat = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const mimeType = filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const staged = await client.request(`mutation($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`, {
    input: [{ filename, mimeType, resource: 'IMAGE', httpMethod: 'POST', fileSize: String(stat.size) }],
  });
  assertNoUserErrors(staged.stagedUploadsCreate, `stage ${filename}`);
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: mimeType }), filename);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(target.url, { method: 'POST', body: form, signal: controller.signal });
    if (!res.ok) throw new Error(`Upload of ${filename} failed with HTTP ${res.status}`);
  } finally { clearTimeout(timer); }
  return target.resourceUrl;
}

interface ImagePlan { filename: string; alt: string; source: string; local: boolean }

function imagesFor(g: ProductGroup): ImagePlan[] {
  const altByName = new Map<string, string>();
  const rowsWithImage = g.rows.filter((r) => r['Image Src']?.trim());
  rowsWithImage.forEach((r) => altByName.set(path.basename(r['Image Src'].trim()), r['Image Alt Text']?.trim() ?? ''));
  const preparedDir = path.join('work/images', g.handle, 'prepared');
  if (fs.existsSync(preparedDir)) {
    return naturalSort(fs.readdirSync(preparedDir).filter((f) => /\.(jpe?g|webp)$/i.test(f))).map((f, i) => ({
      filename: f, alt: altByName.get(f) ?? rowsWithImage[i]?.['Image Alt Text']?.trim() ?? '', source: path.join(preparedDir, f), local: true,
    }));
  }
  return rowsWithImage.map((r) => ({ filename: path.basename(new URL(r['Image Src'].trim(), 'https://x.invalid/').pathname), alt: r['Image Alt Text']?.trim() ?? '', source: r['Image Src'].trim(), local: false }));
}

async function buildInput(g: ProductGroup, existing: Product | null) {
  const p = g.rows[0];
  const o1 = p['Option1 Name']?.trim();
  const o2 = p['Option2 Name']?.trim();
  const optionNames = [o1, o2].filter((n): n is string => Boolean(n) && n !== 'Title');
  const variantRows = g.rows.filter((r) => r['Variant Price']?.trim());

  const productOptions = optionNames.map((name, i) => ({
    name, position: i + 1,
    values: [...new Set(variantRows.map((r) => r[`Option${i + 1} Value`].trim()))].map((value) => ({ name: value })),
  }));

  // Images: reuse media already on the product with the same file name, upload the rest.
  const files: Array<Record<string, unknown>> = [];
  const fileByName = new Map<string, Record<string, unknown>>();
  for (const img of imagesFor(g)) {
    const reuse = existing?.images.find((m) => new URL(m.url).pathname.split('/').pop()?.startsWith(img.filename.replace(/\.[^.]+$/, '')));
    let entry: Record<string, unknown>;
    if (reuse) entry = { id: reuse.id, alt: img.alt };
    else if (img.local) entry = { originalSource: args.apply ? await uploadLocal(img.source) : `(upload ${img.source})`, contentType: 'IMAGE', alt: img.alt, filename: img.filename };
    else if (isAllowedImageUrl(img.source) || img.source.startsWith('https://cdn.shopify.com/')) entry = { originalSource: img.source, contentType: 'IMAGE', alt: img.alt, filename: img.filename };
    else throw new Error(`Image ${img.source} is not on an allowed host. Download it into work/images/${g.handle}/ and run prepare-images.`);
    files.push(entry);
    fileByName.set(img.filename, entry);
  }

  const variants = variantRows.map((r) => {
    const variantImage = r['Variant Image']?.trim() ? fileByName.get(path.basename(r['Variant Image'].trim())) : undefined;
    const grams = Number(r['Variant Grams'] || 0);
    return {
      optionValues: optionNames.map((name, i) => ({ optionName: name, name: r[`Option${i + 1} Value`].trim() })),
      price: r['Variant Price'].trim(),
      compareAtPrice: r['Variant Compare At Price']?.trim() || null,
      sku: r['Variant SKU'].trim(),
      taxable: (r['Variant Taxable'] ?? 'TRUE').toUpperCase() !== 'FALSE',
      inventoryPolicy: (r['Variant Inventory Policy'] ?? 'deny').toLowerCase() === 'continue' ? 'CONTINUE' : 'DENY',
      inventoryItem: {
        sku: r['Variant SKU'].trim(),
        tracked: (r['Variant Inventory Tracker'] ?? '').toLowerCase() === 'shopify',
        cost: r['Cost per item']?.trim() || undefined,
        requiresShipping: true,
        measurement: { weight: { value: grams, unit: 'GRAMS' } },
      },
      ...(variantImage ? { file: variantImage } : {}),
    };
  });

  const types = Object.fromEntries(PRODUCT_METAFIELDS.map((d) => [d.key, d.type]));
  const metafields: Array<Record<string, string>> = [];
  for (const [column, key] of Object.entries(MF_KEYS)) {
    const value = await metafieldValue(key, p[column] ?? '');
    if (value !== null) metafields.push({ namespace: 'custom', key, type: types[key], value });
  }

  return {
    title: p.Title.trim(),
    handle: g.handle,
    descriptionHtml: p['Body (HTML)'],
    vendor: p.Vendor?.trim() || 'Ornis',
    productType: p.Type.trim(),
    tags: [...tagsOf(p), ...(existing ? [] : ['new'])],
    status: existing ? existing.status : 'DRAFT',
    seo: { title: p['SEO Title']?.trim(), description: p['SEO Description']?.trim() },
    productOptions: productOptions.length ? productOptions : undefined,
    variants,
    metafields,
    files: files.length ? files : undefined,
  };
}

async function main() {
  if (!file) { console.error('Usage: npm run import -- products.csv [--apply]'); process.exitCode = 2; return; }
  const groups = groupByHandle(readCsv(file));
  const problems = validateGroups(groups, { imageCount: (h) => preparedImageCount(h) });
  const errorsByHandle = new Map<string, string[]>();
  problems.filter((p) => p.level === 'error').forEach((p) => errorsByHandle.set(p.handle, [...(errorsByHandle.get(p.handle) ?? []), `line ${p.line}: ${p.message}`]));

  client = new ShopifyClient({ log });
  const release = acquireLock('import-products');
  console.log(args.apply ? 'Importing as Draft...' : 'DRY RUN: nothing will be changed.');
  let created = 0; let updated = 0;
  try {
    for (const g of groups) {
      const errors = errorsByHandle.get(g.handle);
      if (errors) { fail(g, errors.join(' | ')); console.log(`x ${g.handle}: ${errors.length} error(s), see failed_rows.csv`); continue; }
      try {
        const existing = await productByHandle(client, g.handle);
        const input = await buildInput(g, existing);
        console.log(`${existing ? 'update' : 'create'} ${g.handle} (${input.variants.length} variants, ${input.files?.length ?? 0} images)`);
        log.info('product.plan', { handle: g.handle, action: existing ? 'update' : 'create', variants: input.variants.length });
        if (existing) log.change({ type: 'product', id: existing.id, handle: g.handle }, 'productSet', { title: existing.title, descriptionHtml: existing.descriptionHtml, status: existing.status }, { title: input.title }, args.apply);
        if (!args.apply) { existing ? updated++ : created++; continue; }
        const res = await client.request(`mutation($input: ProductSetInput!, $identifier: ProductSetIdentifiers) { productSet(synchronous: true, input: $input, identifier: $identifier) { product { id status media(first: 20) { nodes { status } } } userErrors { field message code } } }`, {
          input, identifier: { handle: g.handle },
        }, 500);
        assertNoUserErrors(res.productSet, g.handle);
        const media = res.productSet.product.media.nodes;
        if (media.some((m: { status: string }) => m.status === 'FAILED')) {
          fail(g, 'Product saved as Draft but one or more images failed to process. Re-run import for this handle.');
          continue;
        }
        existing ? updated++ : created++;
      } catch (error) {
        if (error instanceof CircuitOpenError) throw error;
        fail(g, (error as Error).message);
        console.log(`x ${g.handle}: ${(error as Error).message}`);
      }
    }
  } finally {
    release();
    if (failed.length) writeCsv('failed_rows.csv', failed);
  }
  console.log(`\n${created} to create, ${updated} to update, ${new Set(failed.map((f) => f.Handle)).size} failed${failed.length ? ' (see failed_rows.csv)' : ''}.`);
  console.log(`Log: ${log.file}`);
  if (!args.apply) console.log('No changes made. Re-run with --apply after approval.');
  else console.log('Products are in Draft. Check them in the theme preview, then run publish-products with an approved list.');
}

main().catch((e) => { log.error('fatal', { message: e.message }); console.error(e.message); process.exitCode = 1; });
