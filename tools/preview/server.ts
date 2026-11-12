/**
 * Local preview server for the Ornis 2.0 theme.
 *
 * Renders the real theme files (layout, JSON templates, sections, snippets, locales) with LiquidJS and sample data,
 * and mocks the Shopify endpoints the theme uses (Ajax Cart, Section Rendering, predictive search, recommendations).
 * Lets us run Playwright, axe and screenshots before the store is connected. It is a development tool only;
 * the real store renders with Shopify's own Liquid.
 *
 *   npm run preview            # http://localhost:9292
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Liquid, Tag, Value, type Context, type Emitter, type TagToken, type TopLevelToken, type Template } from 'liquidjs';
import { MENUS, PAGES, type MenuItemPlan } from '../../scripts/lib/store-plan.js';
import { COLLECTIONS, FAQ, PRODUCTS, SIZE_CHARTS, type FixtureProduct, type Img } from './fixtures.js';
import { ensureImage } from './images.js';

const ROOT = path.resolve('theme');
const PORT = Number(process.env.PORT ?? 9292);
const ORIGIN = `http://localhost:${PORT}`;
const IMG_DIR = path.resolve('tools/preview/.cache/img');
const locales = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales/en.default.json'), 'utf8'));
const settingsSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/settings_schema.json'), 'utf8'));

/* ---------------- Liquid engine with Shopify tags and filters ---------------- */

const engine = new Liquid({ root: ROOT, partials: path.join(ROOT, 'snippets'), extname: '.liquid', strictFilters: false, strictVariables: false, jsTruthy: false, dynamicPartials: true, cache: false });

const named = (args: unknown[]): Record<string, any> => Object.fromEntries(args.filter((a): a is [string, unknown] => Array.isArray(a) && a.length === 2 && typeof a[0] === 'string'));
const positional = (args: unknown[]) => args.filter((a) => !(Array.isArray(a) && a.length === 2 && typeof a[0] === 'string'));
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function lookup(key: string): unknown {
  return key.split('.').reduce((acc: any, k) => (acc == null ? undefined : acc[k]), locales);
}
function translate(key: string, ...args: unknown[]): string {
  const vars = named(args);
  let value: any = lookup(key);
  if (value && typeof value === 'object' && 'count' in vars) value = vars.count === 1 ? value.one : value.other;
  if (typeof value !== 'string') return `translation missing: ${key}`;
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ''));
}
const money = (c: unknown) => `£${(Number(c ?? 0) / 100).toFixed(2)}`;

