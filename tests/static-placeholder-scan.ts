/**
 * Static placeholder scan (runs in CI without a browser): customer-facing text in locales, JSON templates,
 * section groups, schema defaults and content pages must contain none of the banned placeholder strings.
 * The rendered-page version is tests/e2e/quality.spec.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PLACEHOLDER_STRINGS } from '../scripts/lib/rules.js';

const files = [
  'theme/locales/en.default.json',
  ...fs.readdirSync('theme/templates').filter((f) => f.endsWith('.json')).map((f) => `theme/templates/${f}`),
  ...fs.readdirSync('theme/sections').filter((f) => f.endsWith('.json')).map((f) => `theme/sections/${f}`),
  ...fs.readdirSync('content/pages').map((f) => `content/pages/${f}`),
];
const schemaDefaults = fs.readdirSync('theme/sections').filter((f) => f.endsWith('.liquid')).map((f) => {
  const m = fs.readFileSync(path.join('theme/sections', f), 'utf8').match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  return { file: `theme/sections/${f} (schema)`, text: m ? JSON.stringify(JSON.parse(m[1]).presets ?? []) + JSON.stringify((JSON.parse(m[1]).settings ?? []).map((s: { default?: unknown }) => s.default ?? '')) : '' };
});

// "{{" is Liquid interpolation in locales and a JSON artefact in serialised schemas; the rendered scan catches leaks.
const problems: string[] = [];
for (const { file, text } of [...files.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') })), ...schemaDefaults]) {
  const isLocale = file.endsWith('en.default.json') || file.endsWith('(schema)') || file.endsWith('.json');
  for (const p of PLACEHOLDER_STRINGS) {
    if (isLocale && (p === '{{' || p === '}}')) continue;
    if (text.toLowerCase().includes(p.toLowerCase())) problems.push(`${file}: contains "${p}"`);
  }
  if (/\[TO CONFIRM/i.test(text)) problems.push(`${file}: contains [TO CONFIRM]`);
}
problems.forEach((p) => console.log(p));
console.log(`Placeholder scan: ${files.length + schemaDefaults.length} files, ${problems.length} problem(s).`);
process.exit(problems.length ? 1 : 0);
