/**
 * validate-products: checks every row of a product CSV against the data standard and prints plain-English errors.
 *
 *   npm run validate -- templates/ornis_products_example.csv
 *
 * Exit code 1 when any product has an error, so it can gate import-products and CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/args.js';
import { readCsv } from './lib/csv.js';
import { groupByHandle, validateGroups, type Problem } from './lib/product-csv.js';

export function preparedImageCount(handle: string, root = 'work/images'): number | undefined {
  const dir = path.join(root, handle, 'prepared');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|webp)$/i.test(f)).length : undefined;
}

export function printProblems(problems: Problem[]): void {
  const byHandle = new Map<string, Problem[]>();
  problems.forEach((p) => byHandle.set(p.handle, [...(byHandle.get(p.handle) ?? []), p]));
  for (const [handle, list] of byHandle) {
    console.log(`\n${handle}`);
    for (const p of list) console.log(`  ${p.level === 'error' ? 'ERROR' : 'warn '} line ${p.line}: ${p.message}`);
  }
}

if (process.argv[1]?.endsWith('validate-products.ts')) {
  const args = parseArgs();
  const file = args.positional[0];
  if (!file) {
    console.error('Usage: npm run validate -- path/to/products.csv');
    process.exit(2);
  }
  const groups = groupByHandle(readCsv(file));
  const problems = validateGroups(groups, { imageCount: (h) => preparedImageCount(h) });
  printProblems(problems);
  const bad = new Set(problems.filter((p) => p.level === 'error').map((p) => p.handle));
  console.log(`\n${groups.length} product(s): ${groups.length - bad.size} ready, ${bad.size} with errors, ${problems.filter((p) => p.level === 'warning').length} warning(s).`);
  process.exitCode = bad.size ? 1 : 0;
}