engine.registerFilter('t', translate);
engine.registerFilter('money', money);
engine.registerFilter('money_with_currency', (c: unknown) => `${money(c)} GBP`);
engine.registerFilter('money_without_currency', (c: unknown) => (Number(c ?? 0) / 100).toFixed(2));
engine.registerFilter('money_without_trailing_zeros', (c: unknown) => money(c).replace(/\.00$/, ''));
engine.registerFilter('asset_url', (f: string) => `/assets/${f}`);
engine.registerFilter('shopify_asset_url', (f: string) => `/assets/${f}`);
engine.registerFilter('stylesheet_tag', (url: string) => `<link rel="stylesheet" href="${url}" media="all">`);
engine.registerFilter('preload_tag', (url: string, ...args: unknown[]) => {
  const n = named(args);
  return `<link rel="preload" href="${url}" as="${n.as}"${n.type ? ` type="${n.type}"` : ''}${n.crossorigin ? ' crossorigin="anonymous"' : ''}>`;
});
engine.registerFilter('font_face', () => '');
engine.registerFilter('font_modify', (f: unknown) => f);
engine.registerFilter('color_modify', (hex: string, _p: string, a: number) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
});
engine.registerFilter('color_extract', (hex: string, part: string) => {
  const n = parseInt(String(hex).slice(1), 16);
  return part === 'red' ? (n >> 16) & 255 : part === 'green' ? (n >> 8) & 255 : n & 255;
});
engine.registerFilter('handleize', (s: string) => String(s ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('placeholder_svg_tag', () => '<svg class="placeholder-svg" viewBox="0 0 300 400" aria-hidden="true"><rect width="300" height="400" fill="#ebe7df"/></svg>');
engine.registerFilter('payment_type_svg_tag', (type: string) => `<svg class="payment-icon" viewBox="0 0 38 24" role="img" aria-label="${esc(type)}"><rect width="38" height="24" rx="3" fill="#fff"/><text x="19" y="15" font-size="6" text-anchor="middle" fill="#15171C">${esc(type).slice(0, 8)}</text></svg>`);
engine.registerFilter('payment_terms', () => '<span class="small">Pay in 3 interest-free payments with Klarna.</span>');
engine.registerFilter('payment_button', () => '<button type="button" class="button button--secondary button--full" disabled>Buy with Shop Pay (preview)</button>');
engine.registerFilter('default_pagination', () => '');
engine.registerFilter('format_code', (s: string) => s);
engine.registerFilter('time_tag', (d: string) => `<time datetime="${esc(d)}">${new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time>`);
engine.registerFilter('metafield_tag', (mf: any) => {
  const value = mf?.value ?? mf;
  if (typeof value === 'string' && value.startsWith('{')) {
    const tree = JSON.parse(value);
    return tree.children.map((p: any) => `<p>${p.children.map((c: any) => esc(c.value)).join('')}</p>`).join('');
  }
  return `<p>${esc(value)}</p>`;
});
engine.registerFilter('image_url', (img: any, ...args: unknown[]) => {
  const n = named(args);
  if (!img) return '';
  if (typeof img === 'string') return img;
  const src = img.preview_image?.src ?? img.src;
  const w = img.preview_image?.width ?? img.width ?? 1536;
  const h = img.preview_image?.height ?? img.height ?? 2048;
  return `${src}?width=${n.width ?? w}&w0=${w}&h0=${h}`;
});
engine.registerFilter('image_tag', (url: string, ...args: unknown[]) => {
  if (!url) return '';
  const n = named(args);
  const u = new URL(url, ORIGIN);
  const w0 = Number(u.searchParams.get('w0') ?? 1536);
  const h0 = Number(u.searchParams.get('h0') ?? 2048);
  const max = Number(u.searchParams.get('width') ?? w0);
  const base = u.pathname;
  const widths = String(n.widths ?? '').split(',').map((x) => Number(x.trim())).filter(Boolean);
  const srcset = widths.length ? ` srcset="${widths.map((w) => `${base}?width=${w} ${w}w`).join(', ')}"` : '';
  const height = Math.round((max * h0) / w0);
  const attrs = [
    `src="${base}?width=${max}"`, srcset.trim(), n.sizes ? `sizes="${esc(n.sizes)}"` : '', `width="${max}"`, `height="${height}"`,
    `alt="${esc(n.alt)}"`, n.loading ? `loading="${n.loading}"` : '', n.fetchpriority ? `fetchpriority="${n.fetchpriority}"` : '',
    n.class ? `class="${esc(n.class)}"` : '', n.style ? `style="${esc(n.style)}"` : '',
  ].filter(Boolean);
  return `<img ${attrs.join(' ')}>`;
});

/** {% schema %} and {% javascript %}: output nothing. */
class RawSkip extends Tag {
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) {
    super(token, remain, liquid);
    const end = `end${token.name}`;
    while (remain.length) {
      const t = remain.shift() as any;
      if (t.name === end) return;
    }
    throw new Error(`${token.name} not closed`);
  }
  * render(): Generator<unknown, void, unknown> { /* nothing */ }
}
engine.registerTag('schema', RawSkip);
engine.registerTag('javascript', RawSkip);

class StyleTag extends Tag {
  private templates: Template[] = [];
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid, parser: any) {
    super(token, remain, liquid);
    const stream = parser.parseStream(remain).on('tag:endstyle', () => stream.stop()).on('template', (t: Template) => this.templates.push(t)).on('end', () => { throw new Error('style not closed'); });
    stream.start();
  }
  * render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    emitter.write('<style>');
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    emitter.write('</style>');
  }
}
engine.registerTag('style', StyleTag);

/** {% form 'type', object, key: value %} */
class FormTag extends Tag {
  private templates: Template[] = [];
  private formType: string;
  private exprs: Array<[string | null, string]> = [];
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid, parser: any) {
    super(token, remain, liquid);
    const parts = token.args.split(/,(?![^'"]*['"][^'"]*$)/).map((s) => s.trim()).filter(Boolean);
    this.formType = parts.shift()!.replace(/['"]/g, '');
    for (const p of parts) {
      const m = p.match(/^([\w-]+)\s*:\s*(.+)$/);
      this.exprs.push(m ? [m[1], m[2]] : [null, p]);
    }
    const stream = parser.parseStream(remain).on('tag:endform', () => stream.stop()).on('template', (t: Template) => this.templates.push(t)).on('end', () => { throw new Error('form not closed'); });
    stream.start();
  }
  * render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const attrs: Record<string, unknown> = {};
    for (const [k, e] of this.exprs) if (k) attrs[k] = yield new Value(e, this.liquid).value(ctx, false);
    const actions: Record<string, string> = { product: '/cart/add', customer: '/contact#newsletter', contact: '/contact#contact_form', storefront_password: '/password' };
    const attrText = Object.entries(attrs).filter(([k]) => k !== 'return_to').map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
    emitter.write(`<form method="post" action="${actions[this.formType] ?? '/'}" accept-charset="UTF-8" ${attrText}><input type="hidden" name="form_type" value="${this.formType}"><input type="hidden" name="utf8" value="✓">`);
    ctx.push({ form: { errors: null, posted_successfully: false, 'posted_successfully?': false } });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
    emitter.write('</form>');
  }
}
engine.registerTag('form', FormTag);

