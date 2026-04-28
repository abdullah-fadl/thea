/**
 * CVision Integrations — ZATCA Fatoora Client
 *
 * Saudi Arabia e-invoicing (Phase 2) integration:
 *   - Simplified tax invoices (B2C) — reported to ZATCA
 *   - Standard tax invoices (B2B) — cleared by ZATCA before delivery
 *   - QR code generation (TLV Tag-Length-Value per ZATCA spec)
 *   - Invoice submission (simulation)
 *   - VAT calculation helpers
 *
 * ⚡ SIMULATION MODE
 * Real ZATCA Phase 2 requires a CSID (Cryptographic Stamp Identifier),
 * digital certificate signing, and onboarding via the Fatoora Portal.
 * This module generates spec-conformant XML and QR codes for demo/testing.
 */

import { v4 as uuidv4 } from 'uuid';
import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZATCAAddress {
  street: string;
  buildingNumber: string;
  district: string;
  city: string;
  postalCode: string;
  country: 'SA';
}

export interface ZATCAParty {
  name: string;
  nameAr: string;
  vatNumber: string;
  crNumber: string;
  address: ZATCAAddress;
}

export interface ZATCALineItem {
  name: string;
  nameAr: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount?: number;
}

export type ZATCAPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export interface ZATCASimplifiedInvoiceParams {
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  seller: ZATCAParty;
  lineItems: ZATCALineItem[];
  paymentMethod: ZATCAPaymentMethod;
  notes?: string;
}

export interface ZATCAStandardInvoiceParams extends ZATCASimplifiedInvoiceParams {
  buyer: ZATCAParty;
}

export interface ZATCAInvoiceResult {
  invoiceXML: string;
  invoiceHash: string;
  qrCode: string;
  uuid: string;
  subtotal: number;
  vatAmount: number;
  totalWithVAT: number;
  lineCount: number;
  simulated: boolean;
}

export interface ZATCASubmissionResult {
  status: 'REPORTED' | 'CLEARED' | 'REJECTED';
  clearanceId?: string;
  reportingId?: string;
  warnings: string[];
  errors: string[];
  simulated: boolean;
}

