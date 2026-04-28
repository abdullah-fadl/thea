/**
 * Imdad Print Template Generator
 *
 * Generates bilingual (Arabic/English) HTML documents for printing
 * SCM documents: purchase orders, GRNs, invoices, asset tags,
 * and inspection reports.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrintTemplateType =
  | 'purchase_order'
  | 'grn'
  | 'invoice'
  | 'asset_tag'
  | 'inspection_report';

export interface PrintLineItem {
  lineNumber: number;
  itemCode?: string;
  description?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface PrintDocumentData {
  documentNumber: string;
  date: string;
  status: string;
  vendorName?: string;
  vendorNameAr?: string;
  vendorCode?: string;
  vendorAddress?: string;
  vendorVat?: string;
  currency: string;
  lines: PrintLineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  paidAmount?: number;
  balanceDue?: number;
  paymentTerms?: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  notes?: string;
  preparedBy?: string;
  approvedBy?: string;
  poNumber?: string;
  grnNumber?: string;
  receivedBy?: string;
  verifiedBy?: string;
  // Asset tag fields
  assetTag?: string;
  assetName?: string;
  assetNameAr?: string;
  assetCategory?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  location?: string;
  department?: string;
  // Inspection fields
  inspectionNumber?: string;
  inspectionType?: string;
  referenceType?: string;
  referenceNumber?: string;
  sampleSize?: number;
  totalQuantity?: number;
  result?: string;
  inspectorName?: string;
}

// ---------------------------------------------------------------------------
// HTML Generation
// ---------------------------------------------------------------------------

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatCurrency(amount: number | undefined, currency: string): string {
  if (amount == null) return '-';
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function baseStyles(lang: string): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const fontFamily = lang === 'ar' ? "'Noto Naskh Arabic', 'Tahoma', sans-serif" : "'Segoe UI', Arial, sans-serif";
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { direction: ${dir}; font-family: ${fontFamily}; font-size: 12px; color: #333; padding: 20mm; }
      h1 { font-size: 18px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: ${lang === 'ar' ? 'right' : 'left'}; }
      th { background: #f5f5f5; font-weight: 600; }
      .header { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 2px solid #1a73e8; padding-bottom: 12px; }
      .label { font-weight: 600; color: #555; }
      .totals { margin-top: 12px; }
      .totals td { border: none; }
      .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: center; }
      @media print { body { padding: 10mm; } }
    </style>
  `;
}

function renderLinesTable(lines: PrintLineItem[], lang: string, currency: string): string {
  const th = lang === 'ar'
    ? ['#', '\u0627\u0644\u0648\u0635\u0641', '\u0627\u0644\u0643\u0645\u064a\u0629', '\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629', '\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a']
    : ['#', 'Description', 'Qty', 'Unit Price', 'Total'];

  let html = '<table><thead><tr>';
  for (const h of th) html += `<th>${h}</th>`;
  html += '</tr></thead><tbody>';

  for (const line of lines) {
    html += '<tr>';
    html += `<td>${line.lineNumber}</td>`;
    html += `<td>${escapeHtml(line.description || line.itemCode)}</td>`;
    html += `<td>${line.quantity}</td>`;
    html += `<td>${formatCurrency(line.unitPrice, currency)}</td>`;
    html += `<td>${formatCurrency(line.totalPrice, currency)}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function generatePurchaseOrderHtml(data: PrintDocumentData, lang: string): string {
  const title = lang === 'ar' ? '\u0623\u0645\u0631 \u0634\u0631\u0627\u0621' : 'Purchase Order';
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${title} ${escapeHtml(data.documentNumber)}</title>${baseStyles(lang)}</head><body>
    <div class="header"><div><h1>${title}</h1><div><span class="label">${lang === 'ar' ? '\u0631\u0642\u0645:' : 'Number:'}</span> ${escapeHtml(data.documentNumber)}</div></div><div><div><span class="label">${lang === 'ar' ? '\u0627\u0644\u062a\u0627\u0631\u064a\u062e:' : 'Date:'}</span> ${formatDate(data.date, lang)}</div><div><span class="label">${lang === 'ar' ? '\u0627\u0644\u062d\u0627\u0644\u0629:' : 'Status:'}</span> ${escapeHtml(data.status)}</div></div></div>
    <div><span class="label">${lang === 'ar' ? '\u0627\u0644\u0645\u0648\u0631\u062f:' : 'Vendor:'}</span> ${escapeHtml(lang === 'ar' ? data.vendorNameAr || data.vendorName : data.vendorName)}</div>
    ${renderLinesTable(data.lines, lang, data.currency)}
    <table class="totals"><tr><td></td><td class="label">${lang === 'ar' ? '\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0641\u0631\u0639\u064a:' : 'Subtotal:'}</td><td>${formatCurrency(data.subtotal, data.currency)}</td></tr><tr><td></td><td class="label">${lang === 'ar' ? '\u0627\u0644\u0636\u0631\u064a\u0628\u0629:' : 'Tax:'}</td><td>${formatCurrency(data.taxAmount, data.currency)}</td></tr><tr><td></td><td class="label" style="font-size:14px">${lang === 'ar' ? '\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a:' : 'Total:'}</td><td style="font-size:14px;font-weight:700">${formatCurrency(data.totalAmount, data.currency)}</td></tr></table>
    <div class="footer">Thea SCM &mdash; ${new Date().toISOString()}</div></body></html>`;
}

/**
 * Generate a printable HTML document for the given template type and data.
 */
