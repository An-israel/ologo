/**
 * weekly-report: runs every Monday 08:00 UK time in GitHub Actions and opens a GitHub issue for the operator.
 *
 * Lists: products missing a required field, sold-out products still featured on the home page, dead supplier
 * links, "new" tags older than 30 days, products priced below 2.5x their recorded cost. Adds orders, average
 * order value and top products for the last 7 days. Never includes customer names, emails or addresses.
 *
 *   npm run weekly-report                 # writes reports/weekly-<date>.md
 *   (in CI with GITHUB_TOKEN and GITHUB_REPOSITORY set, it also opens an issue)
 */
import fs from 'node:fs';
import { allProducts, type Product } from './lib/catalogue.js';
import { RunLog } from './lib/log.js';
import { ShopifyClient } from './lib/shopify.js';
import { auditProduct } from './audit-catalogue.js';

let log: RunLog;
let client: ShopifyClient;
const DAY = 86_400_000;
const HOMEPAGE_COLLECTIONS = ['new-in', 'picked-for-you'];

async function supplierLinkDead(url: string): Promise<boolean | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    return res.status === 404 || res.status === 410;
  } catch {
    return null; // could not check (network policy or timeout); reported separately
  }
}

async function homepageSoldOut(): Promise<string[]> {
  const out: string[] = [];
  for (const handle of HOMEPAGE_COLLECTIONS) {
    const data = await client.request(`query($q: String!) { collections(first: 1, query: $q) { nodes { handle products(first: 50) { nodes { handle title totalInventory tracksInventory status } } } } }`, { q: `handle:${handle}` });
    const c = data.collections.nodes[0];
    for (const p of c?.products.nodes ?? []) if (p.status === 'ACTIVE' && p.tracksInventory && p.totalInventory <= 0) out.push(`${p.title} (\`${p.handle}\`) in ${handle}`);
  }
  return out;
}