/** {% paginate collection.products by 24 %} */
class PaginateTag extends Tag {
  private templates: Template[] = [];
  private target: string;
  private by: string;
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid, parser: any) {
    super(token, remain, liquid);
    const m = token.args.match(/^(.+?)\s+by\s+(.+)$/)!;
    this.target = m[1].trim();
    this.by = m[2].trim();
    const stream = parser.parseStream(remain).on('tag:endpaginate', () => stream.stop()).on('template', (t: Template) => this.templates.push(t)).on('end', () => { throw new Error('paginate not closed'); });
    stream.start();
  }
  * render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const size = Number(yield new Value(this.by, this.liquid).value(ctx, false)) || 24;
    const lastDot = this.target.lastIndexOf('.');
    const parent: any = yield new Value(this.target.slice(0, lastDot), this.liquid).value(ctx, false);
    const key = this.target.slice(lastDot + 1);
    const all: unknown[] = parent?.[key] ?? [];
    const page = Number((ctx.globals as any).current_page ?? 1);
    const pages = Math.max(1, Math.ceil(all.length / size));
    const url = (n: number) => { const u = new URL((ctx.globals as any).__url, ORIGIN); u.searchParams.set('page', String(n)); u.searchParams.delete('section_id'); return u.pathname + u.search; };
    const paginate = { current_page: page, current_offset: (page - 1) * size, page_size: size, items: all.length, pages, next: page < pages ? { url: url(page + 1) } : null, previous: page > 1 ? { url: url(page - 1) } : null };
    parent[key] = all.slice((page - 1) * size, page * size);
    ctx.push({ paginate });
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    ctx.pop();
    parent[key] = all;
  }
}
engine.registerTag('paginate', PaginateTag);

/* ---------------- Sections ---------------- */

const schemaOf = (type: string): any => {
  const src = fs.readFileSync(path.join(ROOT, 'sections', `${type}.liquid`), 'utf8');
  const m = src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return m ? JSON.parse(m[1]) : { settings: [] };
};

