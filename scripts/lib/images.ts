/** Image helpers shared by normalise-products, prepare-images and import-products. */
import { IMAGE_HOST_ALLOWLIST } from './config.js';

/** True only for https URLs on an allow-listed supplier image host (SSRF guard, ENGINEERING item 80). */
export function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    return url.protocol === 'https:' && IMAGE_HOST_ALLOWLIST.includes(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Description <img> sources that may be re-hosted on Shopify. */
export function descriptionImageUrls(html: string): string[] {
  return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => (m[1].startsWith('//') ? `https:${m[1]}` : m[1]))
    .filter(isAllowedImageUrl);
}

/** Target canvas for every product image: 3:4, 2048 px on the long edge. */
export const TARGET = { width: 1536, height: 2048, maxBytes: 400 * 1024 };

/** File name for the nth image of a product: handle-1.jpg, handle-2.jpg ... */
export function imageFileName(handle: string, index: number, ext: 'jpg' | 'webp' = 'jpg'): string {
  return `${handle}-${index + 1}.${ext}`;
}

/** Natural sort so "img2.jpg" comes before "img10.jpg". */
export function naturalSort(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}
