/**
 * set-redirects: creates URL redirects from a CSV with columns old_path,new_path.
 *
 *   npm run redirects -- templates/redirects.csv            # dry run
 *   npm run redirects -- templates/redirects.csv --apply
 */
import { parseArgs } from './lib/args.js';
import { readCsv } from './lib/csv.js';
import { acquireLock } from './lib/lock.js';
import { RunLog } from './lib/log.js';
import { ensureRedirect } from './lib/redirects.js';
import { ShopifyClient } from './lib/shopify.js';

const args = parseArgs();
const file = args.positional[0] ?? 'templates/redirects.csv';
const log = new RunLog('set-redirects');

async function main() {
  const release = acquireLock('set-redirects');
  const client = new ShopifyClient({ log });
  const rows = readCsv(file).filter((r) => r.old_path?.trim() && r.new_path?.trim());
  const counts: Record<string, number> = {};
  try {
    for (const r of rows) {
      const result = await ensureRedirect(client, log, args.apply, r.old_path.trim(), r.new_path.trim());
      counts[result] = (counts[result] ?? 0) + 1;
      if (result !== 'ok') console.log(`${result.padEnd(13)} ${r.old_path} -> ${r.new_path}`);
    }
  } finally { release(); }
  console.log(`\n${rows.length} redirect(s): ${JSON.stringify(counts)}. Log: ${log.file}`);
  if (!args.apply) console.log('No changes made. Re-run with --apply after approval.');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
