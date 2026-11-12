/**
 * backup-export (item 84): weekly export of products, collections, pages, menus, redirects and metaobjects
 * to backup/<date>/ as JSON, committed by the scheduled workflow. Read-only against the store.
 *
 *   npm run backup
 */
import fs from 'node:fs';
import path from 'node:path';
import { allProducts } from './lib/catalogue.js';
import { RunLog } from './lib/log.js';
import { ShopifyClient } from './lib/shopify.js';
import { METAOBJECTS } from './lib/store-plan.js';

const log = new RunLog('backup-export');
const client = new ShopifyClient({ log });

async function collect<T>(query: string, pathTo: string[], variables: Record<string, unknown> = {}): Promise<T[]> {
  const out: T[] = [];
  for await (const n of client.paginate<T>(query, pathTo, variables)) out.push(n);
  return out;
}

async function main() {
  const dir = path.join('backup', new Date().toISOString().slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  const write = (name: string, data: unknown) => {
    fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
    console.log(`${name}: ${Array.isArray(data) ? data.length : 1}`);
  };

  const products = [];
  for await (const p of allProducts(client)) products.push(p);
  write('products', products);
  write('collections', await collect(`query($after: String) { collections(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes { id handle title descriptionHtml sortOrder seo { title description } ruleSet { appliedDisjunctively rules { column relation condition } } } } }`, ['collections']));
  write('pages', await collect(`query($after: String) { pages(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes { id handle title body templateSuffix isPublished } } }`, ['pages']));
  write('redirects', await collect(`query($after: String) { urlRedirects(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { id path target } } }`, ['urlRedirects']));
  const menus = await client.request(`{ menus(first: 50) { nodes { id handle title items { title type url resourceId items { title type url resourceId items { title type url resourceId } } } } } }`);
  write('menus', menus.menus.nodes);
  const metaobjects: Record<string, unknown[]> = {};
  for (const def of METAOBJECTS) {
    metaobjects[def.type] = await collect(`query($after: String, $type: String!) { metaobjects(type: $type, first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes { id handle fields { key value } } } }`, ['metaobjects'], { type: def.type });
  }
  write('metaobjects', metaobjects);
  log.info('summary', { dir, products: products.length });
  console.log(`\nBackup written to ${dir}. Theme code is backed up in Git; the live theme copy is in Online Store > Themes.`);
}

main().catch((e) => { log.error('fatal', { message: e.message }); console.error(e.message); process.exitCode = 1; });
