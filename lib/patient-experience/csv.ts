/**
 * Minimal CSV serializer for the Patient Experience reports export.
 *
 * RFC 4180-ish: quotes wrap fields, embedded quotes are doubled, CRLF rows.
 */

export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function escapeCell(value: unknown): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from a list of rows. Headers default to the union of
 * keys from the first row; pass `headers` to enforce column order.
 */
export function rowsToCsv(rows: readonly CsvRow[], headers?: readonly string[]): string {
  const cols = headers ?? (rows.length > 0 ? Object.keys(rows[0]!) : []);
  const out: string[] = [];
  out.push(cols.map(escapeCell).join(','));
  for (const row of rows) {
    out.push(cols.map((c) => escapeCell(row[c])).join(','));
  }
  return out.join('\r\n');
}
