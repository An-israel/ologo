/**
 * publish-products: sets approved Draft products to Active and publishes them to the Online Store.
 *
 *   npm run publish-products -- --approved approved.csv            # dry run
 *   npm run publish-products -- --approved approved.csv --apply
 *
 * approved.csv has one column, handle. Each product is checked again first; anything that still breaks the
 * data standard (placeholder text, unproven was-price, restricted without a check, too few images, no alt text,
 * no description) is refused and listed.
 */
import { flagString, parseArgs } from './lib/args.js';
import { productByHandle } from './lib/catalogue.js';
import { readCsv } from './lib/csv.js';
import { acquireLock } from './lib/lock.js';
import { RunLog } from './lib/log.js';
import { assertNoUserErrors, ShopifyClient } from './lib/shopify.js';
import { auditProduct } from './audit-catalogue.js';

const BLOCKING = new Set(['placeholder text', 'spec junk', 'missing description', 'formula compare-at price', 'unproven compare-at price', 'too few images', 'missing alt text', 'restricted category', 'bad colour name', 'no size chart', 'missing weight', 'supplier-hosted image']);

const args = parseArgs();
const log = new RunLog('publish-products');

async function main() {
  const file = flagString(args, 'approved');
  if (!file) { console.error('Usage: npm run publish-products -- --approved approved.csv [--apply]'); process.exitCode = 2; return; }
  const release = acquireLock('publish-products');
  const client = new ShopifyClient({ log });
  const pubs = await client.request(`{ publications(first: 20) { nodes { id name } } }`);
  const publicationId = pubs.publications.nodes.find((p: { name: string }) => p.name === 'Online Store')?.id;
  let published = 0; const refused: string[] = [];
  try {
    for (const { handle } of readCsv(file)) {
      if (!handle?.trim()) continue;
      const p = await productByHandle(client, handle.trim());
      if (!p) { refused.push(`${handle}: not found`); continue; }
      const blockers = auditProduct(p).filter((f) => BLOCKING.has(f.problem));
      if (blockers.length) { refused.push(`${handle}: ${blockers.map((b) => `${b.problem}${b.detail ? ` (${b.detail})` : ''}`).join('; ')}`); continue; }
      console.log(`${args.apply ? 'publish' : 'would publish'} ${handle}`);
      log.change({ type: 'product', id: p.id, handle }, 'status', p.status, 'ACTIVE', args.apply);
      if (!args.apply) { published += 1; continue; }
      const res = await client.request(`mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { userErrors { field message } } }`, { product: { id: p.id, status: 'ACTIVE' } });
      assertNoUserErrors(res.productUpdate, handle);
      const pub = await client.request(`mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { id: p.id, input: [{ publicationId }] });
      assertNoUserErrors(pub.publishablePublish, handle);
      published += 1;
    }
  } finally { release(); }
  console.log(`\n${published} ${args.apply ? 'published' : 'ready to publish'}, ${refused.length} refused.`);
  refused.forEach((r) => console.log(`  x ${r}`));
  console.log(`Log: ${log.file}`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