async function orderMetrics() {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  let count = 0; let revenue = 0; let currency = 'GBP';
  const qty = new Map<string, number>();
  const query = `query($after: String, $q: String) { orders(first: 50, after: $after, query: $q) { pageInfo { hasNextPage endCursor } nodes { currentTotalPriceSet { shopMoney { amount currencyCode } } lineItems(first: 50) { nodes { title quantity } } } } }`;
  for await (const o of client.paginate<any>(query, ['orders'], { q: `created_at:>=${since} -status:cancelled` }, 600)) {
    count += 1;
    revenue += Number(o.currentTotalPriceSet.shopMoney.amount);
    currency = o.currentTotalPriceSet.shopMoney.currencyCode;
    for (const li of o.lineItems.nodes) qty.set(li.title, (qty.get(li.title) ?? 0) + li.quantity);
  }
  let conversion: string | null = null;
  try {
    const q = await client.request(`query($q: String!) { shopifyqlQuery(query: $q) { tableData { rows } parseErrors } }`, { q: 'FROM sessions SHOW conversion_rate SINCE -7d UNTIL today' });
    const rows = q.shopifyqlQuery?.tableData?.rows;
    if (rows?.[0]) conversion = `${(Number(Object.values(rows[0])[0]) * 100).toFixed(2)}%`;
  } catch { conversion = null; }
  const top = [...qty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { count, revenue, currency, aov: count ? revenue / count : 0, top, conversion };
}

export function buildReport(input: {
  date: string; products: Product[]; missing: Map<string, string[]>; soldOutFeatured: string[]; deadLinks: string[];
  uncheckedLinks: number; staleNew: string[]; belowMargin: string[];
  metrics: Awaited<ReturnType<typeof orderMetrics>> | null;
}): string {
  const money = (n: number) => `£${n.toFixed(2)}`;
  const lines: string[] = [`# Ornis weekly report, ${input.date}`, ''];
  if (input.metrics) {
    const m = input.metrics;
    lines.push('## Last 7 days', '', `- Orders: ${m.count}`, `- Revenue: ${money(m.revenue)}`, `- Average order value: ${money(m.aov)}`,
      `- Conversion rate: ${m.conversion ?? 'see Shopify Analytics > Reports'}`,
      '- Core Web Vitals: see Online Store > Themes > Web performance', '');
    if (m.top.length) lines.push('Top products by quantity:', '', ...m.top.map(([t, q], i) => `${i + 1}. ${t} (${q})`), '');
  }
  const section = (title: string, items: string[], empty: string) => {
    lines.push(`## ${title} (${items.length})`, '');
    lines.push(...(items.length ? items.map((i) => `- [ ] ${i}`) : [empty]), '');
  };
  section('Active products missing a required field', [...input.missing.entries()].map(([h, probs]) => `\`${h}\`: ${probs.join(', ')}`), 'None. Every active product meets the standard.');
  section('Sold-out products still featured on the home page', input.soldOutFeatured, 'None.');
  section('Dead supplier links', input.deadLinks, input.uncheckedLinks ? `None found (${input.uncheckedLinks} could not be checked from CI).` : 'None.');
  section('"New" tags older than 30 days', input.staleNew, 'None.');
  section('Priced below 2.5 times recorded cost', input.belowMargin, 'None.');
  lines.push('Fix flagged products with the toolkit (docs/OPERATOR_GUIDE.md), then close this issue.');
  return lines.join('\n');
}

async function main() {
  log = new RunLog('weekly-report');
  client = new ShopifyClient({ log });
  const products: Product[] = [];
  for await (const p of allProducts(client, 'status:active')) products.push(p);
  const missing = new Map<string, string[]>();
  for (const p of products) {
    const problems = [...new Set(auditProduct(p).map((f) => f.problem))];
    if (problems.length) missing.set(p.handle, problems);
  }
  const deadLinks: string[] = [];
  let uncheckedLinks = 0;
  for (const p of products) {
    if (!p.metafields.supplier_url) continue;
    const dead = await supplierLinkDead(p.metafields.supplier_url);
    if (dead === null) uncheckedLinks += 1;
    else if (dead) deadLinks.push(`${p.title} (\`${p.handle}\`)`);
  }
  const staleNew = products.filter((p) => p.tags.includes('new') && Date.now() - new Date(p.createdAt).getTime() > 30 * DAY).map((p) => `\`${p.handle}\` (added ${p.createdAt.slice(0, 10)})`);
  const belowMargin = products.flatMap((p) => p.variants.filter((v) => v.unitCost && v.price < v.unitCost * 2.5).map((v) => `\`${p.handle}\` ${v.title}: £${v.price.toFixed(2)} vs cost £${v.unitCost!.toFixed(2)}`));
  let metrics = null;
  try { metrics = await orderMetrics(); } catch (e) { log.warn('metrics.unavailable', { message: (e as Error).message }); }

  const date = new Date().toISOString().slice(0, 10);
  const body = buildReport({ date, products, missing, soldOutFeatured: await homepageSoldOut(), deadLinks, uncheckedLinks, staleNew, belowMargin, metrics });
  fs.mkdirSync('reports', { recursive: true });
  const file = `reports/weekly-${date}.md`;
  fs.writeFileSync(file, body);
  console.log(body);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (token && repo) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Weekly store report ${date}`, body, labels: ['weekly-report'] }),
    });
    if (!res.ok) throw new Error(`Could not open the GitHub issue: HTTP ${res.status}`);
    console.log(`Opened issue: ${(await res.json()).html_url}`);
  }
  log.info('summary', { products: products.length, missing: missing.size, deadLinks: deadLinks.length, staleNew: staleNew.length, belowMargin: belowMargin.length });
}

if (process.argv[1]?.endsWith('weekly-report.ts')) {
  main().catch((e) => { log?.error('fatal', { message: e.message }); console.error(e.message); process.exitCode = 1; });
}
