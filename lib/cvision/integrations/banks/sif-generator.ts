/**
 * CVision Integrations — Bank SIF (Salary Information File) Generator
 *
 * Generates bank-specific salary transfer files for all major Saudi banks.
 * Each bank has a slightly different SIF dialect; this module normalises
 * the interface and dispatches to the correct formatter.
 *
 * Supported banks:
 *   RAJHI  (Al Rajhi Bank – 65)     SNB (Saudi National Bank – 10)
 *   RIYAD  (Riyad Bank – 20)        SABB (Saudi British Bank – 45)
 *   BILAD  (Bank AlBilad – 15)      ALINMA (Alinma Bank – 76)
 *   JAZIRA (Bank AlJazira – 50)     ANB (Arab National Bank – 55)
 *   GENERIC (fallback SAMA-like format)
 */

import { SAUDI_BANKS } from '@/lib/cvision/iban-validator';
import type { FileExport } from '../shared/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SIFBankCode =
  | 'RAJHI' | 'SNB' | 'RIYAD' | 'SABB'
  | 'BILAD' | 'ALINMA' | 'JAZIRA' | 'ANB'
  | 'GENERIC';

export interface SIFEmployee {
  employeeId: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  iban: string;
  netSalary: number;
  nationality?: string;
}

export interface SIFParams {
  bank: SIFBankCode;
  companyMOLNumber: string;
  companyName: string;
  paymentDate: Date;
  employees: SIFEmployee[];
}

export interface SIFResult extends FileExport {
  bankCode: SIFBankCode;
  totalAmount: number;
  skippedEmployees: { employeeId: string; name: string; reason: string }[];
}

// IBAN bank-digit → friendly code
const IBAN_TO_BANK: Record<string, SIFBankCode> = {
  '65': 'RAJHI',
  '10': 'SNB',
  '20': 'RIYAD',
  '45': 'SABB',
  '15': 'BILAD',
  '76': 'ALINMA',
  '50': 'JAZIRA',
  '55': 'ANB',
};

// Friendly code → IBAN 2-digit prefix (inside SA)
const BANK_IBAN_PREFIX: Record<SIFBankCode, string> = {
  RAJHI: '65', SNB: '10', RIYAD: '20', SABB: '45',
  BILAD: '15', ALINMA: '76', JAZIRA: '50', ANB: '55',
  GENERIC: '',
};

export const BANK_LABELS: Record<SIFBankCode, { nameEn: string }> = {
  RAJHI:   { nameEn: 'Al Rajhi Bank' },
  SNB:     { nameEn: 'Saudi National Bank' },
  RIYAD:   { nameEn: 'Riyad Bank' },
  SABB:    { nameEn: 'SABB' },
  BILAD:   { nameEn: 'Bank AlBilad' },
  ALINMA:  { nameEn: 'Alinma Bank' },
  JAZIRA:  { nameEn: 'Bank AlJazira' },
  ANB:     { nameEn: 'Arab National Bank' },
  GENERIC: { nameEn: 'Generic SIF' },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Auto-detect bank from IBAN (positions 4-5 after "SA").
 */
export function detectBankFromIBAN(iban: string): SIFBankCode {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length >= 6 && cleaned.startsWith('SA')) {
    const digits = cleaned.slice(4, 6);
    return IBAN_TO_BANK[digits] || 'GENERIC';
  }
  return 'GENERIC';
}

/**
 * Validate a Saudi IBAN for SIF purposes (quick check).
 */
export function validateIBANForSIF(iban: string): { valid: boolean; bankCode: string; bankName: string; error?: string } {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== 24) return { valid: false, bankCode: '', bankName: '', error: 'IBAN must be 24 characters' };
  if (!cleaned.startsWith('SA')) return { valid: false, bankCode: '', bankName: '', error: 'Saudi IBAN must start with SA' };
  if (!/^SA\d{22}$/.test(cleaned)) return { valid: false, bankCode: '', bankName: '', error: 'Invalid IBAN format' };
  const bankDigits = cleaned.slice(4, 6);
  const bank = SAUDI_BANKS[bankDigits];
  return { valid: true, bankCode: bankDigits, bankName: bank?.nameEn || 'Unknown Bank' };
}

/**
 * Generate a SIF file for the specified bank.
 *
 * Employees whose IBAN is missing or invalid are listed in `skippedEmployees`.
 */
