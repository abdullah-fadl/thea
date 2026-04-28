/**
 * CVision Integrations — Saudi-Specific Helpers
 *
 * Utility functions shared across all integration modules:
 *   - IBAN bank code extraction & formatting
 *   - GOSI contribution calculation (Saudi vs non-Saudi)
 *   - Gregorian → Hijri (approximate) conversion
 */

import { SAUDI_BANKS, validateSaudiIBAN } from '@/lib/cvision/iban-validator';
import { GOSI_RATES } from '@/lib/cvision/gosi';

// ---------------------------------------------------------------------------
// IBAN helpers
// ---------------------------------------------------------------------------

/**
 * Extract the 2-digit bank code from a Saudi IBAN.
 * SA + 2 check digits + **2 bank code** + 18 account = 24 chars
 */
export function getBankCodeFromIBAN(iban: string): string {
  const cleaned = iban.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length < 6 || !cleaned.startsWith('SA')) return '';
  return cleaned.slice(4, 6);
}

/**
 * Resolve a human-readable bank name (English) from an IBAN.
 */
export function getBankNameFromIBAN(iban: string): string {
  const code = getBankCodeFromIBAN(iban);
  return SAUDI_BANKS[code]?.nameEn || 'Unknown Bank';
}

/**
 * Validate and format a Saudi IBAN with spaces every 4 characters.
 * Returns null if the IBAN is invalid.
 */
export function formatSaudiIBAN(iban: string): string | null {
  const result = validateSaudiIBAN(iban);
  return result.isValid ? result.formattedIBAN : null;
}

// ---------------------------------------------------------------------------
// GOSI contribution helpers (Saudi & non-Saudi)
// ---------------------------------------------------------------------------

/** GOSI rates — derived from canonical gosi.ts */
const GOSI_MAX_BASE = GOSI_RATES.MAX_SALARY;

const SAUDI_RATES = {
  employerAnnuity: GOSI_RATES.PENSION_RATE,  // 9% pension
  employeeAnnuity: GOSI_RATES.PENSION_RATE,  // 9% pension
  employerSaned: GOSI_RATES.SANED_RATE,      // 0.75% SANED unemployment
  employeeSaned: GOSI_RATES.SANED_RATE,      // 0.75% SANED unemployment
  hazard: GOSI_RATES.HAZARD_RATE,            // 2% (employer only)
};

const NON_SAUDI_RATES = {
  hazard: GOSI_RATES.HAZARD_RATE,            // 2% (employer only)
};

export interface GOSIContributionResult {
  contributionBase: number;
  employerContribution: number;
  employeeContribution: number;
  totalContribution: number;
  breakdown: {
    annuityEmployer: number;
    annuityEmployee: number;
    sanedEmployer: number;
    sanedEmployee: number;
    hazardEmployer: number;
  };
}

/**
 * Calculate monthly GOSI contributions.
 *
 * Base = basicSalary + housingAllowance, capped at SAR 45,000.
 * Saudi: employer 11.75% (pension 9% + SANED 0.75% + hazard 2%)
 *        employee 9.75% (pension 9% + SANED 0.75%)
 * Non-Saudi: employer 2% hazard only.
 */
export function calculateGOSIContribution(
  basicSalary: number,
  housingAllowance: number,
  isSaudi: boolean,
): GOSIContributionResult {
  const raw = basicSalary + housingAllowance;
  const base = Math.min(raw, GOSI_MAX_BASE);
  const round = (n: number) => Math.round(n * 100) / 100;

  if (isSaudi) {
    const annuityEmployer = round(base * SAUDI_RATES.employerAnnuity);
    const annuityEmployee = round(base * SAUDI_RATES.employeeAnnuity);
    const sanedEmployer = round(base * SAUDI_RATES.employerSaned);
    const sanedEmployee = round(base * SAUDI_RATES.employeeSaned);
    const hazardEmployer = round(base * SAUDI_RATES.hazard);
    return {
      contributionBase: base,
      employerContribution: annuityEmployer + sanedEmployer + hazardEmployer,
      employeeContribution: annuityEmployee + sanedEmployee,
      totalContribution: annuityEmployer + annuityEmployee + sanedEmployer + sanedEmployee + hazardEmployer,
      breakdown: { annuityEmployer, annuityEmployee, sanedEmployer, sanedEmployee, hazardEmployer },
    };
  }

  const hazardEmployer = round(base * NON_SAUDI_RATES.hazard);
  return {
    contributionBase: base,
    employerContribution: hazardEmployer,
    employeeContribution: 0,
    totalContribution: hazardEmployer,
    breakdown: { annuityEmployer: 0, annuityEmployee: 0, sanedEmployer: 0, sanedEmployee: 0, hazardEmployer },
  };
}

// ---------------------------------------------------------------------------
// Hijri date conversion (approximate Kuwaiti algorithm)
// ---------------------------------------------------------------------------

/**
 * Convert a Gregorian date to an approximate Hijri date string (dd/mm/yyyy).
 *
 * Uses the Kuwaiti/tabular algorithm — accurate to ±1-2 days.
 * For official purposes use Umm al-Qura calendar tables; this suffices for
 * display and file-generation contexts.
 */
export function formatHijriDate(date: Date): string {
  const { hy, hm, hd } = gregorianToHijri(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  const dd = String(hd).padStart(2, '0');
  const mm = String(hm).padStart(2, '0');
  return `${dd}/${mm}/${hy}`;
}

/**
 * Return Hijri year, month, day as numbers.
 */
export function gregorianToHijri(
  gy: number,
  gm: number,
  gd: number,
): { hy: number; hm: number; hd: number } {
  // Julian Day Number from Gregorian
  let jd: number;
  if (gm <= 2) { gy -= 1; gm += 12; }
  const A = Math.floor(gy / 100);
  const B = 2 - A + Math.floor(A / 4);
  jd = Math.floor(365.25 * (gy + 4716)) +
       Math.floor(30.6001 * (gm + 1)) +
       gd + B - 1524.5;

  // Hijri from Julian Day (Kuwaiti algorithm)
  const L = Math.floor(jd) - 1948440 + 10632;
  const N = Math.floor((L - 1) / 10631);
  const remainder = L - 10631 * N + 354;
  const J =
    Math.floor((10985 - remainder) / 5316) *
      Math.floor((50 * remainder) / 17719) +
    Math.floor(remainder / 5670) *
      Math.floor((43 * remainder) / 15238);
  const adjustedRemainder =
    remainder -
    Math.floor((30 - J) / 15) * Math.floor((17719 * J) / 50) -
    Math.floor(J / 16) * Math.floor((15238 * J) / 43) +
    29;
  const hm = Math.floor((24 * adjustedRemainder) / 709);
  const hd = adjustedRemainder - Math.floor((709 * hm) / 24);
  const hy = 30 * N + J - 30;

  return { hy, hm, hd };
}

// ---------------------------------------------------------------------------
// Misc formatting
// ---------------------------------------------------------------------------

/**
 * Format a number as SAR currency: "12,500.00"
 */
export function formatSAR(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Zero-pad a number to `width` digits.
 */
export function zeroPad(n: number | string, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * Format date as YYYY-MM-DD.
 */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
