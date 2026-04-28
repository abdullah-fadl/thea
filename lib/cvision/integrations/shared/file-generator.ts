/**
 * CVision Integrations — File Generator
 *
 * Generates export files for Saudi government and banking integrations:
 *   - SIF (Salary Information File) for bank salary transfers
 *   - WPS CSV for Mudad Wage Protection System
 *   - GOSI contributions CSV
 *   - ZATCA UBL 2.1 e-invoice XML (Fatoora Phase 2)
 */

import type { FileExport } from './types';
import {
  calculateGOSIContribution,
  formatSAR,
  formatHijriDate,
  zeroPad,
  isoDate,
  getBankCodeFromIBAN,
} from './helpers';

// ===========================================================================
// SIF — Saudi Bank Salary File
// ===========================================================================

export interface SIFEmployee {
  employeeId: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  iban: string;
  amount: number;
}

export interface SIFParams {
  companyCode: string;
  paymentDate: string;
  employees: SIFEmployee[];
  bankCode: string;
}

/**
 * Generate a SIF (Salary Information File) for Saudi bank salary transfers.
 *
 * Format follows the standard SAMA SIF spec used by Al Rajhi, SABB, SNB, etc.
 * Header row: HDR + company + bank + date + count + total
 * Detail rows: DTL + employee data
 * Trailer row: TRL + count + total
 */
export function generateSIF(params: SIFParams): FileExport {
  const { companyCode, paymentDate, employees, bankCode } = params;
  const dateClean = paymentDate.replace(/-/g, '');
  const totalAmount = employees.reduce((sum, e) => sum + e.amount, 0);
  const totalStr = totalAmount.toFixed(2).replace('.', '').padStart(15, '0');
  const countStr = zeroPad(employees.length, 6);

  const lines: string[] = [];

  // Header
  lines.push(
    `HDR${companyCode.padEnd(12, ' ')}${bankCode.padEnd(4, ' ')}${dateClean}${countStr}${totalStr}`,
  );

  // Detail records
  for (const emp of employees) {
    const ibanClean = emp.iban.replace(/[\s-]/g, '').toUpperCase();
    const empBankCode = getBankCodeFromIBAN(ibanClean) || bankCode;
    const amountStr = emp.amount.toFixed(2).replace('.', '').padStart(15, '0');
    lines.push(
      `DTL${emp.employeeId.padEnd(16, ' ')}${ibanClean.padEnd(24, ' ')}${amountStr}${empBankCode.padEnd(4, ' ')}${(emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee').slice(0, 40).padEnd(40, ' ')}`,
    );
  }

  // Trailer
  lines.push(`TRL${countStr}${totalStr}`);

  const content = lines.join('\r\n');

  return {
    filename: `SIF_${bankCode}_${dateClean}.sif`,
    format: 'SIF',
    content,
    mimeType: 'text/plain',
    recordCount: employees.length,
    generatedAt: new Date().toISOString(),
  };
}

// ===========================================================================
// WPS — Mudad Wage Protection CSV
// ===========================================================================

export interface WPSEmployee {
  nationalId: string;
  name: string;
  bank: string;
  iban: string;
  basicSalary: number;
  housing: number;
  other: number;
  deductions: number;
  netSalary: number;
}

export interface WPSParams {
  establishmentId: string;
  month: number;
  year: number;
  employees: WPSEmployee[];
}

/**
 * Generate a WPS-compliant CSV for the Mudad system.
 *
 * Column order follows the Mudad upload specification:
 * Establishment ID, Month, Year, National ID, Name, Bank Code, IBAN,
 * Basic Salary, Housing, Other Allowances, Deductions, Net Salary
 */
export function generateWPSFile(params: WPSParams): FileExport {
  const { establishmentId, month, year, employees } = params;

  const headers = [
    'EstablishmentID',
    'Month',
    'Year',
    'NationalID',
    'EmployeeName',
    'BankCode',
    'IBAN',
    'BasicSalary',
    'HousingAllowance',
    'OtherAllowances',
    'Deductions',
    'NetSalary',
  ];

  const rows = employees.map((e) => [
    establishmentId,
    zeroPad(month, 2),
    String(year),
    e.nationalId,
    csvEscape(e.name),
    e.bank,
    e.iban.replace(/[\s-]/g, ''),
    e.basicSalary.toFixed(2),
    e.housing.toFixed(2),
    e.other.toFixed(2),
    e.deductions.toFixed(2),
    e.netSalary.toFixed(2),
  ]);

  const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const monthStr = zeroPad(month, 2);

  return {
    filename: `WPS_${establishmentId}_${year}${monthStr}.csv`,
    format: 'CSV',
    content,
    mimeType: 'text/csv',
    recordCount: employees.length,
    generatedAt: new Date().toISOString(),
  };
}

// ===========================================================================
// GOSI — Contributions CSV
// ===========================================================================

export interface GOSIEmployee {
  nationalId: string;
  name: string;
  isSaudi: boolean;
  basicSalary: number;
  housing: number;
}

export interface GOSIParams {
  establishmentNumber: string;
  month: number;
  year: number;
  employees: GOSIEmployee[];
}

