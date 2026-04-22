/* ── Export / Print Framework ──────────────────────────────────────── */

/**
 * Sanitize a single CSV cell value to prevent CSV formula injection
 * (also known as "CSV injection" or "formula injection").
 *
 * When a cell starts with =, +, -, @, \t, or \r an attacker can craft
 * a value that Excel / LibreOffice interprets as a formula, potentially
 * leading to data exfiltration or remote code execution via DDE.
 *
 * Mitigation: prepend a single-quote ' so the spreadsheet treats the
 * cell as a plain text literal rather than a formula.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Characters that trigger formula evaluation in common spreadsheet apps
  if (s.length > 0 && (s[0] === '=' || s[0] === '+' || s[0] === '-' || s[0] === '@' || s[0] === '\t' || s[0] === '\r')) {
    return "'" + s;
  }
  return s;
}

export interface ExportColumn {
  field: string;
  header: string;
  width?: number;
}

export interface ExportOptions {
  tenantId: string;
  module: string;
  format: 'EXCEL' | 'CSV' | 'PDF' | 'WORD';
  columns: ExportColumn[];
  data: any[];
  title?: string;
  filters?: string;
  includeLetterhead?: boolean;
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  companyName?: string;
}

export async function exportData(options: ExportOptions): Promise<Buffer> {
  switch (options.format) {
    case 'CSV':
      return exportCSV(options);
    case 'EXCEL':
      return exportExcel(options);
    case 'PDF':
      return exportPDF(options);
    case 'WORD':
      return exportWord(options);
    default:
      return exportCSV(options);
  }
}

/* ── CSV ───────────────────────────────────────────────────────────── */

function exportCSV(options: ExportOptions): Buffer {
  const headers = options.columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const rows = options.data.map(row =>
    options.columns.map(c => {
      const sanitized = sanitizeCsvCell(row[c.field]);
      const escaped = sanitized.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',')
  );
  const bom = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
  const csv = bom + [headers, ...rows].join('\n');
  return Buffer.from(csv, 'utf-8');
}

/* ── Excel (simple XML-based) ─────────────────────────────────────── */

function exportExcel(options: ExportOptions): Buffer {
  const headerRow = options.columns.map(c => `<c t="inlineStr"><is><t>${escXml(c.header)}</t></is></c>`).join('');

  const dataRows = options.data.map(row => {
    const cells = options.columns.map(c => {
      const val = row[c.field];
      if (val === null || val === undefined) return '<c t="inlineStr"><is><t></t></is></c>';
      if (typeof val === 'number') return `<c><v>${val}</v></c>`;
      return `<c t="inlineStr"><is><t>${escXml(String(val))}</t></is></c>`;
    }).join('');
    return `<row>${cells}</row>`;
  }).join('');

  let titleRows = '';
  let rowOffset = 0;
  if (options.includeLetterhead) {
    titleRows += `<row><c t="inlineStr"><is><t>${escXml(options.companyName || 'Company')}</t></is></c></row>`;
    titleRows += `<row><c t="inlineStr"><is><t>${escXml(options.title || 'Report')} — ${new Date().toLocaleDateString()}</t></is></c></row>`;
    if (options.filters) {
      titleRows += `<row><c t="inlineStr"><is><t>Filters: ${escXml(options.filters)}</t></is></c></row>`;
      rowOffset = 3;
    } else {
      rowOffset = 2;
    }
    titleRows += '<row/>';
    rowOffset++;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${titleRows}
<row>${headerRow}</row>
${dataRows}
</sheetData>
</worksheet>`;

  return Buffer.from(xml, 'utf-8');
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── PDF (HTML-based) ─────────────────────────────────────────────── */

function exportPDF(options: ExportOptions): Buffer {
  const html = generatePDFHtml(options);
  return Buffer.from(html, 'utf-8');
}

export function generatePDFHtml(options: ExportOptions): string {
  const headerCells = options.columns.map(c => `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left;font-size:12px;">${escXml(c.header)}</th>`).join('');

  const bodyRows = options.data.map(row => {
    const cells = options.columns.map(c => {
      const val = row[c.field];
      return `<td style="border:1px solid #ddd;padding:6px;font-size:11px;">${val !== null && val !== undefined ? escXml(String(val)) : ''}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  let header = '';
  if (options.includeLetterhead) {
    header = `
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="margin:0;font-size:20px;">${escXml(options.companyName || 'Company')}</h1>
        <h2 style="margin:5px 0;font-size:16px;color:#555;">${escXml(options.title || 'Report')}</h2>
        <p style="margin:0;font-size:11px;color:#888;">Generated: ${new Date().toLocaleString()}</p>
        ${options.filters ? `<p style="margin:5px 0 0;font-size:11px;color:#888;">Filters: ${escXml(options.filters)}</p>` : ''}
      </div>`;
  }

  return `<!DOCTYPE html>
<html dir="ltr">
<head><meta charset="UTF-8"><title>${escXml(options.title || 'Export')}</title></head>
<body style="font-family:Arial,sans-serif;margin:20px;">
${header}
<table style="width:100%;border-collapse:collapse;">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div style="text-align:center;margin-top:20px;font-size:10px;color:#aaa;">
  Page 1 — ${options.data.length} records — ${options.module}
</div>
</body></html>`;
}

/* ── Word (simple HTML-based DOCX alternative) ────────────────────── */

function exportWord(options: ExportOptions): Buffer {
  const html = generatePDFHtml(options);
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="UTF-8"><style>body{font-family:Arial;}</style></head>
<body>${html}</body></html>`;
  return Buffer.from(wordHtml, 'utf-8');
}

/* ── Batch Print Helper ───────────────────────────────────────────── */

export function generateBatchPrintHtml(documents: { title: string; content: string }[]): string {
  const pages = documents.map(doc => `
    <div style="page-break-after:always;padding:20px;">
      <h2>${escXml(doc.title)}</h2>
      <div>${doc.content}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Batch Print</title>
<style>@media print { .no-print { display:none; } }</style>
</head><body>${pages}</body></html>`;
}

/* ── Content-Type Helpers ─────────────────────────────────────────── */

export function getContentType(format: string): string {
  switch (format) {
    case 'EXCEL': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'CSV': return 'text/csv';
    case 'PDF': return 'text/html'; // HTML representation for PDF
    case 'WORD': return 'application/msword';
    default: return 'application/octet-stream';
  }
}

export function getFileExtension(format: string): string {
  switch (format) {
    case 'EXCEL': return 'xlsx';
    case 'CSV': return 'csv';
    case 'PDF': return 'html';
    case 'WORD': return 'doc';
    default: return 'bin';
  }
}
