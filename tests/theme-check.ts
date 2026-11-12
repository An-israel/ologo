/**
 * Runs Shopify Theme Check (the engine behind `shopify theme check`) against theme/.
 * Fails on any error, warning or suggestion, as required by the brief (zero errors, zero warnings).
 */
import path from 'node:path';
import { themeCheckRun } from '@shopify/theme-check-node';

const root = path.resolve('theme');
const label = ['error', 'warning', 'suggestion'];
const run = await themeCheckRun(root, path.resolve('.theme-check.yml'), () => {});
if (run.theme.length < 10) {
  console.error(`Theme Check loaded only ${run.theme.length} files; check the path.`);
  process.exit(2);
}
for (const o of run.offenses) {
  const file = o.uri.split('/theme/')[1];
  console.log(`${label[o.severity] ?? o.severity}  ${o.check}  ${file}:${o.start.line + 1}  ${o.message}`);
}
console.log(`\nTheme Check: ${run.theme.length} files, ${run.offenses.length} offence(s).`);
process.exit(run.offenses.length ? 1 : 0);
