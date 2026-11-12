import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { descriptionImageUrls, imageFileName, isAllowedImageUrl, naturalSort } from '../../scripts/lib/images.js';
import { pool, prepareImage } from '../../scripts/lib/prepare.js';

describe('image pipeline', () => {
  it('crops to 3:4 on white at 1536x2048, under 400 KB, auto-oriented', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ornis-img-'));
    const input = path.join(dir, 'wide.png');
    // A wide photo-like image (gradient with light grain) with EXIF orientation 6 (rotated 90 degrees)
    const noise = Buffer.alloc(1200 * 800 * 3);
    for (let i = 0; i < noise.length; i += 1) {
      const px = Math.floor(i / 3);
      const x = px % 1200;
      const y = Math.floor(px / 1200);
      noise[i] = Math.min(230, Math.floor((x / 1200) * 120 + (y / 800) * 80 + (i % 3) * 20 + ((i * 7919) % 9)));
    }
    await sharp(noise, { raw: { width: 1200, height: 800, channels: 3 } }).withMetadata({ orientation: 6 }).png().toFile(input);
    const out = path.join(dir, 'prepared', 'test-1.jpg');
    const result = await prepareImage(input, out);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1536);
    expect(meta.height).toBe(2048);
    expect(meta.format).toBe('jpeg');
    expect(result.bytes).toBeLessThanOrEqual(400 * 1024);
    // corner pixel is white padding
    const { data } = await sharp(out).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect([...data].every((v) => v > 240)).toBe(true);
  });

  it('names files handle-1.jpg in natural order', () => {
    expect(imageFileName('cable-jumper', 0)).toBe('cable-jumper-1.jpg');
    expect(naturalSort(['10.jpg', '2.jpg', '1.jpg'])).toEqual(['1.jpg', '2.jpg', '10.jpg']);
  });

  it('only re-hosts images from allow-listed supplier hosts (SSRF guard)', () => {
    expect(isAllowedImageUrl('https://ae01.alicdn.com/kf/x.jpg')).toBe(true);
    expect(isAllowedImageUrl('http://ae01.alicdn.com/kf/x.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedImageUrl('https://evil.example/x.jpg')).toBe(false);
    expect(descriptionImageUrls('<img src="//ae01.alicdn.com/a.jpg"><img src="https://localhost/b.jpg">')).toEqual(['https://ae01.alicdn.com/a.jpg']);
  });

  it('limits concurrency', async () => {
    let running = 0;
    let peak = 0;
    await pool([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async () => { running += 1; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running -= 1; });
    expect(peak).toBe(4);
  });
});
