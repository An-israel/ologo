/**
 * normalise-products: fixes what can be fixed safely and automatically (brief 6.4 step 2).
 *
 *   npm run normalise                              # dry run over every product, prints the plan
 *   npm run normalise -- --apply                   # apply
 *   npm run normalise -- --new --apply             # only Draft products tagged import:new (Path A)
 *   npm run normalise -- --handle some-handle      # one product
 *   npm run normalise -- --draft-restricted --apply  # also set unchecked restricted products to Draft
 *   npm run normalise -- --revert logs/normalise-products-<run>.jsonl --apply
 *
 * What it does: strips supplier spec text, re-hosts description images as product media, renames and reorders
 * variant values (using templates/variant-mapping.csv), equalises colour prices to the highest current price,
 * clears unproven compare-at prices, fills SKUs, drafts alt text (tagged review:alt-text), shortens handles with
 * a redirect. Writes a before/after report. Never deletes anything.
 */
import fs from 'node:fs';
import { flagString, parseArgs } from './lib/args.js';
import { allProducts, optionIndex, productByHandle, type Product } from './lib/catalogue.js';
import { descriptionImageUrls } from './lib/images.js';
import { readCsv, writeCsv } from './lib/csv.js';
import { acquireLock } from './lib/lock.js';
import { readChanges, RunLog } from './lib/log.js';
import {
  compareAtAllowed, draftAltText, handleFromTitle, handleIssues, hasSpecJunk, isBadColourName, makeSku, normaliseColour,
  normaliseSize, restrictedCategories, sortSizes, stripSpecJunk,
} from './lib/rules.js';
import { assertNoUserErrors, CircuitOpenError, ShopifyClient } from './lib/shopify.js';

const args = parseArgs();
const log = new RunLog('normalise-products');
const release = acquireLock('normalise-products');
const client = new ShopifyClient({ log });
const report: Array<Record<string, string>> = [];

function loadMapping(): Record<string, string> {
  const file = 'templates/variant-mapping.csv';
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(readCsv(file).filter((r) => r.raw && r.value).map((r) => [r.raw.trim().toLowerCase(), r.value.trim()]));
}

interface Step { field: string; before: unknown; after: unknown; run: () => Promise<void> }