/**
 * Generate a GOSI contributions file for monthly submission.
 *
 * Automatically calculates employer + employee contributions using the
 * standard GOSI rates (Saudi: employer 11.75% + employee 9.75%, Non-Saudi: employer 2%).
 */
export function generateGOSIFile(params: GOSIParams): FileExport {
  const { establishmentNumber, month, year, employees } = params;

  const headers = [
    'EstablishmentNumber',
    'Month',
    'Year',
    'NationalID',
    'EmployeeName',
    'IsSaudi',
    'BasicSalary',
    'HousingAllowance',
    'ContributionBase',
    'EmployerContribution',
    'EmployeeContribution',
    'TotalContribution',
  ];

  const rows = employees.map((e) => {
    const gosi = calculateGOSIContribution(e.basicSalary, e.housing, e.isSaudi);
    return [
      establishmentNumber,
      zeroPad(month, 2),
      String(year),
      e.nationalId,
      csvEscape(e.name),
      e.isSaudi ? 'Y' : 'N',
      e.basicSalary.toFixed(2),
      e.housing.toFixed(2),
      gosi.contributionBase.toFixed(2),
      gosi.employerContribution.toFixed(2),
      gosi.employeeContribution.toFixed(2),
      gosi.totalContribution.toFixed(2),
    ];
  });

  const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const monthStr = zeroPad(month, 2);

  return {
    filename: `GOSI_${establishmentNumber}_${year}${monthStr}.csv`,
    format: 'CSV',
    content,
    mimeType: 'text/csv',
    recordCount: employees.length,
    generatedAt: new Date().toISOString(),
  };
}

// ===========================================================================
// ZATCA — E-Invoice XML (UBL 2.1, Fatoora Phase 2)
// ===========================================================================

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface InvoiceParty {
  name: string;
  vatNumber: string;
  address: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface InvoiceParams {
  invoiceNumber: string;
  issueDate: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lineItems: InvoiceLineItem[];
  currencyCode?: string;
}

/**
 * Generate a ZATCA-compliant UBL 2.1 e-invoice XML (simplified tax invoice).
 *
 * Follows the Fatoora Phase 2 specification published by ZATCA.
 * In production, the XML would be signed with the ZATCA CSID and
 * submitted to the Fatoora Portal; this generates the unsigned XML body.
 */
export function generateInvoiceXML(params: InvoiceParams): FileExport {
  const {
    invoiceNumber,
    issueDate,
    seller,
    buyer,
    lineItems,
    currencyCode = 'SAR',
  } = params;

  const now = new Date();
  const issueTime = `${zeroPad(now.getHours(), 2)}:${zeroPad(now.getMinutes(), 2)}:${zeroPad(now.getSeconds(), 2)}`;

  let totalExclVat = 0;
  let totalVat = 0;

  const lineXmlParts: string[] = lineItems.map((item, idx) => {
    const lineTotal = item.quantity * item.unitPrice;
    const lineVat = lineTotal * item.vatRate;
    totalExclVat += lineTotal;
    totalVat += lineVat;
    return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currencyCode}">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currencyCode}">${lineVat.toFixed(2)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="${currencyCode}">${(lineTotal + lineVat).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${xmlEscape(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${(item.vatRate * 100).toFixed(2)}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currencyCode}">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
  });

  const totalInclVat = totalExclVat + totalVat;
  const hijriDate = formatHijriDate(new Date(issueDate));

  const partyXml = (party: InvoiceParty, tagName: string) => `
    <cac:${tagName}>
      <cac:Party>
        <cac:PartyIdentification>
          <cbc:ID schemeID="VAT">${xmlEscape(party.vatNumber)}</cbc:ID>
        </cac:PartyIdentification>
        <cac:PostalAddress>
          <cbc:StreetName>${xmlEscape(party.address)}</cbc:StreetName>
          <cbc:CityName>${xmlEscape(party.city || 'Riyadh')}</cbc:CityName>
          <cbc:PostalZone>${xmlEscape(party.postalCode || '00000')}</cbc:PostalZone>
          <cac:Country><cbc:IdentificationCode>${party.countryCode || 'SA'}</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${xmlEscape(party.name)}</cbc:RegistrationName>
        </cac:PartyLegalEntity>
      </cac:Party>
    </cac:${tagName}>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(invoiceNumber)}</cbc:ID>
  <cbc:UUID>${crypto.randomUUID()}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currencyCode}</cbc:DocumentCurrencyCode>
  <cbc:Note>${hijriDate}</cbc:Note>
  ${partyXml(seller, 'AccountingSupplierParty')}
  ${partyXml(buyer, 'AccountingCustomerParty')}

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currencyCode}">${totalVat.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currencyCode}">${totalExclVat.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currencyCode}">${totalVat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currencyCode}">${totalExclVat.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currencyCode}">${totalExclVat.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currencyCode}">${totalInclVat.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currencyCode}">${totalInclVat.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineXmlParts.join('')}
</Invoice>`;

  return {
    filename: `INV_${invoiceNumber}_${issueDate}.xml`,
    format: 'XML',
    content: xml,
    mimeType: 'application/xml',
    recordCount: lineItems.length,
    generatedAt: new Date().toISOString(),
  };
}

// ===========================================================================
// Internal helpers
// ===========================================================================

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