export function generatePrintHtml(
  templateType: PrintTemplateType,
  data: PrintDocumentData,
  lang = 'en',
): string {
  // All template types share a similar structure; for now we reuse the PO template with type-specific titles
  const titleMap: Record<PrintTemplateType, Record<string, string>> = {
    purchase_order: { en: 'Purchase Order', ar: '\u0623\u0645\u0631 \u0634\u0631\u0627\u0621' },
    grn: { en: 'Goods Receiving Note', ar: '\u0645\u0630\u0643\u0631\u0629 \u0627\u0633\u062a\u0644\u0627\u0645 \u0628\u0636\u0627\u0626\u0639' },
    invoice: { en: 'Invoice', ar: '\u0641\u0627\u062a\u0648\u0631\u0629' },
    asset_tag: { en: 'Asset Tag', ar: '\u0628\u0637\u0627\u0642\u0629 \u0623\u0635\u0644' },
    inspection_report: { en: 'Inspection Report', ar: '\u062a\u0642\u0631\u064a\u0631 \u0641\u062d\u0635' },
  };

  if (templateType === 'asset_tag') {
    const title = titleMap.asset_tag[lang] || 'Asset Tag';
    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>${baseStyles(lang)}</head><body>
      <h1>${title}</h1>
      <table>
        <tr><td class="label">${lang === 'ar' ? '\u0631\u0642\u0645 \u0627\u0644\u0623\u0635\u0644:' : 'Asset Tag:'}</td><td>${escapeHtml(data.assetTag)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u0627\u0633\u0645:' : 'Name:'}</td><td>${escapeHtml(lang === 'ar' ? data.assetNameAr || data.assetName : data.assetName)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u0641\u0626\u0629:' : 'Category:'}</td><td>${escapeHtml(data.assetCategory)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062a\u0633\u0644\u0633\u0644\u064a:' : 'Serial:'}</td><td>${escapeHtml(data.serialNumber)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u0645\u0648\u0642\u0639:' : 'Location:'}</td><td>${escapeHtml(data.location)}</td></tr>
      </table>
      <div class="footer">Thea SCM &mdash; ${new Date().toISOString()}</div></body></html>`;
  }

  if (templateType === 'inspection_report') {
    const title = titleMap.inspection_report[lang] || 'Inspection Report';
    return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>${baseStyles(lang)}</head><body>
      <h1>${title}</h1>
      <table>
        <tr><td class="label">${lang === 'ar' ? '\u0631\u0642\u0645 \u0627\u0644\u0641\u062d\u0635:' : 'Inspection #:'}</td><td>${escapeHtml(data.inspectionNumber)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u0646\u0648\u0639:' : 'Type:'}</td><td>${escapeHtml(data.inspectionType)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u062a\u0627\u0631\u064a\u062e:' : 'Date:'}</td><td>${formatDate(data.date, lang)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u062d\u0627\u0644\u0629:' : 'Status:'}</td><td>${escapeHtml(data.status)}</td></tr>
        <tr><td class="label">${lang === 'ar' ? '\u0627\u0644\u0645\u0631\u062c\u0639:' : 'Reference:'}</td><td>${escapeHtml(data.referenceNumber)}</td></tr>
      </table>
      <div class="footer">Thea SCM &mdash; ${new Date().toISOString()}</div></body></html>`;
  }

  // Default: PO / GRN / Invoice all share the lines-based template
  const title = titleMap[templateType]?.[lang] || templateType;
  return generatePurchaseOrderHtml({ ...data }, lang).replace(
    /<h1>.*?<\/h1>/,
    `<h1>${title}</h1>`,
  );
}