export function generateSIFFile(params: SIFParams): SIFResult {
  const { bank, employees } = params;
  const skipped: SIFResult['skippedEmployees'] = [];

  const validEmployees = employees.filter((emp) => {
    if (!emp.iban || emp.iban.trim().length === 0) {
      skipped.push({ employeeId: emp.employeeId, name: (emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'), reason: 'Missing IBAN' });
      return false;
    }
    const check = validateIBANForSIF(emp.iban);
    if (!check.valid) {
      skipped.push({ employeeId: emp.employeeId, name: (emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'), reason: check.error || 'Invalid IBAN' });
      return false;
    }
    if (emp.netSalary <= 0) {
      skipped.push({ employeeId: emp.employeeId, name: (emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee'), reason: 'Zero or negative salary' });
      return false;
    }
    return true;
  });

  const totalAmount = validEmployees.reduce((s, e) => s + e.netSalary, 0);

  let content: string;
  switch (bank) {
    case 'RAJHI':
      content = formatRajhi(params, validEmployees);
      break;
    case 'SNB':
      content = formatSNB(params, validEmployees);
      break;
    default:
      content = formatGeneric(params, validEmployees);
      break;
  }

  const dateStr = fmtDate(params.paymentDate);

  return {
    filename: `SIF_${bank}_${dateStr}.sif`,
    format: 'SIF',
    content,
    mimeType: 'text/plain',
    recordCount: validEmployees.length,
    generatedAt: new Date().toISOString(),
    bankCode: bank,
    totalAmount: round2(totalAmount),
    skippedEmployees: skipped,
  };
}

// ---------------------------------------------------------------------------
// Bank-specific formatters
// ---------------------------------------------------------------------------

/** Al Rajhi Bank format */
function formatRajhi(p: SIFParams, emps: SIFEmployee[]): string {
  const date = fmtDate(p.paymentDate);
  const total = round2(emps.reduce((s, e) => s + e.netSalary, 0));
  const lines: string[] = [];

  lines.push(`HDR,SALARY,${p.companyMOLNumber},${date},${emps.length},${total.toFixed(2)}`);

  emps.forEach((emp, idx) => {
    const iban = emp.iban.replace(/[\s-]/g, '').toUpperCase();
    lines.push(
      `DTL,${idx + 1},${emp.employeeId},${csvSafe(emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee')},${iban},${emp.netSalary.toFixed(2)},Monthly Salary`,
    );
  });

  lines.push(`TRL,${emps.length},${total.toFixed(2)}`);
  return lines.join('\r\n');
}

/** Saudi National Bank (SNB/Al Ahli) format */
function formatSNB(p: SIFParams, emps: SIFEmployee[]): string {
  const date = fmtDate(p.paymentDate);
  const total = round2(emps.reduce((s, e) => s + e.netSalary, 0));
  const lines: string[] = [];

  lines.push(
    `H,${p.companyMOLNumber},${date},${total.toFixed(2)},${emps.length},${csvSafe(p.companyName)},SNB`,
  );

  for (const emp of emps) {
    const iban = emp.iban.replace(/[\s-]/g, '').toUpperCase();
    const bankDigits = iban.slice(4, 6);
    lines.push(
      `D,${emp.employeeId},${csvSafe(emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee')},${iban},${emp.netSalary.toFixed(2)},${bankDigits},${emp.nationality || 'SA'}`,
    );
  }

  const hash = simpleHash(lines.join(''));
  lines.push(`T,${emps.length},${total.toFixed(2)},${hash}`);
  return lines.join('\r\n');
}

/** Generic SAMA-like format (works for RIYAD, SABB, BILAD, ALINMA, JAZIRA, ANB) */
function formatGeneric(p: SIFParams, emps: SIFEmployee[]): string {
  const date = fmtDate(p.paymentDate);
  const total = round2(emps.reduce((s, e) => s + e.netSalary, 0));
  const bankLabel = BANK_LABELS[p.bank]?.nameEn || 'Unknown';
  const lines: string[] = [];

  lines.push(
    `H,${p.companyMOLNumber},${date},${total.toFixed(2)},${emps.length},${csvSafe(p.companyName)},${bankLabel}`,
  );

  for (const emp of emps) {
    const iban = emp.iban.replace(/[\s-]/g, '').toUpperCase();
    const bankDigits = iban.slice(4, 6);
    lines.push(
      `D,${emp.employeeId},${csvSafe(emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee')},${iban},${emp.netSalary.toFixed(2)},${bankDigits},${emp.nationality || 'SA'}`,
    );
  }

  const hash = simpleHash(lines.join(''));
  lines.push(`T,${emps.length},${total.toFixed(2)},${hash}`);
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function csvSafe(s: string): string {
  const cleaned = s.replace(/,/g, ' ').replace(/"/g, "'").replace(/\r?\n/g, ' ');
  return cleaned.slice(0, 60);
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
}
