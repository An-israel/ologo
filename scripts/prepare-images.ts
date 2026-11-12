/**
 * prepare-images: one folder per product, ready for upload.
 *
 *   work/images/<handle>/*.jpg|png|webp   ->   work/images/<handle>/prepared/<handle>-1.jpg ...
 *
 *   npm run prepare-images                  # every product folder
 *   npm run prepare-images -- --handle womens-cable-knit-jumper
 *
 * Files are processed in name order (rename them 1.jpg, 2.jpg... to set the order: the first must be the item
 * alone on a plain background). Runs 4 images at a time. Only writes inside work/; never touches the store.
 */
import fs from 'node:fs';
import path from 'node:path';
import { flagString, parseArgs } from './lib/args.js';
import { IMAGE_CONCURRENCY } from './lib/config.js';
import { imageFileName, naturalSort } from './lib/images.js';
import { RunLog } from './lib/log.js';
import { pool, prepareImage } from './lib/prepare.js';

const args = parseArgs();
const root = flagString(args, 'dir') ?? 'work/images';
const only = flagString(args, 'handle');
const log = new RunLog('prepare-images');

async function main() {
  if (!fs.existsSync(root)) {
    console.log(`No ${root} folder yet. Create ${root}/<product-handle>/ and put the product photos inside.`);
    return;
  }
  const handles = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).filter((h) => !only || h === only);
  let total = 0;
  const problems: string[] = [];
  for (const handle of handles) {
    const dir = path.join(root, handle);
    const sources = naturalSort(fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|avif|tiff?)$/i.test(f)));
    if (sources.length < 4) problems.push(`${handle}: only ${sources.length} photo(s); every product needs at least 4.`);
    const outDir = path.join(dir, 'prepared');
    fs.rmSync(outDir, { recursive: true, force: true });
    const results = await pool(sources, IMAGE_CONCURRENCY, async (file, i) => {
      try {
        return await prepareImage(path.join(dir, file), path.join(outDir, imageFileName(handle, i)));
      } catch (error) {
        problems.push(`${handle}/${file}: ${(error as Error).message}`);
        log.error('image.failed', { handle, file, message: (error as Error).message });
        return null;
      }
    });
    for (const r of results.filter(Boolean)) {
      total += 1;
      log.info('image.prepared', { handle, output: r!.output, kb: Math.round(r!.bytes / 1024), quality: r!.quality });
      r!.warnings.forEach((w) => problems.push(`${handle}/${path.basename(r!.input)}: ${w}`));
    }
    console.log(`${handle}: ${results.filter(Boolean).length} image(s) ready in ${outDir}`);
  }
  console.log(`\n${total} image(s) prepared for ${handles.length} product(s).`);
  if (problems.length) { console.log('\nCheck these:'); problems.forEach((p) => console.log(`  - ${p}`)); }
  console.log('\nBefore importing, look at each prepared image: no watermarks, no Chinese text, no price collages.');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
