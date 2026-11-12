import type { RunLog } from './log.js';
import { assertNoUserErrors, type ShopifyClient } from './shopify.js';

export type RedirectResult = 'ok' | 'created' | 'updated' | 'would-create' | 'would-update';

/** Create or update one URL redirect, idempotently. */
export async function ensureRedirect(client: ShopifyClient, log: RunLog, apply: boolean, path: string, target: string): Promise<RedirectResult> {
  if (!path.startsWith('/')) throw new Error(`Redirect path must start with "/": ${path}`);
  const data = await client.request(`query($q: String!) { urlRedirects(first: 5, query: $q) { nodes { id path target } } }`, { q: `path:${path}` });
  const found = data.urlRedirects.nodes.find((n: { path: string }) => n.path === path);
  if (found?.target === target) return 'ok';
  log.change({ type: 'redirect', id: found?.id ?? path }, 'target', found?.target ?? null, target, apply);
  if (!apply) return found ? 'would-update' : 'would-create';
  if (found) {
    const res = await client.request(`mutation($id: ID!, $r: UrlRedirectInput!) { urlRedirectUpdate(id: $id, urlRedirect: $r) { userErrors { field message } } }`, { id: found.id, r: { path, target } });
    assertNoUserErrors(res.urlRedirectUpdate, `redirect ${path}`);
    return 'updated';
  }
  const res = await client.request(`mutation($r: UrlRedirectInput!) { urlRedirectCreate(urlRedirect: $r) { urlRedirect { id } userErrors { field message } } }`, { r: { path, target } });
  assertNoUserErrors(res.urlRedirectCreate, `redirect ${path}`);
  return 'created';
}