function resolveSetting(def: any, value: unknown, data: Data): unknown {
  if (value === undefined) value = def?.default;
  if (!def) return value;
  switch (def.type) {
    case 'collection': return typeof value === 'string' ? data.collections[value as any] ?? null : null;
    case 'link_list': return value;
    case 'url': return typeof value === 'string' ? value.replace(/^shopify:\/\/(collections|pages|products)\//, '/$1/') : value;
    case 'image_picker': return null;
    case 'metaobject_list': return null;
    default: return value ?? null;
  }
}

function sectionObject(type: string, id: string, config: any, data: Data) {
  const schema = schemaOf(type);
  const settings: Record<string, unknown> = {};
  for (const def of schema.settings ?? []) if (def.id) settings[def.id] = resolveSetting(def, config?.settings?.[def.id], data);
  if (type === 'hero' && !settings.image_desktop) settings.image_desktop = data.heroImage;
  if (type === 'editorial' && !settings.image) settings.image = data.editorialImage;
  const blockDefs: Record<string, any> = Object.fromEntries((schema.blocks ?? []).map((b: any) => [b.type, b]));
  const order: string[] = config?.block_order ?? Object.keys(config?.blocks ?? {});
  const blocks = order.map((bid) => {
    const b = config.blocks[bid];
    const def = blockDefs[b.type];
    const bs: Record<string, unknown> = {};
    for (const s of def?.settings ?? []) if (s.id) bs[s.id] = resolveSetting(s, b.settings?.[s.id], data);
    return { id: bid, type: b.type, settings: bs, shopify_attributes: '' };
  });
  return { id, settings, blocks };
}

async function renderSection(type: string, id: string, config: any, scope: Record<string, unknown>, data: Data): Promise<string> {
  const section = sectionObject(type, id, config, data);
  const html = await engine.renderFile(`sections/${type}`, { section }, { globals: scope });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}

class SectionTag extends Tag {
  private file: string;
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) { super(token, remain, liquid); this.file = token.args.replace(/['"]/g, '').trim(); }
  * render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const scope = ctx.globals as any;
    emitter.write(yield renderSection(this.file, this.file, {}, scope, scope.__data));
  }
}
engine.registerTag('section', SectionTag);

class SectionsTag extends Tag {
  private group: string;
  constructor(token: TagToken, remain: TopLevelToken[], liquid: Liquid) { super(token, remain, liquid); this.group = token.args.replace(/['"]/g, '').trim(); }
  * render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const scope = ctx.globals as any;
    const group = JSON.parse(fs.readFileSync(path.join(ROOT, 'sections', `${this.group}.json`), 'utf8'));
    for (const key of group.order) emitter.write(yield renderSection(group.sections[key].type, `sections--${this.group}__${key}`, group.sections[key], scope, scope.__data));
  }
}
engine.registerTag('sections', SectionsTag);

/* ---------------- Data model ---------------- */

interface Data { products: any[]; collections: any; heroImage: any; editorialImage: any; linklists: Record<string, any>; pages: Record<string, any> }
let variantSeq = 1000;

function imageObj(i: Img) {
  return { src: `/preview-img/${i.name}.jpg`, width: i.width, height: i.height, alt: i.alt, aspect_ratio: i.width / i.height };
}

function buildProduct(f: FixtureProduct, idx: number): any {
  const media = f.images.map((i, n) => ({ id: idx * 100 + n + 1, media_type: 'image', alt: i.alt, preview_image: imageObj(i), position: n + 1 }));
  const variants = f.variants.map((v) => {
    const options = [v.colour, v.size].filter((x): x is string => Boolean(x));
    const id = (variantSeq += 1);
    const colourImage = v.colour ? media.find((m) => m.alt.includes(`in ${v.colour}`)) : undefined;
    return {
      id, title: options.length ? options.join(' / ') : 'Default Title', options, option1: options[0] ?? 'Default Title', option2: options[1] ?? null,
      price: v.price, compare_at_price: null, available: v.available, sku: `ORN-${f.handle.split('-').slice(0, 4).map((w) => w.slice(0, 2)).join('').toUpperCase()}-${options.join('-').toUpperCase().replace(/[^A-Z0-9-]/g, '')}`,
      inventory_management: 'shopify', inventory_policy: 'deny', inventory_quantity: v.qty, featured_media: colourImage ?? null,
      url: `/products/${f.handle}?variant=${id}`, unit_price_measurement: null,
    };
  });
  const first = variants.find((v) => v.available) ?? variants[0];
  const optionsWithValues = f.options.map((name, i) => ({ name, position: i + 1, values: [...new Set(variants.map((v) => v.options[i]))], selected_value: first.options[i] }));
  const prices = variants.map((v) => v.price);
  const chart = f.sizeChart ? SIZE_CHARTS[f.sizeChart] : null;
  const created = new Date(Date.now() - f.createdDaysAgo * 86_400_000).toISOString();
  return {
    id: idx + 1, handle: f.handle, title: f.title, url: `/products/${f.handle}`, description: f.description, type: f.type, tags: f.tags, created_at: created,
    price: Math.min(...prices), price_min: Math.min(...prices), price_max: Math.max(...prices), price_varies: new Set(prices).size > 1,
    available: variants.some((v) => v.available), compare_at_price: null, featured_media: media[0], media, images: media.map((m) => m.preview_image),
    options: f.options, options_with_values: optionsWithValues, variants, selected_or_first_available_variant: first, has_only_default_variant: f.options.length === 0,
    collections: [], object_type: 'product', content: f.description,
    metafields: {
      custom: {
        fabric: f.fabric ? { value: f.fabric } : null, care: f.care ? { value: f.care } : null, fit_note: f.fitNote ? { value: f.fitNote } : null,
        model_info: f.modelInfo ? { value: f.modelInfo } : null,
        size_chart: chart ? { value: { name: { value: chart.name }, unit_note: { value: chart.unit_note }, rows: { value: chart.rows }, how_to_measure: { value: JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: chart.how }] }] }) } } } : null,
        price_history: null, complete_the_look: null,
      },
      reviews: {},
    },
    _fixture: f,
  };
}

function buildData(): Data {
  variantSeq = 1000;
  const products = PRODUCTS.map(buildProduct);
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));
  for (const p of products) {
    const look = p._fixture.completeTheLook;
    if (look) p.metafields.custom.complete_the_look = { value: look.map((h: string) => byHandle[h]).filter(Boolean) };
  }
  const collections: any[] & Record<string, any> = [] as any;
  for (const c of COLLECTIONS) {
    const items = products.filter((p) => c.filter(p._fixture));
    const col = { id: collections.length + 1, handle: c.handle, title: c.title, description: c.description ? `<p>${c.description}</p>` : '', url: `/collections/${c.handle}`, products: items, products_count: items.length, all_products_count: items.length, featured_image: items[0]?.featured_media?.preview_image ?? null, image: null, filters: [], sort_options: [], sort_by: 'manual', default_sort_by: 'manual' };
    collections.push(col);
    collections[c.handle] = col;
    for (const p of items) if (c.handle !== 'all' && !p.collections.length) p.collections.push(col);
  }
  const pages = Object.fromEntries(PAGES.map((p, i) => [p.handle, { id: i + 1, handle: p.handle, title: p.title, url: `/pages/${p.handle}`, content: fs.readFileSync(p.file, 'utf8'), template_suffix: p.templateSuffix ?? null }]));
  const toLink = (item: MenuItemPlan): any => {
    const col = item.collection ? collections[item.collection] : null;
    const url = col ? col.url : item.collection ? `/collections/${item.collection}` : item.page ? `/pages/${item.page}` : item.url;
    return { title: item.title, url, handle: (item.collection ?? item.page ?? item.title).toLowerCase(), type: item.collection ? 'collection_link' : item.page ? 'page_link' : 'http_link', object: col ?? (item.collection ? { products_count: 0 } : null), links: (item.items ?? []).map(toLink), current: false };
  };
  const linklists = Object.fromEntries(MENUS.map((m) => [m.handle, { handle: m.handle, title: m.title, links: m.items.map(toLink) }]));
  return {
    products, collections, pages, linklists,
    heroImage: imageObj({ name: 'hero', shape: 'jumper', colour: '#C2491D', width: 1536, height: 2048, alt: 'Knitwear gifts laid out on a table' }),
    editorialImage: imageObj({ name: 'editorial', shape: 'jacket', colour: '#5d6532', width: 1536, height: 2048, alt: 'Olive padded jacket' }),
  };
}