async function planFor(p: Product, mapping: Record<string, string>): Promise<Step[]> {
  const steps: Step[] = [];
  const entity = { type: 'product', id: p.id, handle: p.handle };

  // 1. Description: strip spec junk and supplier <img> tags, re-host those images as product media.
  if (hasSpecJunk(p.descriptionHtml) || /<img/i.test(p.descriptionHtml)) {
    const after = stripSpecJunk(p.descriptionHtml);
    const rehost = descriptionImageUrls(p.descriptionHtml).slice(0, Math.max(0, 8 - p.images.length));
    steps.push({
      field: 'descriptionHtml', before: p.descriptionHtml, after,
      run: async () => {
        const media = rehost.map((url, i) => ({ originalSource: url, mediaContentType: 'IMAGE', alt: draftAltText(p.title, undefined, p.images.length + i) }));
        const res = await client.request(`mutation($product: ProductUpdateInput!, $media: [CreateMediaInput!]) { productUpdate(product: $product, media: $media) { product { id } userErrors { field message } } }`, {
          product: { id: p.id, descriptionHtml: after, tags: [...new Set([...p.tags, 'review:description'])] }, media: media.length ? media : null,
        });
        assertNoUserErrors(res.productUpdate, `description ${p.handle}`);
      },
    });
  }

  // 2. Variant option names and values.
  for (const option of p.options) {
    const lower = option.name.toLowerCase();
    const isColour = lower === 'colour' || lower === 'color';
    const isSize = lower === 'size';
    if (!isColour && !isSize) continue;
    const newName = isColour ? 'Colour' : 'Size';
    const renames: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();
    for (const v of option.optionValues) {
      const target = isColour ? normaliseColour(v.name, mapping) : { value: normaliseSize(v.name), needsReview: false };
      if (target.needsReview) { log.warn('needs-mapping', { handle: p.handle, value: v.name }); report.push({ handle: p.handle, field: `${newName} value`, before: v.name, after: '', note: 'Add to templates/variant-mapping.csv' }); continue; }
      const key = target.value.toLowerCase();
      if (seen.has(key)) { report.push({ handle: p.handle, field: `${newName} value`, before: v.name, after: target.value, note: 'Duplicate of another value: merge by hand in Shopify admin' }); continue; }
      seen.add(key);
      if (target.value !== v.name) renames.push({ id: v.id, name: target.value });
    }
    if (renames.length || option.name !== newName) {
      steps.push({
        field: `option:${option.id}`, before: { name: option.name, values: option.optionValues }, after: { name: newName, values: renames },
        run: async () => {
          const res = await client.request(`mutation($pid: ID!, $o: OptionUpdateInput!, $v: [OptionValueUpdateInput!]) { productOptionUpdate(productId: $pid, option: $o, optionValuesToUpdate: $v, variantStrategy: LEAVE_AS_IS) { userErrors { field message } } }`, {
            pid: p.id, o: { id: option.id, name: newName }, v: renames,
          });
          assertNoUserErrors(res.productOptionUpdate, `options ${p.handle}`);
        },
      });
    }
    if (isSize) {
      const names = option.optionValues.map((v) => renames.find((r) => r.id === v.id)?.name ?? v.name);
      const sorted = sortSizes(names);
      if (sorted.join('|') !== names.join('|')) {
        steps.push({
          field: `order:${option.id}`, before: names, after: sorted,
          run: async () => {
            const ids = sorted.map((n) => option.optionValues[names.indexOf(n)].id);
            const res = await client.request(`mutation($pid: ID!, $options: [OptionReorderInput!]!) { productOptionsReorder(productId: $pid, options: $options) { userErrors { field message } } }`, {
              pid: p.id, options: [{ id: option.id, values: ids.map((id) => ({ id })) }],
            });
            assertNoUserErrors(res.productOptionsReorder, `reorder sizes ${p.handle}`);
          },
        });
      }
    }
  }

  // 3. Prices: same price across colours (highest current per size), clear unproven compare-at, fill SKUs.
  const sizeIdx = optionIndex(p, ['size']);
  const colourIdx = optionIndex(p, ['colour', 'color']);
  const maxBySize = new Map<string, number>();
  for (const v of p.variants) {
    const key = sizeIdx >= 0 ? v.selectedOptions[sizeIdx]?.value ?? '' : '';
    maxBySize.set(key, Math.max(maxBySize.get(key) ?? 0, v.price));
  }
  let history = null;
  try { history = p.metafields.price_history ? JSON.parse(p.metafields.price_history) : null; } catch { history = null; }
  const variantUpdates: Array<Record<string, unknown>> = [];
  for (const v of p.variants) {
    const update: Record<string, unknown> = { id: v.id };
    const key = sizeIdx >= 0 ? v.selectedOptions[sizeIdx]?.value ?? '' : '';
    const target = maxBySize.get(key)!;
    if (target !== v.price) { update.price = target.toFixed(2); log.change({ type: 'variant', id: v.id, handle: p.handle }, 'price', v.price.toFixed(2), target.toFixed(2), args.apply); }
    if (v.compareAtPrice && !compareAtAllowed(v.compareAtPrice, target, history)) { update.compareAtPrice = null; log.change({ type: 'variant', id: v.id, handle: p.handle }, 'compareAtPrice', v.compareAtPrice.toFixed(2), null, args.apply); }
    if (!v.sku) {
      const colour = colourIdx >= 0 ? normaliseColour(v.selectedOptions[colourIdx]?.value ?? '', mapping).value : undefined;
      const size = sizeIdx >= 0 ? normaliseSize(v.selectedOptions[sizeIdx]?.value ?? '') : undefined;
      update.inventoryItem = { sku: makeSku(p.handle, colour && !isBadColourName(colour) ? colour : undefined, size) };
      log.change({ type: 'variant', id: v.id, handle: p.handle }, 'sku', null, (update.inventoryItem as { sku: string }).sku, args.apply);
    }
    if (Object.keys(update).length > 1) variantUpdates.push(update);
  }
  if (variantUpdates.length) {
    steps.push({
      field: 'variants', before: p.variants.map((v) => ({ id: v.id, price: v.price, compareAtPrice: v.compareAtPrice, sku: v.sku })), after: variantUpdates,
      run: async () => {
        const res = await client.request(`mutation($pid: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $pid, variants: $variants) { userErrors { field message } } }`, { pid: p.id, variants: variantUpdates });
        assertNoUserErrors(res.productVariantsBulkUpdate, `variants ${p.handle}`);
      },
    });
  }

  // 4. Draft alt text for images without it (flagged for review).
  const colours = colourIdx >= 0 ? p.options[colourIdx].optionValues.map((v) => v.name) : [];
  const missingAlt = p.images.map((img, i) => ({ img, i })).filter(({ img }) => !img.alt?.trim());
  if (missingAlt.length) {
    const files = missingAlt.map(({ img, i }) => ({ id: img.id, alt: draftAltText(p.title, colours.length === 1 ? colours[0] : undefined, i) }));
    steps.push({
      field: 'alt', before: missingAlt.map(({ img }) => ({ id: img.id, alt: img.alt })), after: files,
      run: async () => {
        const res = await client.request(`mutation($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { userErrors { field message } } }`, { files });
        assertNoUserErrors(res.fileUpdate, `alt text ${p.handle}`);
        const tag = await client.request(`mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`, { id: p.id, tags: ['review:alt-text'] });
        assertNoUserErrors(tag.tagsAdd, `tag ${p.handle}`);
      },
    });
  }

  // 5. Long supplier handles: shorten and let Shopify create the redirect.
  if (handleIssues(p.handle).length) {
    const newHandle = handleFromTitle(p.title);
    if (newHandle && newHandle !== p.handle) {
      steps.push({
        field: 'handle', before: p.handle, after: newHandle,
        run: async () => {
          const res = await client.request(`mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { product { handle } userErrors { field message } } }`, {
            product: { id: p.id, handle: newHandle, redirectNewHandle: true },
          });
          assertNoUserErrors(res.productUpdate, `handle ${p.handle}`);
        },
      });
    }
  }

  // 6. Restricted products without a completed check go to Draft (only with --draft-restricted).
  if (args.flags['draft-restricted'] && p.status === 'ACTIVE' && p.metafields.restricted_check !== 'true') {
    const cats = restrictedCategories(`${p.title} ${p.productType} ${p.tags.join(' ')} ${p.descriptionHtml}`);
    if (cats.length) {
      steps.push({
        field: 'status', before: 'ACTIVE', after: 'DRAFT',
        run: async () => {
          const res = await client.request(`mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { userErrors { field message } } }`, { product: { id: p.id, status: 'DRAFT' } });
          assertNoUserErrors(res.productUpdate, `draft ${p.handle}`);
        },
      });
    }
  }

  for (const s of steps) {
    if (!s.field.startsWith('variants')) log.change(entity, s.field, s.before, s.after, args.apply);
    report.push({ handle: p.handle, field: s.field, before: JSON.stringify(s.before).slice(0, 300), after: JSON.stringify(s.after).slice(0, 300), note: args.apply ? 'applied' : 'dry run' });
  }
  return steps;
}

