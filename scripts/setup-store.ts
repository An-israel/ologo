/**
 * setup-store: make the store's data structure match scripts/lib/store-plan.ts.
 *
 *   npm run setup-store              # dry run: prints what would change, changes nothing
 *   npm run setup-store -- --apply   # applies the changes (only after the operator approves the dry run)
 *
 * Idempotent: every step looks up the existing resource by handle/key first, so re-running never duplicates.
 * Never deletes. Retired collections are unpublished from the Online Store and redirected.
 */
import fs from 'node:fs';
import { parseArgs } from './lib/args.js';
import { STORE_SCHEMA_VERSION } from './lib/config.js';
import { acquireLock } from './lib/lock.js';
import { RunLog } from './lib/log.js';
import { ensureRedirect as ensureRedirectLib } from './lib/redirects.js';
import { assertNoUserErrors, ShopifyClient } from './lib/shopify.js';
import {
  COLLECTIONS, FAQ_ITEMS, MENUS, METAOBJECTS, PAGES, PRODUCT_METAFIELDS, RETIRED_COLLECTIONS, SHOP_INFO_MAIN, TRUST_POINTS,
  type MenuItemPlan,
} from './lib/store-plan.js';

const args = parseArgs();
const log = new RunLog('setup-store');
const release = acquireLock('setup-store');
const client = new ShopifyClient({ log });
const plan: Array<{ step: string; action: 'create' | 'update' | 'ok' | 'skip'; detail: string }> = [];

function record(step: string, action: 'create' | 'update' | 'ok' | 'skip', detail: string) {
  plan.push({ step, action, detail });
  log.info('plan', { step, action, detail, applied: args.apply && (action === 'create' || action === 'update') });
}

/* ---------- Metaobject definitions (before metafields, since size_chart references one) ---------- */
async function ensureMetaobjectDefinitions(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const def of METAOBJECTS) {
    const data = await client.request(`query($type: String!) { metaobjectDefinitionByType(type: $type) { id fieldDefinitions { key } } }`, { type: def.type });
    const existing = data.metaobjectDefinitionByType;
    if (existing) {
      ids[def.type] = existing.id;
      const missing = def.fields.filter((f) => !existing.fieldDefinitions.some((e: { key: string }) => e.key === f.key));
      if (!missing.length) { record('metaobject definition', 'ok', def.type); continue; }
      record('metaobject definition', 'update', `${def.type}: add fields ${missing.map((f) => f.key).join(', ')}`);
      if (args.apply) {
        const res = await client.request(`mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) { metaobjectDefinitionUpdate(id: $id, definition: $definition) { userErrors { field message } } }`, {
          id: existing.id,
          definition: { fieldDefinitions: missing.map((f) => ({ create: { key: f.key, name: f.name, type: f.type, required: f.required ?? false, description: f.description, validations: f.validations ?? [] } })) },
        });
        assertNoUserErrors(res.metaobjectDefinitionUpdate, `update ${def.type}`);
      }
      continue;
    }
    record('metaobject definition', 'create', def.type);
    if (!args.apply) continue;
    const res = await client.request(`mutation($definition: MetaobjectDefinitionCreateInput!) { metaobjectDefinitionCreate(definition: $definition) { metaobjectDefinition { id } userErrors { field message } } }`, {
      definition: {
        type: def.type,
        name: def.name,
        displayNameKey: def.displayNameKey,
        access: { storefront: 'PUBLIC_READ' },
        fieldDefinitions: def.fields.map((f) => ({ key: f.key, name: f.name, type: f.type, required: f.required ?? false, description: f.description, validations: f.validations ?? [] })),
      },
    });
    assertNoUserErrors(res.metaobjectDefinitionCreate, `create ${def.type}`);
    ids[def.type] = res.metaobjectDefinitionCreate.metaobjectDefinition.id;
  }
  return ids;
}

/* ---------- Product metafield definitions ---------- */
async function ensureMetafieldDefinitions(metaobjectIds: Record<string, string>) {
  const data = await client.request(`{ metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: "custom") { nodes { id key type { name } } } }`);
  const existing = new Map<string, { id: string; type: { name: string } }>(data.metafieldDefinitions.nodes.map((n: any) => [n.key, n]));
  for (const def of PRODUCT_METAFIELDS) {
    const found = existing.get(def.key);
    if (found) {
      if (found.type.name !== def.type) record('metafield definition', 'skip', `custom.${def.key} exists with type ${found.type.name} (wanted ${def.type}); fix by hand, see RUNBOOK`);
      else record('metafield definition', 'ok', `custom.${def.key}`);
      continue;
    }
    record('metafield definition', 'create', `custom.${def.key} (${def.type})`);
    if (!args.apply) continue;
    const validations = [...(def.validations ?? [])];
    if (def.type === 'metaobject_reference') {
      if (!metaobjectIds.size_chart) throw new Error('size_chart metaobject definition id missing');
      validations.push({ name: 'metaobject_definition_id', value: metaobjectIds.size_chart });
    }
    const res = await client.request(`mutation($definition: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $definition) { createdDefinition { id } userErrors { field message code } } }`, {
      definition: {
        name: def.name, namespace: 'custom', key: def.key, type: def.type, ownerType: 'PRODUCT', description: def.description,
        validations, access: { storefront: def.storefront },
      },
    });
    assertNoUserErrors(res.metafieldDefinitionCreate, `create custom.${def.key}`);
  }
}

