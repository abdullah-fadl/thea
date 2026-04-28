/**
 * Imdad Export Utilities
 *
 * Helpers for exporting SCM data as JSON or CSV.
 * Used by the /api/imdad/export/* routes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportColumn {
  key: string;
  header: string;
  transform?: (value: unknown) => string;
}

// ---------------------------------------------------------------------------
// Cell formatters
// ---------------------------------------------------------------------------

/** Format a date value for export cells. */
export function formatDateCell(value: unknown): string {
  if (!value) return '';
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return String(value ?? '');
  }
}

/** Format a decimal/number value for export cells. */
export function formatDecimalCell(value: unknown): string {
  if (value == null) return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toFixed(2);
}

// ---------------------------------------------------------------------------
// Export functions
// ---------------------------------------------------------------------------

/**
 * Export an array of records as a JSON string (pretty-printed).
 */
export function exportToJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * Export an array of records as a CSV string.
 * Uses the provided column definitions to control order, headers, and transforms.
 */
export function exportToCsv(rows: Record<string, unknown>[], columns: ExportColumn[]): string {
  const escapeCsv = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  // Header row
  const headerLine = columns.map((c) => escapeCsv(c.header)).join(',');

  // Data rows
  const dataLines = rows.map((row) => {
    return columns
      .map((col) => {
        const raw = row[col.key];
        const str = col.transform ? col.transform(raw) : String(raw ?? '');
        return escapeCsv(str);
      })
      .join(',');
  });

  // BOM for Excel UTF-8 compatibility
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}
