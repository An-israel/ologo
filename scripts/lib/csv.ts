import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export function readCsv(file: string): Record<string, string>[] {
  return parse(fs.readFileSync(file), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: false });
}

export function writeCsv(file: string, rows: Record<string, unknown>[], columns?: string[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  fs.writeFileSync(file, stringify(rows, { header: true, columns: cols }));
}