function defaultSettings() {
  const s: Record<string, unknown> = {};
  for (const group of settingsSchema) for (const def of group.settings ?? []) if (def.id) s[def.id] = def.default ?? null;
  s.type_body_font = { family: 'Inter', fallback_families: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", weight: 400 };
  // Preview only: sample Christmas date so the cut-off block can be checked visually.
  s.christmas_standard_cutoff = 'Thursday 17 December';
  return s;
}

/* ---------------- Cart (in memory) ---------------- */

const cart = { items: [] as any[], note: '' };
function cartObject(data: Data) {
  const items = cart.items.map((it) => {
    const product = data.products.find((p) => p.variants.some((v: any) => v.id === it.variant_id));
    const variant = product.variants.find((v: any) => v.id === it.variant_id);
    const line = variant.price * it.quantity;
    return { ...it, key: `${variant.id}:x`, product, variant, url: variant.url, image: (variant.featured_media ?? product.featured_media).preview_image, title: product.title, final_line_price: line, original_line_price: line, line_level_discount_allocations: [], properties: {}, price: variant.price };
  });
  const total = items.reduce((s, i) => s + i.final_line_price, 0);
  return { items, item_count: items.reduce((s, i) => s + i.quantity, 0), total_price: total, note: cart.note, currency: { iso_code: 'GBP' }, taxes_included: false, cart_level_discount_applications: [] };
}

/* ---------------- Facets for collection and search ---------------- */

function facetsFor(products: any[], params: URLSearchParams, basePath: string) {
  const active = (name: string) => params.getAll(name);
  const urlWith = (mut: (p: URLSearchParams) => void) => { const p = new URLSearchParams(params); p.delete('section_id'); p.delete('page'); mut(p); const s = p.toString(); return `${basePath}${s ? `?${s}` : ''}`; };
  const filtered = products.filter((p) => {
    if (active('filter.v.availability').includes('1') && !p.available) return false;
    for (const [opt, name] of [['Size', 'filter.v.option.size'], ['Colour', 'filter.v.option.colour']]) {
      const vals = active(name);
      const i = p.options.indexOf(opt);
      if (vals.length && (i < 0 || !p.variants.some((v: any) => vals.includes(v.options[i])))) return false;
    }
    const types = active('filter.p.product_type');
    if (types.length && !types.includes(p.type)) return false;
    const gte = Number(params.get('filter.v.price.gte') || 0) * 100;
    const lte = Number(params.get('filter.v.price.lte') || 0) * 100;
    if (gte && p.price < gte) return false;
    if (lte && p.price > lte) return false;
    return true;
  });
  const listFilter = (label: string, param: string, valuesOf: (p: any) => string[]) => {
    const counts = new Map<string, number>();
    products.forEach((p) => [...new Set(valuesOf(p))].forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1)));
    const values = [...counts.entries()].map(([value, count]) => {
      const isActive = active(param).includes(value);
      return { label: value, value, count, active: isActive, param_name: param, url_to_remove: urlWith((p) => { const keep = p.getAll(param).filter((x) => x !== value); p.delete(param); keep.forEach((k) => p.append(param, k)); }) };
    });
    return { label, type: 'list', param_name: param, values, active_values: values.filter((v) => v.active), presentation: label === 'Colour' ? 'swatch' : 'text' };
  };
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const sizeFilter = listFilter('Size', 'filter.v.option.size', (p) => { const i = p.options.indexOf('Size'); return i < 0 ? [] : p.variants.map((v: any) => v.options[i]); });
  sizeFilter.values.sort((a, b) => (sizeOrder.indexOf(a.value) + 99) % 199 - (sizeOrder.indexOf(b.value) + 99) % 199);
  const maxPrice = Math.max(...products.map((p) => p.price_max), 0);
  const filters = [
    listFilter('Availability', 'filter.v.availability', (p) => (p.available ? ['1'] : [])),
    { label: 'Price', type: 'price_range', range_max: maxPrice, min_value: { param_name: 'filter.v.price.gte', value: params.get('filter.v.price.gte') ? Number(params.get('filter.v.price.gte')) * 100 : null }, max_value: { param_name: 'filter.v.price.lte', value: params.get('filter.v.price.lte') ? Number(params.get('filter.v.price.lte')) * 100 : null }, active_values: [], url_to_remove: urlWith((p) => { p.delete('filter.v.price.gte'); p.delete('filter.v.price.lte'); }) },
    sizeFilter,
    listFilter('Colour', 'filter.v.option.colour', (p) => { const i = p.options.indexOf('Colour'); return i < 0 ? [] : p.variants.map((v: any) => v.options[i]); }),
    listFilter('Product type', 'filter.p.product_type', (p) => [p.type]),
  ];
  (filters[0] as any).values.forEach((v: any) => { v.label = 'In stock'; });
  const sortBy = params.get('sort_by') ?? 'manual';
  const sorted = [...filtered];
  if (sortBy === 'price-ascending') sorted.sort((a, b) => a.price - b.price);
  if (sortBy === 'price-descending') sorted.sort((a, b) => b.price - a.price);
  if (sortBy === 'created-descending') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sort_options = [
    { value: 'manual', name: 'Featured' }, { value: 'best-selling', name: 'Best selling' }, { value: 'created-descending', name: 'Newest' },
    { value: 'price-ascending', name: 'Price, low to high' }, { value: 'price-descending', name: 'Price, high to low' },
  ];
  return { products: sorted, filters, sort_options, sort_by: sortBy };
}

