/**
 * Shopify upload rules that Theme Check does not catch. A section that breaks one of these is rejected by
 * Shopify (CLI push or GitHub sync), and every template that uses it fails too: for example the home page
 * then shows the 404 page.
 *
 * Checks every section schema (settings, block settings, presets) and every JSON template value.
 */
import fs from 'node:fs';
import path from 'node:path';

type Setting = { type: string; id?: string; default?: unknown; min?: number; max?: number; step?: number; options?: Array<{ value: string }> };
const problems: string[] = [];
const schemas = new Map<string, { settings: Setting[]; blocks: Record<string, Setting[]> }>();

function checkDefinition(where: string, s: Setting) {
  if (!s.id || s.default === undefined) return;
  const d = s.default;
  switch (s.type) {
    case 'url':
      if (d !== '/collections' && d !== '/collections/all') problems.push(`${where} ${s.id}: a url default may only be "/collections" or "/collections/all" (got "${d}")`);
      break;
    case 'richtext':
      if (typeof d !== 'string' || !/^<(p|ul|ol|h[1-6])[\s>]/.test(d.trim())) problems.push(`${where} ${s.id}: richtext default must start with <p>, <ul>, <ol> or a heading`);
      break;
    case 'select': case 'radio':
      if (!s.options?.some((o) => o.value === d)) problems.push(`${where} ${s.id}: default "${d}" is not one of the options`);
      break;
    case 'range': {
      const n = Number(d); const { min = 0, max = 0, step = 1 } = s;
      if (n < min || n > max) problems.push(`${where} ${s.id}: default ${n} is outside ${min}-${max}`);
      if (Math.abs(((n - min) / step) - Math.round((n - min) / step)) > 1e-9) problems.push(`${where} ${s.id}: default ${n} is not on a step of ${step}`);
      if ((max - min) / step > 101) problems.push(`${where} ${s.id}: range has more than 101 steps`);
      break;
    }
    case 'number':
      if (typeof d !== 'number') problems.push(`${where} ${s.id}: number default must be a number`);
      break;
    case 'text': case 'textarea': case 'inline_richtext':
      if (d === '') problems.push(`${where} ${s.id}: an empty-string default is not allowed; leave it out`);
      break;
  }
}

function checkValue(where: string, s: Setting | undefined, key: string, v: unknown) {
  if (!s) { problems.push(`${where}: setting "${key}" does not exist in the section schema`); return; }
  if (v === null || v === '') return;
  if ((s.type === 'select' || s.type === 'radio') && !s.options?.some((o) => o.value === v)) problems.push(`${where} ${key}: "${v}" is not one of the options`);
  if (s.type === 'range') {
    const n = Number(v); const { min = 0, max = 0, step = 1 } = s;
    if (n < min || n > max || Math.abs(((n - min) / step) - Math.round((n - min) / step)) > 1e-9) problems.push(`${where} ${key}: ${n} is not a valid value for ${min}-${max} step ${step}`);
  }
  if (s.type === 'url' && typeof v === 'string' && !/^(\/|https?:\/\/|shopify:\/\/|mailto:|tel:|#)/.test(v)) problems.push(`${where} ${key}: "${v}" is not a valid link`);
}

for (const file of fs.readdirSync('theme/sections').filter((f) => f.endsWith('.liquid'))) {
  const src = fs.readFileSync(path.join('theme/sections', file), 'utf8');
  const m = src.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!m) continue;
  const schema = JSON.parse(m[1]);
  const where = `sections/${file}`;
  const settings: Setting[] = schema.settings ?? [];
  settings.forEach((s) => checkDefinition(where, s));
  const ids = settings.filter((s) => s.id).map((s) => s.id);
  if (new Set(ids).size !== ids.length) problems.push(`${where}: duplicate setting ids`);
  const blocks: Record<string, Setting[]> = {};
  for (const b of schema.blocks ?? []) {
    (b.settings ?? []).forEach((s: Setting) => checkDefinition(`${where} block "${b.type}"`, s));
    blocks[b.type] = b.settings ?? [];
  }
  schemas.set(file.replace(/\.liquid$/, ''), { settings, blocks });
}

const jsonFiles = [
  ...fs.readdirSync('theme/templates').filter((f) => f.endsWith('.json')).map((f) => `theme/templates/${f}`),
  ...fs.readdirSync('theme/sections').filter((f) => f.endsWith('.json')).map((f) => `theme/sections/${f}`),
];
for (const file of jsonFiles) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [key, sec] of Object.entries<any>(json.sections ?? {})) {
    const schema = schemas.get(sec.type);
    const where = `${file} section "${key}" (${sec.type})`;
    if (!schema) { problems.push(`${where}: section file does not exist`); continue; }
    for (const [k, v] of Object.entries(sec.settings ?? {})) checkValue(where, schema.settings.find((s) => s.id === k), k, v);
    for (const [bid, block] of Object.entries<any>(sec.blocks ?? {})) {
      const bset = schema.blocks[block.type];
      if (!bset && !String(block.type).startsWith('shopify://')) { problems.push(`${where} block "${bid}": block type "${block.type}" does not exist`); continue; }
      for (const [k, v] of Object.entries(block.settings ?? {})) checkValue(`${where} block "${bid}"`, bset?.find((s) => s.id === k), k, v);
    }
  }
}

problems.forEach((p) => console.log(p));
console.log(`Shopify schema rules: ${schemas.size} sections, ${jsonFiles.length} JSON files, ${problems.length} problem(s).`);
process.exit(problems.length ? 1 : 0);
