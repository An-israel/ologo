/**
 * The Ornis product data standard (brief section 6.3) as pure functions.
 * Used by audit-catalogue, normalise-products, validate-products and import-products, and unit tested.
 */

/* ---------- Placeholder and junk text ---------- */

/** Strings that must never appear on a rendered page (section 2.3). Shared with tests/no-placeholders.spec.ts. */
export const PLACEHOLDER_STRINGS = [
  'Button label', 'Image heading', "Author's name", 'Use collapsible tabs', 'Share information about your brand',
  'Pair text with an image', 'Add customer reviews', "Your collection's name", 'About your brand', 'Welcome to our store',
  '{{', '}}', '[LINK]', 'NOTE TO MERCHANT', 'lorem', 'Brand Name: NONE', 'CN:', 'Choice: yes', 'alicdn.com',
  'Open media', 'Talk about your brand', 'Collection title', 'Example product', 'Your content', 'Subheading',
];

/** Supplier spec lines stripped from descriptions (e.g. "Brand Name: NONE", "Origin: Mainland China"). */
const SPEC_KEYS = [
  'brand name', 'cn', 'origin', 'choice', 'semi_choice', 'source type', 'model number', 'item type', 'place of origin',
  'department name', 'applicable scene', 'applicable season', 'style', 'release date', 'gender', 'age', 'is_customized',
  'feature', 'decoration', 'pattern type', 'closure type', 'collar', 'sleeve style', 'fit type', 'thickness', 'elasticity',
  'hign-concerned chemical', 'high-concerned chemical', 'material composition', 'origin_cn', 'certification', 'obsolete',
  'clothing length', 'fabric type', 'waist type', 'front style', 'craft of weaving', 'sleeve length(cm)', 'dresses length',
];
const SPEC_LINE = new RegExp(`^\\s*(${SPEC_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:：]`, 'i');

export function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

export function findPlaceholders(text: string): string[] {
  const lower = text.toLowerCase();
  return PLACEHOLDER_STRINGS.filter((p) => lower.includes(p.toLowerCase()));
}

export function hasSpecJunk(html: string): boolean {
  return stripTags(html).split('\n').some((line) => SPEC_LINE.test(line));
}

