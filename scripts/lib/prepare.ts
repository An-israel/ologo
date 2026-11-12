/** Image pipeline core (sharp): auto-orient, trim plain borders, centre on white at 3:4, 2048 px tall, JPEG under 400 KB. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { TARGET } from './images.js';

export interface PreparedImage { input: string; output: string; width: number; height: number; bytes: number; quality: number; warnings: string[] }

export async function prepareImage(input: string, output: string): Promise<PreparedImage> {
  const warnings: string[] = [];
  const meta = await sharp(input).metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (longEdge < 1000) warnings.push(`Source is only ${meta.width}x${meta.height}px; it may look soft. Find a larger photo.`);

  // Orient by EXIF, trim near-white borders, then fit inside the 3:4 canvas on white.
  let base = sharp(input, { failOn: 'error' }).rotate();
  try {
    const trimmed = await base.clone().trim({ background: '#ffffff', threshold: 12 }).toBuffer({ resolveWithObject: true });
    base = sharp(trimmed.data);
  } catch {
    // trim fails on images that are entirely one colour; keep the original
  }
  const canvas = await base
    .resize(TARGET.width, TARGET.height, { fit: 'contain', background: '#ffffff', withoutEnlargement: false })
    .flatten({ background: '#ffffff' })
    .toBuffer();

  fs.mkdirSync(path.dirname(output), { recursive: true });
  let quality = 84;
  let data = await sharp(canvas).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
  while (data.length > TARGET.maxBytes && quality > 45) {
    quality -= 6;
    data = await sharp(canvas).jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  if (data.length > TARGET.maxBytes) warnings.push(`Still ${(data.length / 1024).toFixed(0)} KB at quality ${quality}; consider a simpler photo.`);
  await fs.promises.writeFile(output, data);
  return { input, output, width: TARGET.width, height: TARGET.height, bytes: data.length, quality, warnings };
}

/** Run async jobs with a fixed concurrency (backpressure, item 44). */
export async function pool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