/* ---------- Metaobject entries (upsert by handle is idempotent) ---------- */
async function upsertMetaobject(type: string, handle: string, fields: Record<string, string>) {
  const data = await client.request(`query($h: MetaobjectHandleInput!) { metaobjectByHandle(handle: $h) { id fields { key value } } }`, { h: { type, handle } });
  const current = data.metaobjectByHandle;
  const changed = !current || Object.entries(fields).some(([k, v]) => (current.fields.find((f: any) => f.key === k)?.value ?? '') !== v);
  if (!changed) { record('metaobject', 'ok', `${type}/${handle}`); return; }
  record('metaobject', current ? 'update' : 'create', `${type}/${handle}`);
  if (current) {
    for (const f of current.fields) {
      if (f.key in fields && f.value !== fields[f.key]) log.change({ type: 'metaobject', id: current.id, handle }, f.key, f.value, fields[f.key], args.apply);
    }
  }
  if (!args.apply) return;
  const res = await client.request(`mutation($h: MetaobjectHandleInput!, $m: MetaobjectUpsertInput!) { metaobjectUpsert(handle: $h, metaobject: $m) { metaobject { id } userErrors { field message } } }`, {
    h: { type, handle },
    m: { fields: Object.entries(fields).map(([key, value]) => ({ key, value })), capabilities: { publishable: { status: 'ACTIVE' } } },
  });
  // Definitions without the publishable capability reject the status; retry without it.
  if (res.metaobjectUpsert.userErrors?.some((e: any) => /publishable|capabilit/i.test(e.message))) {
    const retry = await client.request(`mutation($h: MetaobjectHandleInput!, $m: MetaobjectUpsertInput!) { metaobjectUpsert(handle: $h, metaobject: $m) { metaobject { id } userErrors { field message } } }`, {
      h: { type, handle }, m: { fields: Object.entries(fields).map(([key, value]) => ({ key, value })) },
    });
    assertNoUserErrors(retry.metaobjectUpsert, `upsert ${type}/${handle}`);
  } else assertNoUserErrors(res.metaobjectUpsert, `upsert ${type}/${handle}`);
}

async function ensureEntries() {
  // shop_info: only set fields we know. Never overwrite a value the owner already filled in.
  const existing = await client.request(`query($h: MetaobjectHandleInput!) { metaobjectByHandle(handle: $h) { fields { key value } } }`, { h: { type: 'shop_info', handle: 'main' } });
  const filled = Object.fromEntries((existing.metaobjectByHandle?.fields ?? []).filter((f: any) => f.value).map((f: any) => [f.key, f.value]));
  await upsertMetaobject('shop_info', 'main', { ...SHOP_INFO_MAIN, ...filled });
  for (const t of TRUST_POINTS) await upsertMetaobject('trust_point', t.handle, { icon: t.icon, heading: t.heading, text: t.text });
  for (const f of FAQ_ITEMS) await upsertMetaobject('faq_item', f.handle, { question: f.question, answer: f.answer, topic: f.topic });
}

/* ---------- Shop schema version (item 82) ---------- */
async function ensureSchemaVersion() {
  const data = await client.request(`{ shop { id metafield(namespace: "ornis", key: "schema_version") { value } } }`);
  if (data.shop.metafield?.value === STORE_SCHEMA_VERSION) { record('schema version', 'ok', STORE_SCHEMA_VERSION); return; }
  record('schema version', 'update', `${data.shop.metafield?.value ?? 'none'} -> ${STORE_SCHEMA_VERSION}`);
  if (!args.apply) return;
  const res = await client.request(`mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`, {
    m: [{ ownerId: data.shop.id, namespace: 'ornis', key: 'schema_version', type: 'single_line_text_field', value: STORE_SCHEMA_VERSION }],
  });
  assertNoUserErrors(res.metafieldsSet, 'schema version');
}

/* ---------- Online Store publication ---------- */
async function onlineStorePublicationId(): Promise<string> {
  const data = await client.request(`{ publications(first: 20) { nodes { id name } } }`);
  const pub = data.publications.nodes.find((p: any) => p.name === 'Online Store');
  if (!pub) throw new Error('Online Store publication not found. Is the Online Store sales channel installed?');
  return pub.id;
}