async function revert(file: string) {
  const changes = readChanges(file).reverse();
  console.log(`${args.apply ? 'Reverting' : 'DRY RUN: would revert'} ${changes.length} change(s) from ${file}`);
  for (const c of changes) {
    log.info('revert', { entity: c.entity, field: c.field });
    if (!args.apply) { console.log(`  ${c.entity.handle ?? c.entity.id} ${c.field}`); continue; }
    if (c.entity.type === 'product' && ['descriptionHtml', 'handle', 'status'].includes(c.field)) {
      const product: Record<string, unknown> = { id: c.entity.id, [c.field]: c.before };
      if (c.field === 'handle') product.redirectNewHandle = true;
      const res = await client.request(`mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { userErrors { field message } } }`, { product });
      assertNoUserErrors(res.productUpdate, `revert ${c.field}`);
    } else if (c.entity.type === 'variant' && ['price', 'compareAtPrice', 'sku'].includes(c.field)) {
      const product = await client.request(`query($id: ID!) { productVariant(id: $id) { product { id } } }`, { id: c.entity.id });
      const variant: Record<string, unknown> = { id: c.entity.id };
      if (c.field === 'sku') variant.inventoryItem = { sku: c.before ?? '' };
      else variant[c.field] = c.before;
      const res = await client.request(`mutation($pid: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $pid, variants: $variants) { userErrors { field message } } }`, { pid: product.productVariant.product.id, variants: [variant] });
      assertNoUserErrors(res.productVariantsBulkUpdate, `revert ${c.field}`);
    } else if (c.field.startsWith('option:')) {
      const before = c.before as { name: string; values: Array<{ id: string; name: string }> };
      const res = await client.request(`mutation($pid: ID!, $o: OptionUpdateInput!, $v: [OptionValueUpdateInput!]) { productOptionUpdate(productId: $pid, option: $o, optionValuesToUpdate: $v, variantStrategy: LEAVE_AS_IS) { userErrors { field message } } }`, {
        pid: c.entity.id, o: { id: c.field.slice(7), name: before.name }, v: before.values.map((v) => ({ id: v.id, name: v.name })),
      });
      assertNoUserErrors(res.productOptionUpdate, 'revert option');
    } else if (c.field === 'alt') {
      const files = (c.before as Array<{ id: string; alt: string | null }>).map((f) => ({ id: f.id, alt: f.alt ?? '' }));
      const res = await client.request(`mutation($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { userErrors { field message } } }`, { files });
      assertNoUserErrors(res.fileUpdate, 'revert alt');
    } else {
      console.log(`  Skipped ${c.field} on ${c.entity.handle ?? c.entity.id}: revert by hand (see log).`);
    }
  }
}

