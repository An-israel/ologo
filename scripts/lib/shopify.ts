/**
 * Shopify Admin GraphQL client with the production safeguards from docs/ENGINEERING.md:
 * - 30 s timeout on every call (item 11)
 * - retries with exponential backoff and jitter on throttling, network errors and 5xx (items 12, 13)
 * - reads the cost-based throttle status and waits before hitting the limit (item 1, 44)
 * - circuit breaker: stops after 5 consecutive failures so the operator can re-run later (item 10)
 */
import { ADMIN_API_VERSION, MAX_CONSECUTIVE_FAILURES, REQUEST_TIMEOUT_MS, requireEnv, storeDomain } from './config.js';
import type { RunLog } from './log.js';

export class CircuitOpenError extends Error {
  constructor(message: string) { super(message); this.name = 'CircuitOpenError'; }
}

export class GraphQLError extends Error {
  constructor(message: string, readonly details: unknown) { super(message); this.name = 'GraphQLError'; }
}

interface ThrottleStatus { maximumAvailable: number; currentlyAvailable: number; restoreRate: number }

export interface ClientOptions {
  log?: RunLog;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  domain?: string;
  token?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function backoffDelay(attempt: number, base = 500, cap = 20_000, random = Math.random): number {
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.round(exp / 2 + random() * (exp / 2)); // "equal jitter"
}

export class ShopifyClient {
  private failures = 0;
  private throttle: ThrottleStatus | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly endpoint: string;
  private readonly token: string;
  readonly log?: RunLog;

  constructor(opts: ClientOptions = {}) {
    const domain = opts.domain ?? storeDomain();
    this.token = opts.token ?? requireEnv('SHOPIFY_ADMIN_TOKEN');
    this.endpoint = `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? defaultSleep;
    this.maxRetries = opts.maxRetries ?? 5;
    this.log = opts.log;
  }

  /** Wait until enough query cost is available, based on the last throttle status Shopify returned. */
  private async respectThrottle(expectedCost: number) {
    if (!this.throttle) return;
    const { currentlyAvailable, restoreRate } = this.throttle;
    if (currentlyAvailable >= expectedCost) return;
    const waitMs = Math.ceil(((expectedCost - currentlyAvailable) / Math.max(restoreRate, 1)) * 1000) + 250;
    this.log?.info('throttle.wait', { waitMs, currentlyAvailable, expectedCost });
    await this.sleep(waitMs);
  }

  async request<T = any>(query: string, variables: Record<string, unknown> = {}, expectedCost = 50): Promise<T> {
    if (this.failures >= MAX_CONSECUTIVE_FAILURES) {
      throw new CircuitOpenError(`Stopped after ${MAX_CONSECUTIVE_FAILURES} failed API calls in a row. Progress is saved; re-run the same command later.`);
    }
    await this.respectThrottle(expectedCost);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let retryable = false;
      let lastError: unknown;
      try {
        const res = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': this.token },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });
        if (res.status === 429 || res.status >= 500) {
          retryable = true;
          lastError = new Error(`HTTP ${res.status}`);
        } else if (!res.ok) {
          throw new GraphQLError(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, null);
        } else {
          const body: any = await res.json();
          const status = body?.extensions?.cost?.throttleStatus;
          if (status) this.throttle = status;
          const throttled = body.errors?.some((e: any) => e?.extensions?.code === 'THROTTLED');
          if (throttled) {
            retryable = true;
            lastError = new Error('THROTTLED');
          } else if (body.errors?.length) {
            throw new GraphQLError(body.errors.map((e: any) => e.message).join('; '), body.errors);
          } else {
            this.failures = 0;
            return body.data as T;
          }
        }
      } catch (error) {
        if (error instanceof GraphQLError) { this.failures += 1; throw error; }
        retryable = true; // network error or timeout
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
      if (retryable && attempt < this.maxRetries) {
        const delay = backoffDelay(attempt);
        this.log?.warn('api.retry', { attempt: attempt + 1, delay, reason: String((lastError as Error)?.message ?? lastError) });
        await this.sleep(delay);
        continue;
      }
      this.failures += 1;
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    throw new Error('unreachable');
  }

  /** Iterate a paginated connection. `path` points at the connection in the response, e.g. ['products']. */
  async *paginate<T>(query: string, path: string[], variables: Record<string, unknown> = {}, expectedCost = 200): AsyncGenerator<T> {
    let after: string | null = null;
    do {
      const data: any = await this.request(query, { ...variables, after }, expectedCost);
      const connection = path.reduce((acc: any, key) => acc?.[key], data);
      for (const edge of connection.edges ?? []) yield (edge.node ?? edge) as T;
      if (!connection.edges && connection.nodes) for (const node of connection.nodes) yield node as T;
      after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
    } while (after);
  }
}

/** Throw a readable error when a mutation returns userErrors. */
export function assertNoUserErrors(result: { userErrors?: Array<{ field?: string[] | null; message: string }> } | undefined, context: string) {
  const errors = result?.userErrors ?? [];
  if (errors.length) throw new GraphQLError(`${context}: ${errors.map((e) => `${(e.field ?? []).join('.')} ${e.message}`.trim()).join('; ')}`, errors);
}