/* ---------------- Page rendering ---------------- */

interface PageContext { template: string; suffix?: string; pageType: string; scope: Record<string, unknown>; title: string; description?: string; status?: number }

async function renderPage(url: URL, pc: PageContext, data: Data, sectionOnly?: string | null): Promise<{ status: number; html: string; contentType: string }> {
  const templateFile = path.join(ROOT, 'templates', `${pc.template}${pc.suffix ? `.${pc.suffix}` : ''}.json`);
  const tpl = JSON.parse(fs.readFileSync(fs.existsSync(templateFile) ? templateFile : path.join(ROOT, 'templates', `${pc.template}.json`), 'utf8'));
  const scope: Record<string, any> = {
    ...pc.scope,
    __data: data, __url: url.pathname + url.search,
    settings: defaultSettings(),
    shop: {
      name: 'Ornis', url: ORIGIN, description: 'Affordable fashion, beauty and gifts, delivered across the UK.', money_format: '£{{amount}}', customer_accounts_enabled: true,
      enabled_payment_types: ['visa', 'master', 'american_express', 'maestro', 'paypal', 'apple_pay', 'google_pay', 'shopify_pay', 'klarna'],
      privacy_policy: { url: '/policies/privacy-policy', title: 'Privacy policy' }, password_message: '',
      metafields: { judgeme: {} },
      metaobjects: {
        shop_info: { main: { processing_days: { value: 3 }, delivery_min_days: { value: 3 }, delivery_max_days: { value: 7 }, free_delivery_threshold: { value: 30 }, returns_window_days: { value: 14 }, response_time: { value: null } } },
        size_chart: { values: Object.values(SIZE_CHARTS).map((c) => ({ name: { value: c.name }, unit_note: { value: c.unit_note }, rows: { value: c.rows }, how_to_measure: { value: JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: c.how }] }] }) } })) },
        faq_item: { values: FAQ.map((f) => ({ question: { value: f.question }, answer: { value: JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: f.answer }] }] }) }, topic: { value: f.topic } })) },
      },
    },
    routes: { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', search_url: '/search', predictive_search_url: '/search/suggest', product_recommendations_url: '/recommendations/products', account_url: '/account' },
    request: { page_type: pc.pageType, path: url.pathname, origin: ORIGIN, locale: { iso_code: 'en' } },
    template: { name: pc.template, suffix: pc.suffix ?? null },
    canonical_url: ORIGIN + url.pathname,
    page_title: pc.title, page_description: pc.description ?? null,
    linklists: data.linklists, collections: data.collections, cart: cartObject(data),
    current_page: Number(url.searchParams.get('page') ?? 1),
    additional_checkout_buttons: true, content_for_additional_checkout_buttons: '<button type="button" class="button button--secondary button--full" disabled>Shop Pay (preview)</button>',
    content_for_header: '',
  };

  const sectionsHtml: Record<string, string> = {};
  for (const key of tpl.order) {
    const id = `template--${pc.template}__${key}`;
    if (sectionOnly && sectionOnly !== id) continue;
    sectionsHtml[id] = await renderSection(tpl.sections[key].type, id, tpl.sections[key], scope, data);
  }
  if (sectionOnly) {
    if (sectionsHtml[sectionOnly]) return { status: 200, html: sectionsHtml[sectionOnly], contentType: 'text/html' };
    return { status: 200, html: await renderSection(sectionOnly, sectionOnly, {}, scope, data), contentType: 'text/html' };
  }
  const layout = tpl.layout === 'password' ? 'password' : 'theme';
  const html = await engine.renderFile(`layout/${layout}`, {}, { globals: { ...scope, content_for_layout: Object.values(sectionsHtml).join('\n') } });
  return { status: pc.status ?? 200, html, contentType: 'text/html; charset=utf-8' };
}