async function main() {
  if (args.revert) { await revert(args.revert); return; }
  const mapping = loadMapping();
  const handle = flagString(args, 'handle');
  const search = args.flags.new ? 'status:draft tag:import:new' : '';
  console.log(args.apply ? 'Applying fixes...' : 'DRY RUN: nothing will be changed.');
  let products = 0;
  let changed = 0;
  let skipped = 0;
  const source = handle ? (async function* () { const p = await productByHandle(client, handle); if (p) yield p; })() : allProducts(client, search);
  for await (const p of source) {
    products += 1;
    const steps = await planFor(p, mapping);
    if (!steps.length) continue;
    changed += 1;
    console.log(`${p.handle}: ${steps.map((s) => s.field.split(':')[0]).join(', ')}`);
    if (!args.apply) continue;
    // Optimistic locking (item 36): skip products edited by someone else since we read them.
    const fresh = await client.request(`query($id: ID!) { product(id: $id) { updatedAt } }`, { id: p.id });
    if (fresh.product.updatedAt !== p.updatedAt) {
      skipped += 1;
      log.warn('skipped.changed-since-read', { handle: p.handle });
      continue;
    }
    try {
      for (const step of steps) await step.run();
      if (args.flags.new) await client.request(`mutation($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { message } } }`, { id: p.id, tags: ['import:new'] });
    } catch (error) {
      if (error instanceof CircuitOpenError) throw error;
      log.error('product.failed', { handle: p.handle, message: (error as Error).message });
      report.push({ handle: p.handle, field: 'error', before: '', after: '', note: (error as Error).message });
    }
  }
  const file = `reports/normalise-${log.runId}.csv`;
  writeCsv(file, report, ['handle', 'field', 'before', 'after', 'note']);
  console.log(`\n${products} products checked, ${changed} with fixes${skipped ? `, ${skipped} skipped (edited since read; re-run)` : ''}.`);
  console.log(`Before and after report: ${file}\nLog (use with --revert): ${log.file}`);
  if (!args.apply) console.log('No changes made. Re-run with --apply after approval.');
}

main().catch((e) => { log.error('fatal', { message: e.message }); console.error(e.message); process.exitCode = 1; }).finally(release);
