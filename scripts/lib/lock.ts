/** Lock file so two runs of a data script never overlap (CI also uses a concurrency group). */
import fs from 'node:fs';
import path from 'node:path';

const LOCK = path.resolve('logs', '.ornis-script.lock-run');
const STALE_MS = 2 * 60 * 60 * 1000;

export function acquireLock(script: string): () => void {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  if (fs.existsSync(LOCK)) {
    const info = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    if (Date.now() - info.started < STALE_MS) {
      throw new Error(`Another script (${info.script}, pid ${info.pid}) has been running since ${new Date(info.started).toISOString()}. Wait for it to finish. If it crashed, delete ${LOCK}.`);
    }
  }
  fs.writeFileSync(LOCK, JSON.stringify({ script, pid: process.pid, started: Date.now() }));
  const release = () => { try { fs.unlinkSync(LOCK); } catch { /* already gone */ } };
  process.once('exit', release);
  return release;
}