function route(url: URL, data: Data): PageContext {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { template: 'index', pageType: 'index', scope: {}, title: 'Ornis | Affordable fashion and gifts, delivered across the UK', description: 'Affordable fashion for women, men and kids, plus beauty and gifts. Free UK delivery on orders over £30 and 14-day returns.' };
  if (parts[0] === 'collections' && parts[1]) {
    const col = data.collections[parts[1]];
    if (col) {
      const facets = facetsFor(col.products, url.searchParams, url.pathname);
      const scoped = { ...col, ...facets };
      return { template: 'collection', pageType: 'collection', scope: { collection: scoped }, title: col.title, description: col.description.replace(/<[^>]+>/g, '') };
    }
  }
  if (parts[0] === 'collections' && !parts[1]) return { template: 'list-collections', pageType: 'list-collections', scope: {}, title: 'All collections' };
  if (parts[0] === 'products' && parts[1]) {
    const product = data.products.find((p) => p.handle === parts[1]);
    if (product) {
      const vid = Number(url.searchParams.get('variant'));
      const selected = product.variants.find((v: any) => v.id === vid) ?? product.selected_or_first_available_variant;
      const p = { ...product, selected_or_first_available_variant: selected, options_with_values: product.options_with_values.map((o: any, i: number) => ({ ...o, selected_value: selected.options[i] })) };
      return { template: 'product', pageType: 'product', scope: { product: p, page_image: product.featured_media.preview_image }, title: product.title, description: product.description.replace(/<[^>]+>/g, '').slice(0, 155) };
    }
  }
  if (parts[0] === 'pages' && parts[1] && data.pages[parts[1]]) {
    const page = data.pages[parts[1]];
    return { template: 'page', suffix: page.template_suffix ?? undefined, pageType: 'page', scope: { page }, title: page.title };
  }
  if (parts[0] === 'cart') return { template: 'cart', pageType: 'cart', scope: {}, title: 'Your bag' };
  if (parts[0] === 'search') {
    const terms = url.searchParams.get('q') ?? '';
    const matches = terms ? data.products.filter((p) => p.title.toLowerCase().includes(terms.toLowerCase()) || p.type.toLowerCase().includes(terms.toLowerCase())) : [];
    const facets = facetsFor(matches, url.searchParams, url.pathname);
    return { template: 'search', pageType: 'search', scope: { search: { performed: Boolean(terms), terms, results: facets.products, results_count: facets.products.length, filters: facets.filters, sort_options: facets.sort_options, sort_by: facets.sort_by, default_sort_by: 'relevance' } }, title: terms ? `Search: ${terms}` : 'Search' };
  }
  if (parts[0] === 'password') return { template: 'password', pageType: 'password', scope: {}, title: 'Opening soon' };
  return { template: '404', pageType: '404', scope: {}, title: 'Page not found', status: 404 };
}

