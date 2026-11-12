import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, CircuitOpenError, GraphQLError, ShopifyClient } from '../../scripts/lib/shopify.js';

const ok = (data: unknown, available = 1000) => new Response(JSON.stringify({ data, extensions: { cost: { throttleStatus: { maximumAvailable: 2000, currentlyAvailable: available, restoreRate: 100 } } } }), { status: 200 });

function client(responses: Array<Response | Error>) {
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const c = new ShopifyClient({ domain: 'test.myshopify.com', token: 'shpat_test', fetchImpl: fetchImpl as unknown as typeof fetch, sleep, maxRetries: 3 });
  return { c, fetchImpl, sleep };
}

describe('Shopify client', () => {
  it('retries throttled and 5xx responses with backoff, then succeeds', async () => {
    const { c, fetchImpl, sleep } = client([
      new Response('', { status: 503 }),
      new Response(JSON.stringify({ errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }] }), { status: 200 }),
      ok({ shop: { name: 'Ornis' } }),
    ]);
    await expect(c.request('{ shop { name } }')).resolves.toEqual({ shop: { name: 'Ornis' } });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('waits for query cost to restore before the next call', async () => {
    const { c, sleep } = client([ok({ a: 1 }, 10), ok({ b: 2 })]);
    await c.request('{ a }');
    await c.request('{ b }', {}, 210);
    expect(sleep).toHaveBeenCalledWith(2000 + 250);
  });

  it('does not retry GraphQL validation errors', async () => {
    const { c, fetchImpl } = client([new Response(JSON.stringify({ errors: [{ message: 'Field does not exist' }] }), { status: 200 })]);
    await expect(c.request('{ nope }')).rejects.toBeInstanceOf(GraphQLError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('opens the circuit after 5 consecutive failures', async () => {
    const errors = Array.from({ length: 5 }, () => new Response(JSON.stringify({ errors: [{ message: 'bad' }] }), { status: 200 }));
    const { c } = client(errors);
    for (let i = 0; i < 5; i += 1) await expect(c.request('{ x }')).rejects.toBeInstanceOf(GraphQLError);
    await expect(c.request('{ x }')).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('uses capped exponential backoff with jitter', () => {
    expect(backoffDelay(0, 500, 20000, () => 0)).toBe(250);
    expect(backoffDelay(0, 500, 20000, () => 1)).toBe(500);
    expect(backoffDelay(10, 500, 20000, () => 1)).toBe(20000);
  });
});
