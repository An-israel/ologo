/**
 * Static link check: every link in templates, section groups, content pages and menus (store-plan) points at
 * a page, collection or policy the store setup creates. The rendered crawl is in tests/e2e/quality.spec.ts.
 */
import fs from 'node:fs';
import { COLLECTIONS, MENUS, PAGES, type MenuItemPlan } from '../scripts/lib/store-plan.js';

const collections = new Set(COLLECTIONS.map((c) => c.handle));
const pages = new Set(PAGES.map((p) => p.handle));
const policies = new Set(['privacy-policy', 'terms-of-service', 'refund-policy', 'shipping-policy', 'contact-information']);
const problems: string[] = [];

function check(where: string, link: string) {
  const m = link.match(/^(?:shopify:\/\/|\/)(collections|pages|policies)\/([\w-]+)/);
  if (!link || link === '#') { problems.push(`${where}: empty link`); return; }
  if (!m) return;
  const [, kind, handle] = m;
  const ok = kind === 'collections' ? collections.has(handle) || handle === 'all' : kind === 'pages' ? pages.has(handle) : policies.has(handle);
  if (!ok) problems.push(`${where}: ${link} does not exist in the store plan`);
}

for (const f of [...fs.readdirSync('theme/templates').filter((x) => x.endsWith('.json')).map((x) => `theme/templates/${x}`), ...fs.readdirSync('theme/sections').filter((x) => x.endsWith('.json')).map((x) => `theme/sections/${x}`)]) {
  const json = JSON.parse(fs.readFileSync(f, 'utf8'));
  JSON.stringify(json, (k, v) => {
    if (typeof v === 'string' && v !== '' && /link$/.test(k)) check(f, v);
    if (k === 'collection' && typeof v === 'string' && !collections.has(v)) problems.push(`${f}: collection "${v}" is not created by setup-store`);
    return v;
  });
}
for (const f of fs.readdirSync('content/pages')) {
  for (const m of fs.readFileSync(`content/pages/${f}`, 'utf8').matchAll(/href="([^"]*)"/g)) check(`content/pages/${f}`, m[1]);
}
for (const f of fs.readdirSync('theme/sections').concat(fs.readdirSync('theme/snippets').map((x) => `../snippets/${x}`))) {
  for (const m of fs.readFileSync(`theme/sections/${f}`, 'utf8').matchAll(/href="(\/(?:pages|collections|policies)\/[\w-]+)"/g)) check(`theme/${f}`, m[1]);
}
const walk = (menu: string, items: MenuItemPlan[]) => items.forEach((i) => {
  if (i.collection && !collections.has(i.collection)) problems.push(`menu ${menu}: collection ${i.collection} missing`);
  if (i.page && !pages.has(i.page)) problems.push(`menu ${menu}: page ${i.page} missing`);
  if (i.url) check(`menu ${menu}`, i.url);
  if (i.items) walk(menu, i.items);
});
MENUS.forEach((m) => walk(m.handle, m.items));
for (const p of PAGES) if (!fs.existsSync(p.file)) problems.push(`page ${p.handle}: ${p.file} missing`);

problems.forEach((p) => console.log(p));
console.log(`Link check: ${problems.length} problem(s).`);
process.exit(problems.length ? 1 : 0);