export interface ZATCAVATResult {
  beforeVAT: number;
  vatAmount: number;
  afterVAT: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_MEANS_CODE: Record<ZATCAPaymentMethod, string> = {
  CASH: '10',
  CARD: '48',
  TRANSFER: '42',
  OTHER: '1',
};

/** Standard VAT rate in Saudi Arabia */
export const SAUDI_VAT_RATE = 15;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ZATCAClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'zatca' });
  }

  // ── Simplified Invoice (B2C) ──────────────────────────────────────

  async generateSimplifiedInvoice(
    params: ZATCASimplifiedInvoiceParams,
  ): Promise<ZATCAInvoiceResult> {
    const res = await this.request<ZATCAInvoiceResult>(
      'POST',
      '/api/v1/invoices/simplified',
      params,
    );
    return res.data;
  }

  // ── Standard Invoice (B2B) ────────────────────────────────────────

  async generateStandardInvoice(
    params: ZATCAStandardInvoiceParams,
  ): Promise<ZATCAInvoiceResult> {
    const res = await this.request<ZATCAInvoiceResult>(
      'POST',
      '/api/v1/invoices/standard',
      params,
    );
    return res.data;
  }

  // ── Submit Invoice ────────────────────────────────────────────────

  async submitInvoice(invoiceXML: string): Promise<ZATCASubmissionResult> {
    const res = await this.request<ZATCASubmissionResult>(
      'POST',
      '/api/v1/invoices/submit',
      { invoiceXML },
    );
    return res.data;
  }

  // ── Pure helpers (no network) ─────────────────────────────────────

  /**
   * Validate Saudi VAT number format.
   * 15 digits, starts with 3, ends with 3.
   */
  static validateVATNumber(vatNumber: string): boolean {
    const cleaned = vatNumber.replace(/\s/g, '');
    return /^3\d{13}3$/.test(cleaned);
  }

  /** Calculate VAT for an amount at the given rate (default 15%). */
  static calculateVAT(amount: number, rate: number = SAUDI_VAT_RATE): ZATCAVATResult {
    const vatAmount = round2(amount * (rate / 100));
    return { beforeVAT: round2(amount), vatAmount, afterVAT: round2(amount + vatAmount) };
  }

  /**
   * Build ZATCA TLV QR code data (Base64).
   *
   * ZATCA mandates five TLV tags for simplified invoices:
   *   Tag 1 — Seller name (UTF-8)
   *   Tag 2 — VAT registration number
   *   Tag 3 — Timestamp (ISO 8601)
   *   Tag 4 — Invoice total with VAT
   *   Tag 5 — VAT total
   */
  static generateQRCode(params: {
    sellerName: string;
    vatNumber: string;
    timestamp: string;
    totalWithVAT: number;
    vatAmount: number;
  }): string {
    return encodeTLV([
      { tag: 1, value: params.sellerName },
      { tag: 2, value: params.vatNumber },
      { tag: 3, value: params.timestamp },
      { tag: 4, value: params.totalWithVAT.toFixed(2) },
      { tag: 5, value: params.vatAmount.toFixed(2) },
    ]);
  }

  // ── Build full UBL 2.1 XML ────────────────────────────────────────

  static buildInvoiceXML(params: {
    uuid: string;
    invoiceNumber: string;
    issueDate: string;
    issueTime: string;
    invoiceTypeCode: string;
    invoiceTypeName: string;
    seller: ZATCAParty;
    buyer?: ZATCAParty;
    lineItems: ZATCALineItem[];
    paymentMethod: ZATCAPaymentMethod;
    notes?: string;
    qrCode: string;
  }): { xml: string; subtotal: number; vatAmount: number; totalWithVAT: number } {
    const {
      uuid, invoiceNumber, issueDate, issueTime,
      invoiceTypeCode, invoiceTypeName,
      seller, buyer, lineItems, paymentMethod, notes, qrCode,
    } = params;

    let subtotal = 0;
    let vatTotal = 0;

    const lineXmls = lineItems.map((item, idx) => {
      const discount = item.discountAmount || 0;
      const lineNet = round2(item.quantity * item.unitPrice - discount);
      const lineVat = round2(lineNet * (item.vatRate / 100));
      subtotal += lineNet;
      vatTotal += lineVat;

      const vatCategoryId = item.vatRate === 0 ? 'Z' : 'S';

      return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>${discount > 0 ? `
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:Amount currencyID="SAR">${discount.toFixed(2)}</cbc:Amount>
        <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
      </cac:AllowanceCharge>` : ''}
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${lineVat.toFixed(2)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${(lineNet + lineVat).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${esc(item.name)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${vatCategoryId}</cbc:ID>
          <cbc:Percent>${item.vatRate.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    });

    subtotal = round2(subtotal);
    vatTotal = round2(vatTotal);
    const total = round2(subtotal + vatTotal);

    const hasStdRate = lineItems.some(i => i.vatRate > 0);
    const hasZeroRate = lineItems.some(i => i.vatRate === 0);

    const taxSubtotals = [
      ...(hasStdRate ? [`
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="SAR">${subtotal.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="SAR">${vatTotal.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${SAUDI_VAT_RATE}.00</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`] : []),
      ...(hasZeroRate ? [`
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="SAR">0.00</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="SAR">0.00</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>Z</cbc:ID>
          <cbc:Percent>0.00</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`] : []),
    ].join('');

    const buyerBlock = buyer ? buildPartyXML(buyer, 'AccountingCustomerParty') : `
    <cac:AccountingCustomerParty>
      <cac:Party>
        <cac:PartyIdentification><cbc:ID schemeID="NAT">0000000000</cbc:ID></cac:PartyIdentification>
        <cac:PostalAddress>
          <cbc:StreetName>N/A</cbc:StreetName>
          <cbc:CityName>N/A</cbc:CityName>
          <cbc:PostalZone>00000</cbc:PostalZone>
          <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>
        <cac:PartyLegalEntity><cbc:RegistrationName>N/A</cbc:RegistrationName></cac:PartyLegalEntity>
      </cac:Party>
    </cac:AccountingCustomerParty>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <!-- Digital signature placeholder — requires CSID in production -->
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(invoiceNumber)}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${invoiceTypeName}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>${notes ? `
  <cbc:Note>${esc(notes)}</cbc:Note>` : ''}

  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrCode}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>

  ${buildPartyXML(seller, 'AccountingSupplierParty')}
  ${buyerBlock}

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${PAYMENT_MEANS_CODE[paymentMethod]}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${vatTotal.toFixed(2)}</cbc:TaxAmount>${taxSubtotals}
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${vatTotal.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">0.00</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="SAR">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lineXmls.join('')}
</Invoice>`;

    return { xml, subtotal, vatAmount: vatTotal, totalWithVAT: total };
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await delay();

    // ── Generate simplified invoice ──────────────────────────────
    if (path.includes('/simplified')) {
      return this.buildInvoiceResponse(data, false);
    }

    // ── Generate standard invoice ────────────────────────────────
    if (path.includes('/standard')) {
      return this.buildInvoiceResponse(data, true);
    }

    // ── Submit invoice ───────────────────────────────────────────
    if (path.includes('/submit')) {
      const ref = `ZATCA-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      return {
        status: 'REPORTED' as const,
        reportingId: ref,
        clearanceId: undefined,
        warnings: [],
        errors: [],
        simulated: true,
      } satisfies ZATCASubmissionResult;
    }

    return { success: true, simulated: true };
  }

  private buildInvoiceResponse(data: any, isStandard: boolean): ZATCAInvoiceResult {
    const p = data as (ZATCASimplifiedInvoiceParams & { buyer?: ZATCAParty });
    const uuid = uuidv4();
    const timestamp = `${p.issueDate}T${p.issueTime}`;

    // Pre-calculate totals so we can embed the QR inside the XML
    let preSubtotal = 0;
    let preVat = 0;
    for (const item of p.lineItems) {
      const discount = item.discountAmount || 0;
      const lineNet = round2(item.quantity * item.unitPrice - discount);
      preSubtotal += lineNet;
      preVat += round2(lineNet * (item.vatRate / 100));
    }
    preSubtotal = round2(preSubtotal);
    preVat = round2(preVat);
    const preTotal = round2(preSubtotal + preVat);

    const qrCode = ZATCAClient.generateQRCode({
      sellerName: p.seller.nameAr || p.seller.name,
      vatNumber: p.seller.vatNumber,
      timestamp,
      totalWithVAT: preTotal,
      vatAmount: preVat,
    });

    const { xml, subtotal, vatAmount, totalWithVAT } = ZATCAClient.buildInvoiceXML({
      uuid,
      invoiceNumber: p.invoiceNumber,
      issueDate: p.issueDate,
      issueTime: p.issueTime,
      invoiceTypeCode: '388',
      invoiceTypeName: isStandard ? '0100000' : '0200000',
      seller: p.seller,
      buyer: isStandard ? p.buyer : undefined,
      lineItems: p.lineItems,
      paymentMethod: p.paymentMethod,
      notes: p.notes,
      qrCode,
    });

    const invoiceHash = simpleHashSHA256(xml);

    return {
      invoiceXML: xml,
      invoiceHash,
      qrCode,
      uuid,
      subtotal,
      vatAmount,
      totalWithVAT,
      lineCount: p.lineItems.length,
      simulated: true,
    };
  }
}

// ---------------------------------------------------------------------------
// TLV QR Code encoder (ZATCA spec)
// ---------------------------------------------------------------------------

interface TLVTag {
  tag: number;
  value: string;
}

/**
 * Encode an array of TLV tags into a Base64 string per ZATCA specification.
 *
 * Each tag: [Tag number (1 byte)] [Length (1 byte)] [Value (UTF-8 bytes)]
 * The entire buffer is then Base64-encoded.
 */
function encodeTLV(tags: TLVTag[]): string {
  const parts: number[] = [];
  for (const { tag, value } of tags) {
    const valueBytes = new TextEncoder().encode(value);
    parts.push(tag);
    parts.push(valueBytes.length);
    for (let i = 0; i < valueBytes.length; i++) parts.push(valueBytes[i]);
  }
  const bytes = new Uint8Array(parts);
  return uint8ToBase64(bytes);
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// UBL XML helpers
// ---------------------------------------------------------------------------

function buildPartyXML(party: ZATCAParty, tag: string): string {
  const a = party.address;
  return `
    <cac:${tag}>
      <cac:Party>
        <cac:PartyIdentification>
          <cbc:ID schemeID="CRN">${esc(party.crNumber)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PostalAddress>
          <cbc:StreetName>${esc(a.street)}</cbc:StreetName>
          <cbc:BuildingNumber>${esc(a.buildingNumber)}</cbc:BuildingNumber>
          <cbc:CitySubdivisionName>${esc(a.district)}</cbc:CitySubdivisionName>
          <cbc:CityName>${esc(a.city)}</cbc:CityName>
          <cbc:PostalZone>${esc(a.postalCode)}</cbc:PostalZone>
          <cac:Country><cbc:IdentificationCode>${a.country}</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${esc(party.vatNumber)}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${esc(party.nameAr || party.name)}</cbc:RegistrationName>
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:${tag}>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Non-cryptographic hash for simulation. In production this would be
 * SHA-256 of the canonicalized XML. We produce a hex-like string for display.
 */
function simpleHashSHA256(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = ((h1 ^ input.charCodeAt(i)) * 0x01000193) >>> 0;
    h2 = ((h2 ^ input.charCodeAt(i)) * 0x811c9dc5) >>> 0;
  }
  const p1 = h1.toString(16).padStart(8, '0');
  const p2 = h2.toString(16).padStart(8, '0');
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p3}${p4}${p1.split('').reverse().join('')}${p2.split('').reverse().join('')}${p3.split('').reverse().join('')}${p4.split('').reverse().join('')}`;
}

function delay(): Promise<void> {
  return new Promise(r => setTimeout(r, 100 + Math.random() * 200));
}
