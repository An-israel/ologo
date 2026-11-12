/**
 * Central configuration. Secrets come only from environment variables (never committed).
 *
 * Admin API version is pinned here and nowhere else.
 * 2026-10 is supported until at least October 2027. Check for a newer stable version every quarter
 * (January, April, July, October) and upgrade before 1 October 2027. See docs/RUNBOOK.md.
 */
export const ADMIN_API_VERSION = '2026-10';
export const API_VERSION_UPGRADE_BY = '2027-10-01';

/** Store schema version written to the shop metafield ornis.schema_version by setup-store. Bump with CHANGELOG. */
export const STORE_SCHEMA_VERSION = '2.0.0';

/** Only these hosts may be downloaded from when re-hosting supplier images (SSRF protection). */
export const IMAGE_HOST_ALLOWLIST = [
  'ae01.alicdn.com', 'ae02.alicdn.com', 'ae03.alicdn.com', 'ae04.alicdn.com', 'ae-pic-a1.aliexpress-media.com',
  'img.alicdn.com', 'cbu01.alicdn.com', 'cdn.shopify.com', 'img.cjdropshipping.com', 'cc-west-usa.oss-us-west-1.aliyuncs.com',
];

export const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_CONSECUTIVE_FAILURES = 5;
export const IMAGE_CONCURRENCY = 4;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Add it to the environment secrets (see .env.example). Never paste it into chat or commit it.`);
  }
  return value;
}

export function storeDomain(): string {
  const raw = requireEnv('SHOPIFY_STORE').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(raw)) {
    throw new Error(`SHOPIFY_STORE must look like your-store.myshopify.com (got "${raw}").`);
  }
  return raw;
}