/** Remove spec-dump lines and supplier image tags from a description, keeping real prose. */
export function stripSpecJunk(html: string): string {
  const withoutImages = html.replace(/<img[^>]*>/gi, '');
  const lines = stripTags(withoutImages).split('\n').map((l) => l.trim()).filter(Boolean);
  const kept = lines.filter((line) => !SPEC_LINE.test(line));
  return kept.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function wordCount(html: string): number {
  return stripTags(html).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/* ---------- Titles and handles ---------- */

export const SUPPLIER_WORDS = [
  '2023', '2024', '2025', '2026', 'new arrival', 'new fashion', 'hot sale', 'hot', 'brand clothing', 'free shipping',
  'dropshipping', 'wholesale', 'high quality', 'top quality', 'oversize fashion', 'korean', 'ins', 'y2k', 'casual new',
];

export function titleIssues(title: string): string[] {
  const issues: string[] = [];
  const t = title.trim();
  if (!t) return ['Title is empty.'];
  if (t.length > 70) issues.push(`Title is ${t.length} characters; keep it under 70.`);
  for (const word of SUPPLIER_WORDS) {
    if (new RegExp(`(^|\\W)${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i').test(t)) issues.push(`Title contains supplier wording "${word}".`);
  }
  if (t === t.toUpperCase() && /[A-Z]{4,}/.test(t)) issues.push('Title is in capitals; use normal capitalisation.');
  return issues;
}

const HANDLE_STOP = new Set(['a', 'an', 'the', 'and', 'with', 'for', 'of', 'in', 'on', 'new', 'hot', 'sale', 'fashion', 'style', 'brand', 'clothing', '2024', '2025', '2026']);

/** Short readable handle from the title: "Men's Slim Stretch Denim Jeans" -> "mens-slim-stretch-denim-jeans". */
export function handleFromTitle(title: string, maxWords = 6): string {
  const words = title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !HANDLE_STOP.has(w));
  return words.slice(0, maxWords).join('-');
}

export function handleIssues(handle: string): string[] {
  const issues: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle)) issues.push('Handle may only contain lowercase letters, numbers and single hyphens.');
  if (handle.length > 60) issues.push(`Handle is ${handle.length} characters; keep it short (under 60).`);
  if (handle.split('-').length > 8) issues.push('Handle has more than 8 words; shorten it.');
  return issues;
}

/* ---------- Variants ---------- */

const COLOUR_CANONICAL: Record<string, string> = {
  'black': 'Black', 'white': 'White', 'beige': 'Beige', 'khaki': 'Khaki', 'grey': 'Grey', 'gray': 'Grey', 'dark grey': 'Dark Grey',
  'dark gray': 'Dark Grey', 'light grey': 'Light Grey', 'light gray': 'Light Grey', 'navy': 'Navy', 'navy blue': 'Navy',
  'blue': 'Blue', 'sky blue': 'Sky Blue', 'light blue': 'Light Blue', 'royal blue': 'Royal Blue', 'red': 'Red', 'red red': 'Red',
  'wine red': 'Wine Red', 'burgundy': 'Burgundy', 'pink': 'Pink', 'light pink': 'Light Pink', 'rose red': 'Rose', 'green': 'Green',
  'army green': 'Army Green', 'dark green': 'Dark Green', 'olive': 'Olive', 'brown': 'Brown', 'coffee': 'Coffee', 'camel': 'Camel',
  'apricot': 'Apricot', 'yellow': 'Yellow', 'orange': 'Orange', 'purple': 'Purple', 'violet': 'Purple', 'lilac': 'Lilac',
  'cream': 'Cream', 'ivory': 'Ivory', 'off white': 'Off White', 'off-white': 'Off White', 'silver': 'Silver', 'gold': 'Gold',
  'multicolor': 'Multicolour', 'multicolour': 'Multicolour', 'multi': 'Multicolour', 'leopard': 'Leopard', 'mint green': 'Mint Green',
};

/** Values that are not colour names at all and must be renamed by the operator via the mapping file. */
export function isBadColourName(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return true;
  if (/^image ?colou?r ?\d*$/.test(v)) return true;
  if (/(as (the )?(picture|photo|shown|image))|(same as)|(picture colou?r)|(^colou?r ?\d+$)/.test(v)) return true;
  if (/^\d+$/.test(v)) return true;
  if (/^[a-z]*\d+[a-z0-9]*$/i.test(v.replace(/\s/g, '')) && /\d/.test(v)) return true; // codes like Kj1C7960A
  return false;
}

export function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/(^|[\s-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

/** Normalise a colour value. mapping (lowercase raw -> name) comes from the operator's reviewed mapping file. */
export function normaliseColour(raw: string, mapping: Record<string, string> = {}): { value: string; needsReview: boolean } {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (mapping[key]) return { value: mapping[key], needsReview: false };
  // collapse repeated words, e.g. "red red"
  const deduped = key.split(' ').filter((w, i, arr) => w !== arr[i - 1]).join(' ');
  if (COLOUR_CANONICAL[key]) return { value: COLOUR_CANONICAL[key], needsReview: false };
  if (COLOUR_CANONICAL[deduped]) return { value: COLOUR_CANONICAL[deduped], needsReview: false };
  if (isBadColourName(raw)) return { value: raw.trim(), needsReview: true };
  return { value: titleCase(deduped), needsReview: false };
}

export const ADULT_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];
const SIZE_ALIASES: Record<string, string> = {
  '2XL': 'XXL', 'XXXL': '3XL', 'XXXXL': '4XL', 'XXXXXL': '5XL', '2XS': 'XXS', 'SMALL': 'S', 'MEDIUM': 'M', 'LARGE': 'L',
  'X-LARGE': 'XL', 'XX-LARGE': 'XXL', 'EXTRA LARGE': 'XL', 'ONE SIZE': 'One Size', 'ONESIZE': 'One Size', 'FREE SIZE': 'One Size',
};

export function normaliseSize(raw: string): string {
  const v = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (SIZE_ALIASES[v]) return SIZE_ALIASES[v];
  if (ADULT_SIZE_ORDER.includes(v)) return v;
  // Kids' ages: "2-3Y", "2-3 years", "3T", "6M"
  const years = v.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*(Y|YR|YRS|YEARS?)$/);
  if (years) return `${years[1]}-${years[2]} years`;
  const months = v.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*(M|MTHS?|MONTHS?)$/);
  if (months) return `${months[1]}-${months[2]} months`;
  const toddler = v.match(/^(\d{1,2})T$/);
  if (toddler) return `${toddler[1]} years`;
  return raw.trim();
}

/** Sort key: adult letter sizes in order, then ages (months before years, by first number), then numeric sizes. */
export function sizeSortKey(size: string): number {
  const s = normaliseSize(size);
  const adult = ADULT_SIZE_ORDER.indexOf(s);
  if (adult >= 0) return 1000 + adult;
  if (s === 'One Size') return 999;
  const months = s.match(/^(\d+)(-\d+)? months$/);
  if (months) return Number(months[1]);
  const years = s.match(/^(\d+)(-\d+)? years$/);
  if (years) return 100 + Number(years[1]);
  const num = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(num) && num > 0 ? 2000 + num : 9999;
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => sizeSortKey(a) - sizeSortKey(b) || a.localeCompare(b));
}

export function sizesInOrder(sizes: string[]): boolean {
  return sortSizes(sizes).every((s, i) => s === sizes[i]);
}

/** Case-insensitive duplicates ("Black" and "black"). */
export function duplicateValues(values: string[]): string[] {
  const seen = new Map<string, string>();
  const dupes = new Set<string>();
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if (seen.has(k)) dupes.add(v);
    else seen.set(k, v);
  }
  return [...dupes];
}

/** SKU: ORN-<handle-code>-<colour>-<size>, e.g. ORN-MESLSTDE-SKYBLUE-M */
export function makeSku(handle: string, colour?: string, size?: string): string {
  const code = handle.split('-').slice(0, 4).map((w) => w.slice(0, 2)).join('').toUpperCase();
  const parts = ['ORN', code];
  if (colour) parts.push(colour.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
  if (size) parts.push(size.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  return parts.join('-');
}

/* ---------- Prices ---------- */

export interface PriceHistoryEntry { date: string; price: number }

/** Retail price >= 2.5x landed cost, ending in .99 or a whole pound. */
export function priceIssues(price: number, landedCost?: number): string[] {
  const issues: string[] = [];
  if (!(price > 0)) return ['Price is missing.'];
  const pence = Math.round(price * 100) % 100;
  if (pence !== 99 && pence !== 0) issues.push(`Price £${price.toFixed(2)} should end in .99 or be a whole pound.`);
  if (landedCost !== undefined && landedCost > 0 && price < landedCost * 2.5) {
    issues.push(`Price £${price.toFixed(2)} is below 2.5 times the landed cost (£${landedCost.toFixed(2)}); minimum is £${(landedCost * 2.5).toFixed(2)}.`);
  }
  return issues;
}

/**
 * A compare-at ("was") price is allowed only when the price history shows the item really sold at that price
 * (or higher) for at least 28 days before the current price started. Anything else is a fake reference price.
 */
export function compareAtAllowed(compareAt: number | null | undefined, price: number, history: PriceHistoryEntry[] | null | undefined, today = new Date()): boolean {
  if (!compareAt || compareAt <= price) return true; // nothing to justify
  if (!history?.length) return false;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i];
    if (entry.price + 0.001 < compareAt) continue;
    const start = new Date(`${entry.date}T00:00:00Z`);
    const end = sorted[i + 1] ? new Date(`${sorted[i + 1].date}T00:00:00Z`) : today;
    if ((end.getTime() - start.getTime()) / 86_400_000 >= 28 && start <= today) return true;
  }
  return false;
}

/** The audit's "formula" pattern: compare-at = price + a fixed £22-£25 markup on every item. */
export function looksLikeFormulaCompareAt(price: number, compareAt: number | null | undefined): boolean {
  if (!compareAt || compareAt <= price) return false;
  const diff = compareAt - price;
  return diff >= 20 && diff <= 26;
}

/** Colour variants of one product priced a few pence apart (shows "£22.43 £22.99"). */
export function mixedPrices(prices: number[]): boolean {
  const unique = [...new Set(prices.map((p) => p.toFixed(2)))];
  if (unique.length < 2) return false;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return max - min < 2; // small differences are noise; real size premiums are larger
}

/* ---------- SEO ---------- */

export function seoIssues(seoTitle: string | undefined, seoDescription: string | undefined): string[] {
  const issues: string[] = [];
  if (!seoTitle) issues.push('SEO title is missing.');
  else if (seoTitle.length > 60) issues.push(`SEO title is ${seoTitle.length} characters; keep it to 60 or fewer.`);
  if (!seoDescription) issues.push('SEO description is missing.');
  else if (seoDescription.length < 140 || seoDescription.length > 155) issues.push(`SEO description is ${seoDescription.length} characters; write 140 to 155.`);
  else if (/\.\.\.$|…$/.test(seoDescription)) issues.push('SEO description looks truncated; write a complete sentence.');
  return issues;
}

/* ---------- Restricted products (section 6.2) ---------- */

export type RestrictedCategory = 'cosmetics' | 'supplements' | 'electricals' | 'childrens-clothing';

const RESTRICTED_PATTERNS: Array<[RestrictedCategory, RegExp, RegExp | null]> = [
  ['cosmetics', /\b(serum|cream|moisturi[sz]er|lotion|lip ?(gloss|stick|colou?r|balm|oil|tint)|mascara|foundation|concealer|primer|toner|cleanser|face mask|sheet mask|perfume|fragrance|eau de|body spray|care spray|skin ?care|sunscreen|spf|nail polish|eyeliner|eyeshadow|blush|highlighter|hair oil|shampoo|conditioner|deodorant|essence|retinol|hyaluronic|niacinamide|vitamin c)\b/i, /\b(brush|brushes|sponge|tool|bag|case|organi[sz]er|mirror|headband|clip)\b/i],
  ['supplements', /\b(gumm(y|ies)|supplement|vitamins?|biotin|capsules?|tablets?|collagen powder|protein powder|probiotic|melatonin|slimming|detox tea)\b/i, null],
  ['electricals', /\b(charger|plug|usb|electric|rechargeable|battery|batteries|led|heated|heater|hair ?dryer|straightener|curler|curling (iron|wand)|massager|shaver|trimmer|epilator|lamp|power bank|adapter)\b/i, null],
  ['childrens-clothing', /\b(kids?|child|children'?s?|baby|babies|toddler|girls?|boys?|infant|newborn)\b/i, /\b(women|men|mum|dad|adult)\b/i],
];

export function restrictedCategories(text: string): RestrictedCategory[] {
  const found: RestrictedCategory[] = [];
  for (const [cat, pattern, exclude] of RESTRICTED_PATTERNS) {
    // Exclusions: make-up tools are fine (cosmetics); "women's"/"men's" items are not children's clothing.
    if (pattern.test(text) && !(exclude && exclude.test(text))) found.push(cat);
  }
  return found;
}

/** Children's items: no adult wording in title, URL or tags; flag drawstrings/cords for manual check. */
export function childrensIssues(title: string, handle: string, tags: string[], description: string): string[] {
  const issues: string[] = [];
  const text = `${title} ${handle} ${tags.join(' ')}`;
  if (/\b(sexy|nightwear|lingerie|seductive|hot girl)\b/i.test(text)) issues.push("Children's item uses adult wording; remove it from the title, URL and tags.");
  if (/\b(drawstring|cord|toggle)\b/i.test(`${title} ${description}`)) issues.push("Children's item mentions a drawstring or cord; check there is none in the hood or neck area.");
  return issues;
}

/* ---------- Images ---------- */

export function isSupplierHosted(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !host.endsWith('cdn.shopify.com') && !host.endsWith('shopify.com');
  } catch {
    return true;
  }
}

/** Draft alt text: "<title> in <colour>, <view>". Always flagged for the operator to review. */
export function draftAltText(title: string, colour: string | undefined, index: number): string {
  const views = ['front view', 'worn or styled', 'back view', 'detail', 'side view', 'close-up'];
  const view = views[index] ?? 'additional view';
  return `${title}${colour ? ` in ${colour}` : ''}, ${view}`;
}