/* ---------- Collections ---------- */
async function findCollection(handle: string) {
  const data = await client.request(`query($q: String!) { collections(first: 1, query: $q) { nodes { id handle title descriptionHtml ruleSet { appliedDisjunctively rules { column relation condition } } } } }`, { q: `handle:${handle}` });
  return data.collections.nodes.find((c: any) => c.handle === handle) ?? null;
}

async function ensureCollections(publicationId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const c of COLLECTIONS) {
    const existing = await findCollection(c.handle);
    const descriptionHtml = `<p>${c.description}</p>`;
    const input: Record<string, unknown> = {
      title: c.title, handle: c.handle, descriptionHtml, seo: { title: c.seoTitle, description: c.seoDescription },
      ...(c.sortOrder ? { sortOrder: c.sortOrder } : {}),
    };
    if (c.rules) input.ruleSet = { appliedDisjunctively: c.disjunctive ?? false, rules: c.rules };
    if (existing) {
      ids[c.handle] = existing.id;
      const descriptionMissing = (existing.descriptionHtml ?? '').trim() === '';
      if (existing.title === c.title && !descriptionMissing) { record('collection', 'ok', c.handle); continue; }
      record('collection', 'update', `${c.handle}: title/description`);
      log.change({ type: 'collection', id: existing.id, handle: c.handle }, 'title', existing.title, c.title, args.apply);
      log.change({ type: 'collection', id: existing.id, handle: c.handle }, 'descriptionHtml', existing.descriptionHtml, descriptionHtml, args.apply);
      if (args.apply) {
        // Rules are left alone on existing collections so a manual collection is never converted.
        const res = await client.request(`mutation($input: CollectionInput!) { collectionUpdate(input: $input) { userErrors { field message } } }`, {
          input: { id: existing.id, title: c.title, descriptionHtml, seo: input.seo },
        });
        assertNoUserErrors(res.collectionUpdate, `update collection ${c.handle}`);
      }
      continue;
    }
    record('collection', 'create', `${c.handle}${c.rules ? ' (automated)' : ' (manual)'}`);
    if (!args.apply) continue;
    const res = await client.request(`mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } userErrors { field message } } }`, { input });
    assertNoUserErrors(res.collectionCreate, `create collection ${c.handle}`);
    ids[c.handle] = res.collectionCreate.collection.id;
    const pub = await client.request(`mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { id: ids[c.handle], input: [{ publicationId }] });
    assertNoUserErrors(pub.publishablePublish, `publish collection ${c.handle}`);
  }
  return ids;
}

/* ---------- Retire wrong collections from the audit: unpublish (not delete) and redirect ---------- */
async function retireCollections(publicationId: string) {
  for (const r of RETIRED_COLLECTIONS) {
    const existing = await findCollection(r.handle);
    if (existing) {
      record('retire collection', 'update', `${r.handle}: hide from Online Store (kept, not deleted)`);
      log.change({ type: 'collection', id: existing.id, handle: r.handle }, 'published', true, false, args.apply);
      if (args.apply) {
        const res = await client.request(`mutation($id: ID!, $input: [PublicationInput!]!) { publishableUnpublish(id: $id, input: $input) { userErrors { field message } } }`, { id: existing.id, input: [{ publicationId }] });
        assertNoUserErrors(res.publishableUnpublish, `unpublish ${r.handle}`);
      }
    } else record('retire collection', 'ok', `${r.handle} not present`);
    await ensureRedirect(`/collections/${r.handle}`, r.redirectTo);
  }
}

async function ensureRedirect(path: string, target: string) {
  const result = await ensureRedirectLib(client, log, args.apply, path, target);
  record('redirect', result === 'ok' ? 'ok' : result.endsWith('update') || result === 'updated' ? 'update' : 'create', `${path} -> ${target}`);
}

/* ---------- Pages ---------- */
async function ensurePages(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const p of PAGES) {
    const body = fs.readFileSync(p.file, 'utf8');
    const unconfirmed = /\[TO CONFIRM/i.test(body);
    const data = await client.request(`query($q: String!) { pages(first: 1, query: $q) { nodes { id handle title body templateSuffix isPublished } } }`, { q: `handle:${p.handle}` });
    const existing = data.pages.nodes.find((n: any) => n.handle === p.handle);
    const metafields = [{ namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: p.seoDescription }];
    if (existing) {
      ids[p.handle] = existing.id;
      if (existing.body === body && (existing.templateSuffix ?? '') === (p.templateSuffix ?? '')) { record('page', 'ok', p.handle); continue; }
      record('page', 'update', `${p.handle}${unconfirmed ? ' (kept hidden: has [TO CONFIRM] facts)' : ''}`);
      log.change({ type: 'page', id: existing.id, handle: p.handle }, 'body', existing.body, body, args.apply);
      if (args.apply) {
        const res = await client.request(`mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { userErrors { field message } } }`, {
          id: existing.id, page: { title: p.title, body, templateSuffix: p.templateSuffix ?? null, isPublished: !unconfirmed, metafields },
        });
        assertNoUserErrors(res.pageUpdate, `update page ${p.handle}`);
      }
      continue;
    }
    record('page', 'create', `${p.handle}${unconfirmed ? ' (hidden until [TO CONFIRM] facts are filled in)' : ''}`);
    if (!args.apply) continue;
    const res = await client.request(`mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id } userErrors { field message } } }`, {
      page: { title: p.title, handle: p.handle, body, templateSuffix: p.templateSuffix, isPublished: !unconfirmed, metafields },
    });
    assertNoUserErrors(res.pageCreate, `create page ${p.handle}`);
    ids[p.handle] = res.pageCreate.page.id;
  }
  return ids;
}

/* ---------- Menus ---------- */
function menuItems(items: MenuItemPlan[], collections: Record<string, string>, pages: Record<string, string>): any[] {
  return items.flatMap((item) => {
    const children = item.items ? menuItems(item.items, collections, pages) : [];
    if (item.collection) {
      const id = collections[item.collection];
      if (!id) { log.warn('menu.missing-collection', { collection: item.collection }); return args.apply ? [] : [{ title: item.title, type: 'COLLECTION', items: children }]; }
      return [{ title: item.title, type: 'COLLECTION', resourceId: id, items: children }];
    }
    if (item.page) {
      const id = pages[item.page];
      if (!id) { log.warn('menu.missing-page', { page: item.page }); return args.apply ? [] : [{ title: item.title, type: 'PAGE', items: children }]; }
      return [{ title: item.title, type: 'PAGE', resourceId: id, items: children }];
    }
    return [{ title: item.title, type: 'HTTP', url: item.url, items: children }];
  });
}

async function ensureMenus(collections: Record<string, string>, pages: Record<string, string>) {
  const data = await client.request(`{ menus(first: 50) { nodes { id handle title items { title } } } }`);
  for (const m of MENUS) {
    const existing = data.menus.nodes.find((n: any) => n.handle === m.handle);
    const items = menuItems(m.items, collections, pages);
    const sameTopLevel = existing && JSON.stringify(existing.items.map((i: any) => i.title)) === JSON.stringify(m.items.map((i) => i.title));
    if (sameTopLevel) { record('menu', 'ok', m.handle); continue; }
    record('menu', existing ? 'update' : 'create', `${m.handle}: ${m.items.map((i) => i.title).join(', ')}`);
    if (existing) log.change({ type: 'menu', id: existing.id, handle: m.handle }, 'items', existing.items, m.items.map((i) => i.title), args.apply);
    if (!args.apply) continue;
    if (existing) {
      const res = await client.request(`mutation($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) { menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { userErrors { field message } } }`, { id: existing.id, title: m.title, handle: m.handle, items });
      assertNoUserErrors(res.menuUpdate, `update menu ${m.handle}`);
    } else {
      const res = await client.request(`mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) { menuCreate(title: $title, handle: $handle, items: $items) { userErrors { field message } } }`, { title: m.title, handle: m.handle, items });
      assertNoUserErrors(res.menuCreate, `create menu ${m.handle}`);
    }
  }
}

async function main() {
  console.log(args.apply ? 'Applying store setup...' : 'DRY RUN: nothing will be changed. Re-run with --apply after approval.');
  const metaobjectIds = await ensureMetaobjectDefinitions();
  await ensureMetafieldDefinitions(metaobjectIds);
  if (Object.keys(metaobjectIds).length === METAOBJECTS.length) await ensureEntries();
  else record('metaobject entries', 'skip', 'definitions are created first; entries follow on the --apply run');
  await ensureSchemaVersion();
  const publicationId = await onlineStorePublicationId();
  const collections = await ensureCollections(publicationId);
  await retireCollections(publicationId);
  const pages = await ensurePages();
  await ensureMenus(collections, pages);

  const counts = plan.reduce<Record<string, number>>((acc, p) => { acc[p.action] = (acc[p.action] ?? 0) + 1; return acc; }, {});
  console.log('\nStep                  Action  Detail');
  for (const p of plan.filter((x) => x.action !== 'ok')) console.log(`${p.step.padEnd(22)}${p.action.padEnd(8)}${p.detail}`);
  console.log(`\nSummary: ${JSON.stringify(counts)}. Log: ${log.file}`);
  if (!args.apply) console.log('No changes made. Review the list above, then run: npm run setup-store -- --apply');
}

main().catch((error) => {
  log.error('fatal', { message: error.message });
  console.error(error.message);
  process.exitCode = 1;
}).finally(release);
