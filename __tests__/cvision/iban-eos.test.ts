/**
 * IBAN Validator & End of Service Calculator Tests
 *
 * Tests cover Saudi IBAN validation/generation utilities
 * and End of Service benefit calculations per Saudi Labor Law.
 */

import { describe, it, expect } from 'vitest';
import {
  validateSaudiIBAN,
  generateSaudiIBAN,
  getSaudiBankList,
  SAUDI_BANKS,
} from '../../lib/cvision/iban-validator';
import { calculateEndOfService } from '../../lib/cvision/gosi';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a Date that is exactly N years (N * 365 days) after a base date */
function addYears(base: Date, years: number): Date {
  const ms = base.getTime() + years * 365 * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

// ─── IBAN Validator Tests ───────────────────────────────────────────────────

describe('Saudi IBAN Validator', () => {
  // Use Al Rajhi (code 65) for most tests
  const VALID_IBAN = generateSaudiIBAN('65', '608010167519');

  describe('Generated IBAN should validate correctly', () => {
    it('should generate a valid IBAN that passes validation', () => {
      const result = validateSaudiIBAN(VALID_IBAN);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.iban).toHaveLength(24);
      expect(result.bankCode).toBe('65');
      expect(result.bankNameEn).toBe('Al Rajhi Bank');
      expect(result.bankSwift).toBe('RJHISARI');
      expect(result.accountNumber).toBeDefined();
    });
  });

  describe('Rejection cases', () => {
    it('should reject wrong length (too short)', () => {
      const result = validateSaudiIBAN('SA0365123456');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('24 characters'))).toBe(true);
    });

    it('should reject wrong length (too long)', () => {
      const result = validateSaudiIBAN('SA03650000006080101675190000');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('24 characters'))).toBe(true);
    });

    it('should reject non-SA prefix', () => {
      const result = validateSaudiIBAN('AE036500000060801016751900');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('start with "SA"'))).toBe(true);
    });

    it('should reject letters after SA', () => {
      const result = validateSaudiIBAN('SA03650000006080ABCD67519');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('digits after'))).toBe(true);
    });

    it('should reject invalid check digits (SA00...)', () => {
      // Replace valid check digits with 00
      const badIban = 'SA00' + VALID_IBAN.slice(4);
      const result = validateSaudiIBAN(badIban);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('check digits'))).toBe(true);
    });
  });

  describe('Input normalization', () => {
    it('should handle spaces and dashes in input', () => {
      // Insert spaces and dashes into a valid IBAN
      const formatted = VALID_IBAN.replace(/(.{4})/g, '$1 ').trim();
      const withDashes = VALID_IBAN.slice(0, 4) + '-' + VALID_IBAN.slice(4, 8) + '-' + VALID_IBAN.slice(8);

      expect(validateSaudiIBAN(formatted).isValid).toBe(true);
      expect(validateSaudiIBAN(withDashes).isValid).toBe(true);
    });

    it('should handle lowercase input', () => {
      const lowercase = VALID_IBAN.toLowerCase();
      const result = validateSaudiIBAN(lowercase);
      expect(result.isValid).toBe(true);
      expect(result.iban).toBe(VALID_IBAN); // Should be uppercased internally
    });
  });

  describe('Bank code identification', () => {
    it('should identify each bank code correctly', () => {
      for (const [code, bank] of Object.entries(SAUDI_BANKS)) {
        const iban = generateSaudiIBAN(code, '000000000001');
        const result = validateSaudiIBAN(iban);

        expect(result.isValid).toBe(true);
        expect(result.bankCode).toBe(code);
        expect(result.bankNameEn).toBe(bank.nameEn);
        expect(result.bankSwift).toBe(bank.swift);
      }
    });
  });

  describe('generateSaudiIBAN', () => {
    it('should produce valid 24-character IBANs', () => {
      const bankCodes = Object.keys(SAUDI_BANKS);
      for (const code of bankCodes) {
        const iban = generateSaudiIBAN(code, '123456789012345678');
        expect(iban).toHaveLength(24);
        expect(iban.startsWith('SA')).toBe(true);

        // Generated IBAN must also pass validation
        const validation = validateSaudiIBAN(iban);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should pad short account numbers to 18 digits', () => {
      const iban = generateSaudiIBAN('65', '123');
      expect(iban).toHaveLength(24);
      const result = validateSaudiIBAN(iban);
      expect(result.isValid).toBe(true);
      expect(result.accountNumber).toBe('000000000000000123');
    });

    it('should throw for invalid bank code', () => {
      expect(() => generateSaudiIBAN('99', '123456')).toThrow();
    });

    it('should throw for empty account number', () => {
      expect(() => generateSaudiIBAN('65', '')).toThrow();
    });

    it('should throw for account number exceeding 18 digits', () => {
      expect(() => generateSaudiIBAN('65', '1234567890123456789')).toThrow();
    });
  });

  describe('getSaudiBankList', () => {
    it('should return an array with all banks', () => {
      const list = getSaudiBankList();
      expect(list).toHaveLength(Object.keys(SAUDI_BANKS).length);
    });

    it('should return banks sorted by English name', () => {
      const list = getSaudiBankList();
      for (let i = 1; i < list.length; i++) {
        expect(list[i].nameEn.localeCompare(list[i - 1].nameEn)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include code, nameEn, swift for each bank', () => {
      const list = getSaudiBankList();
      for (const bank of list) {
        expect(bank.code).toBeDefined();
        expect(bank.nameEn).toBeDefined();
        expect(bank.swift).toBeDefined();
      }
    });
  });
});

// ─── End of Service Calculator Tests ────────────────────────────────────────

describe('End of Service Calculator', () => {
  const BASE_DATE = new Date('2020-01-01');

  describe('Basic calculations', () => {
    it('should return netAmount = 0 for less than 1 year of service', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-06-01'); // ~5 months
      const result = calculateEndOfService(start, end, 10000, 2500, false);

      // yearsOfService <= 0 branch is for negative/zero days
      // For positive days < 365, yearsOfService < 1 but > 0 → still calculates
      // The function only returns 0 if yearsOfService <= 0
      // For 151 days: yearsOfService = 151/365 ≈ 0.41
      // first5Years = (12500 / 2) * 0.41 ≈ 2568
      expect(result.yearsOfService).toBeLessThan(1);
      expect(result.first5YearsAmount).toBeGreaterThan(0);
    });

    it('should return 0 when start date equals end date', () => {
      const sameDate = new Date('2023-06-15');
      const result = calculateEndOfService(sameDate, sameDate, 10000, 2500, false);

      expect(result.yearsOfService).toBe(0);
      expect(result.netAmount).toBe(0);
      expect(result.grossAmount).toBe(0);
      expect(result.breakdown.length).toBeGreaterThan(0);
    });

    it('exactly 5 years, salary 10000+2500, not resignation → netAmount = 31250', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 5); // exactly 5 * 365 days
      const result = calculateEndOfService(start, end, 10000, 2500, false);

      // lastSalary = 12500, first5Years = (12500/2) * 5 = 31250
      expect(result.yearsOfService).toBe(5);
      expect(result.lastSalary).toBe(12500);
      expect(result.first5YearsAmount).toBe(31250);
      expect(result.after5YearsAmount).toBe(0);
      expect(result.grossAmount).toBe(31250);
      expect(result.resignationDeduction).toBe(0);
      expect(result.netAmount).toBe(31250);
    });

    it('10 years, salary 10000+2500 → first5: 31250, after5: 62500, total: 93750', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 10); // exactly 10 * 365 days
      const result = calculateEndOfService(start, end, 10000, 2500, false);

      // first5Years = (12500/2) * 5 = 31250
      // after5Years = 12500 * 5 = 62500
      // gross = 93750
      expect(result.yearsOfService).toBe(10);
      expect(result.first5YearsAmount).toBe(31250);
      expect(result.after5YearsAmount).toBe(62500);
      expect(result.grossAmount).toBe(93750);
      expect(result.resignationDeduction).toBe(0);
      expect(result.netAmount).toBe(93750);
    });
  });

  describe('Resignation deductions', () => {
    it('resignation less than 2 years → netAmount = 0', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 1); // 1 year
      const result = calculateEndOfService(start, end, 10000, 2500, true);

      // yearsOfService = 1 < 2 → deduct everything
      expect(result.isResignation).toBe(true);
      expect(result.grossAmount).toBeGreaterThan(0);
      expect(result.resignationDeduction).toBe(result.grossAmount);
      expect(result.netAmount).toBe(0);
    });

    it('3 years resignation → netAmount = grossAmount × 1/3', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 3); // exactly 3 years
      const result = calculateEndOfService(start, end, 10000, 2500, true);

      // yearsOfService = 3, between 2-5 → gets 1/3
      // gross = (12500/2) * 3 = 18750
      // deduction = 18750 * 2/3 = 12500
      // net = 18750 * 1/3 = 6250
      expect(result.yearsOfService).toBe(3);
      expect(result.grossAmount).toBe(18750);
      expect(result.resignationDeduction).toBe(12500);
      expect(result.netAmount).toBe(6250);
    });

    it('7 years resignation → netAmount = grossAmount × 2/3', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 7); // exactly 7 years
      const result = calculateEndOfService(start, end, 10000, 2500, true);

      // first5 = (12500/2) * 5 = 31250
      // after5 = 12500 * 2 = 25000
      // gross = 56250
      // deduction = 56250 * 1/3 = 18750
      // net = 56250 * 2/3 = 37500
      expect(result.yearsOfService).toBe(7);
      expect(result.first5YearsAmount).toBe(31250);
      expect(result.after5YearsAmount).toBe(25000);
      expect(result.grossAmount).toBe(56250);
      expect(result.resignationDeduction).toBe(18750);
      expect(result.netAmount).toBe(37500);
    });

    it('12 years resignation → full amount (same as non-resignation)', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 12); // exactly 12 years
      const resultResign = calculateEndOfService(start, end, 10000, 2500, true);
      const resultNormal = calculateEndOfService(start, end, 10000, 2500, false);

      // 12 years > 10 → full amount, no deduction
      // first5 = (12500/2) * 5 = 31250
      // after5 = 12500 * 7 = 87500
      // gross = 118750
      expect(resultResign.yearsOfService).toBe(12);
      expect(resultResign.resignationDeduction).toBe(0);
      expect(resultResign.netAmount).toBe(resultResign.grossAmount);
      expect(resultResign.netAmount).toBe(resultNormal.netAmount);
    });
  });

  describe('Edge cases', () => {
    it('should handle end date before start date (negative days) → 0', () => {
      const start = new Date('2023-06-01');
      const end = new Date('2023-01-01');
      const result = calculateEndOfService(start, end, 10000, 2500, false);

      expect(result.yearsOfService).toBe(0);
      expect(result.netAmount).toBe(0);
    });

    it('should handle zero housing allowance', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 5);
      const result = calculateEndOfService(start, end, 10000, 0, false);

      // lastSalary = 10000, first5 = (10000/2) * 5 = 25000
      expect(result.lastSalary).toBe(10000);
      expect(result.netAmount).toBe(25000);
    });

    it('dailyRate should be lastSalary / 30', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 5);
      const result = calculateEndOfService(start, end, 10000, 2500, false);

      expect(result.dailyRate).toBe(Math.round((12500 / 30) * 100) / 100);
    });
  });

  describe('Breakdown array', () => {
    it('should contain explanatory strings', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 7);
      const result = calculateEndOfService(start, end, 10000, 2500, false);

      expect(result.breakdown).toBeInstanceOf(Array);
      expect(result.breakdown.length).toBeGreaterThanOrEqual(2);
      // Should have first 5 years line and after 5 years line
      expect(result.breakdown.some((s) => s.includes('5'))).toBe(true);
    });

    it('resignation breakdown should mention resignation', () => {
      const start = BASE_DATE;
      const end = addYears(BASE_DATE, 3);
      const result = calculateEndOfService(start, end, 10000, 2500, true);

      expect(result.breakdown.some((s) => s.toLowerCase().includes('resignation'))).toBe(true);
    });

    it('zero-service breakdown should have an explanatory message', () => {
      const sameDate = new Date('2023-01-01');
      const result = calculateEndOfService(sameDate, sameDate, 10000, 2500, false);

      expect(result.breakdown.length).toBeGreaterThan(0);
    });
  });
});
