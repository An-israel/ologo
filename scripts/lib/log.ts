/**
 * JSON-lines logger. One file per run in logs/<script>-<runId>.jsonl.
 * Redacts anything that looks like a token, and never receives customer data (scripts only log ids and counts).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SECRET_PATTERN = /(shpat_|shpca_|shppa_|shpss_|ghp_|github_pat_)[A-Za-z0-9_]+/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SECRET_PATTERN, '[redacted-token]').replace(EMAIL_PATTERN, '[redacted-email]');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /token|password|secret|authorization/i.test(k) ? '[redacted]' : redact(v)]));
  }
  return value;
}

export class RunLog {
  readonly runId: string;
  readonly file: string;
  readonly script: string;
  private counts: Record<string, number> = {};

  constructor(script: string, dir = 'logs') {
    this.script = script;
    this.runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${script}-${this.runId}.jsonl`);
  }

  write(level: 'info' | 'warn' | 'error' | 'change', event: string, data: Record<string, unknown> = {}): void {
    this.counts[level] = (this.counts[level] ?? 0) + 1;
    const line = JSON.stringify(redact({ ts: new Date().toISOString(), runId: this.runId, script: this.script, level, event, ...data }));
    fs.appendFileSync(this.file, `${line}\n`);
  }

  info(event: string, data?: Record<string, unknown>) { this.write('info', event, data); }
  warn(event: string, data?: Record<string, unknown>) { this.write('warn', event, data); console.warn(`! ${event}`); }
  error(event: string, data?: Record<string, unknown>) { this.write('error', event, data); console.error(`x ${event}`); }

  /** Record a change with its before value so --revert can undo it. */
  change(entity: { type: string; id: string; handle?: string }, field: string, before: unknown, after: unknown, applied: boolean) {
    this.write('change', 'change', { entity, field, before, after, applied });
  }

  summary(): Record<string, number> { return { ...this.counts }; }
}

/** Read change records from a previous run log (for --revert). */
export function readChanges(file: string): Array<{ entity: { type: string; id: string; handle?: string }; field: string; before: unknown; after: unknown; applied: boolean }> {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.level === 'change' && r.applied);
}
