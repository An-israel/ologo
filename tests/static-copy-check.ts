/**
 * Copy check: customer-facing text uses British English, no em dashes, and sentence-case headings in content.
 */
import fs from 'node:fs';

const files = [
  'theme/locales/en.default.json',
  ...fs.readdirSync('theme/templates').filter((f) => f.endsWith('.json')).map((f) => `theme/templates/${f}`),
  ...fs.readdirSync('theme/sections').map((f) => `theme/sections/${f}`),
  ...fs.readdirSync('content/pages').map((f) => `content/pages/${f}`),
];
const AMERICAN = /\b(color|colors|favorite|favorites|sweater|sweaters|pants|cart is empty|zip code|center|organize|catalog|mom)\b/i;
const problems: string[] = [];
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  // Liquid code and CSS use "color" as a keyword; check only quoted strings in Liquid/JSON, everything in HTML.
  if (file.endsWith('.liquid')) {
    const schema = text.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    text = schema ? (JSON.stringify(JSON.parse(schema[1]).presets ?? []) + (JSON.parse(schema[1]).settings ?? []).map((s: { default?: unknown }) => String(s.default ?? '')).join(' ')) : '';
  }
  if (file.endsWith('.json')) text = JSON.stringify(JSON.parse(text), (k, v) => (typeof v === 'string' && /^(type|id|value|link|button_link|collection|menu)$/.test(k) ? undefined : v));
  text.split('\n').forEach((line, i) => {
    if (line.includes('—')) problems.push(`${file}:${i + 1}: em dash in customer copy`);
    const m = line.match(AMERICAN);
    if (m && !/swatch|color_|--color|"colou?r":/i.test(line)) problems.push(`${file}:${i + 1}: American English "${m[0]}"`);
  });
  if (file.endsWith('.html')) {
    for (const h of text.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/g)) {
      const words = h[1].trim().split(/\s+/).slice(1);
      if (words.some((w) => /^[A-Z][a-z]/.test(w) && !/^(UK|Ornis|Shopify|Klarna|PayPal|Christmas|England|Wales|Consumer|Rights|Act|VoiceOver|WCAG|I)$/.test(w))) problems.push(`${file}: heading not in sentence case: "${h[1]}"`);
    }
  }
}
problems.forEach((p) => console.log(p));
console.log(`Copy check: ${files.length} files, ${problems.length} problem(s).`);
process.exit(problems.length ? 1 : 0);