/* ---------------- HTTP server ---------------- */

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function sectionsJson(ids: string[], url: URL, data: Data) {
  const out: Record<string, string> = {};
  for (const id of ids) out[id] = (await renderPage(url, route(url, data), data, id)).html;
  return out;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', ORIGIN);
  const data = buildData();
  const send = (status: number, body: string | Buffer, type: string) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  try {
    if (url.pathname.startsWith('/assets/')) {
      const file = path.join(ROOT, 'assets', path.basename(url.pathname));
      if (!fs.existsSync(file)) return send(404, 'not found', 'text/plain');
      const ext = path.extname(file);
      const types: Record<string, string> = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
      return send(200, fs.readFileSync(file), types[ext] ?? 'application/octet-stream');
    }
    if (url.pathname.startsWith('/preview-img/')) {
      const name = path.basename(url.pathname, '.jpg');
      const fixture = PRODUCTS.flatMap((p) => p.images).find((i) => i.name === name) ?? (name === 'hero' ? { name, shape: 'jumper', colour: '#C2491D' } : { name, shape: 'jacket', colour: '#5d6532' });
      const file = await ensureImage(IMG_DIR, fixture.name, fixture.shape, fixture.colour);
      return send(200, fs.readFileSync(file), 'image/jpeg');
    }
    if (url.pathname === '/cart.js') { const c = cartObject(data); return send(200, JSON.stringify({ item_count: c.item_count, total_price: c.total_price, note: c.note }), 'application/json'); }
    if (url.pathname === '/cart/add.js' && req.method === 'POST') {
      const raw = Buffer.from(await readBody(req), 'utf8');
      const fd = await new Request(ORIGIN, { method: 'POST', headers: { 'content-type': req.headers['content-type'] ?? 'application/x-www-form-urlencoded' }, body: raw }).formData();
      const body = { get: (k: string) => (fd.get(k) as string | null) };
      const id = Number(body.get('id'));
      const qty = Math.max(1, Number(body.get('quantity') ?? 1));
      const product = data.products.find((p) => p.variants.some((v: any) => v.id === id));
      const variant = product?.variants.find((v: any) => v.id === id);
      if (!variant || !variant.available) return send(422, JSON.stringify({ status: 422, message: 'Cart Error', description: 'This item is sold out.' }), 'application/json');
      const existing = cart.items.find((i) => i.variant_id === id);
      if (existing) existing.quantity += qty; else cart.items.push({ variant_id: id, quantity: qty });
      const sections = await sectionsJson(String(body.get('sections') ?? '').split(',').filter(Boolean), new URL(body.get('sections_url') ?? '/', ORIGIN), buildData());
      return send(200, JSON.stringify({ id, quantity: qty, sections }), 'application/json');
    }
    if (url.pathname === '/cart/change.js' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const index = Number(body.line) - 1;
      if (cart.items[index]) {
        if (Number(body.quantity) === 0) cart.items.splice(index, 1); else cart.items[index].quantity = Number(body.quantity);
      }
      const sections = await sectionsJson(body.sections ?? [], new URL(body.sections_url ?? '/', ORIGIN), buildData());
      const c = cartObject(buildData());
      return send(200, JSON.stringify({ item_count: c.item_count, total_price: c.total_price, sections }), 'application/json');
    }
    if (url.pathname === '/cart/update.js' && req.method === 'POST') { cart.note = JSON.parse(await readBody(req)).note ?? ''; return send(200, '{}', 'application/json'); }
    if (url.pathname === '/cart/clear') { cart.items = []; return send(200, '{}', 'application/json'); }
    if (url.pathname === '/cart' && req.method === 'POST') { res.writeHead(302, { Location: '/checkouts/preview' }); return res.end(); }
    if (url.pathname.startsWith('/checkouts/')) return send(200, '<!doctype html><html lang="en"><title>Checkout</title><main><h1>Checkout (hosted by Shopify)</h1></main></html>', 'text/html');
    if (url.pathname === '/search/suggest') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const products = data.products.filter((p) => p.title.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)).slice(0, 6);
      const cols = (data.collections as any[]).filter((c) => c.handle !== 'all' && c.title.toLowerCase().includes(q) && c.products_count > 0).slice(0, 4);
      const pages = Object.values(data.pages).filter((p: any) => p.title.toLowerCase().includes(q)).slice(0, 3);
      const html = await engine.renderFile('sections/predictive-search', {}, { globals: { predictive_search: { performed: true, terms: url.searchParams.get('q'), resources: { products, collections: cols, pages } }, routes: { search_url: '/search' } } });
      return send(200, `<div id="shopify-section-predictive-search">${html}</div>`, 'text/html');
    }
    if (url.pathname === '/recommendations/products') {
      const pid = Number(url.searchParams.get('product_id'));
      const recs = data.products.filter((p) => p.id !== pid).slice(0, Number(url.searchParams.get('limit') ?? 4));
      const pc = route(new URL(`/products/${data.products.find((p) => p.id === pid)?.handle}`, ORIGIN), data);
      pc.scope = { ...pc.scope, recommendations: { performed: true, 'performed?': true, products_count: recs.length, products: recs } };
      const r = await renderPage(url, pc, data, url.searchParams.get('section_id'));
      return send(200, r.html, r.contentType);
    }
    const pc = route(url, data);
    const sectionsParam = url.searchParams.get('sections');
    if (sectionsParam) return send(200, JSON.stringify(await sectionsJson(sectionsParam.split(','), url, data)), 'application/json');
    const r = await renderPage(url, pc, data, url.searchParams.get('section_id'));
    return send(r.status, r.html, r.contentType);
  } catch (error) {
    console.error(error);
    return send(500, `<pre>${esc((error as Error).stack)}</pre>`, 'text/html');
  }
});

server.listen(PORT, () => console.log(`Ornis preview running at ${ORIGIN}`));
