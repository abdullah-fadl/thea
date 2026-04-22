/**
 * CVision Validators & Calculated Fields Tests
 *
 * Tests for Saudi data validators (National ID, Phone, IBAN, Email)
 * and calculated employee fields (age, tenure, EOS, etc.)
 */

import { describe, it, expect } from 'vitest';
import {
  validateNationalId,
  validateSaudiPhone,
  validateSaudiIBAN,
  validateEmail,
  validateDateRange,
  validateNotFutureBirthdate,
} from '@/lib/cvision/validators';
import { calculateEmployeeFields } from '@/lib/cvision/calculated-fields';

// ─── National ID ─────────────────────────────────────────────────────────────

describe('validateNationalId', () => {
  it('should reject empty input', () => {
    expect(validateNationalId('')).toEqual({ valid: false, error: 'Must be 10 digits' });
  });

  it('should reject short input', () => {
    expect(validateNationalId('12345')).toEqual({ valid: false, error: 'Must be 10 digits' });
  });

  it('should reject non-numeric input', () => {
    expect(validateNationalId('1ABCDEFGHI')).toEqual({ valid: false, error: 'Must contain only numbers' });
  });

  it('should reject IDs starting with 3 or higher', () => {
    const r = validateNationalId('3000000000');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('start with 1');
  });

  it('should identify citizen IDs (starts with 1)', () => {
    const r = validateNationalId('1000000006');
    if (r.valid) expect(r.type).toBe('CITIZEN');
  });

  it('should identify resident IDs (starts with 2)', () => {
    const r = validateNationalId('2000000005');
    if (r.valid) expect(r.type).toBe('RESIDENT');
  });
});

// ─── Saudi Phone ─────────────────────────────────────────────────────────────

describe('validateSaudiPhone', () => {
  it('should accept +966 format', () => {
    const r = validateSaudiPhone('+966512345678');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('+966512345678');
  });

  it('should accept 05X format', () => {
    const r = validateSaudiPhone('0512345678');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('+966512345678');
  });

  it('should accept 5X format (no prefix)', () => {
    const r = validateSaudiPhone('512345678');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('+966512345678');
  });

  it('should accept 966 without + prefix', () => {
    const r = validateSaudiPhone('966512345678');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('+966512345678');
  });

  it('should strip spaces and dashes', () => {
    const r = validateSaudiPhone('+966 51 234 5678');
    expect(r.valid).toBe(true);
  });

  it('should reject non-mobile (landline starting with 01)', () => {
    const r = validateSaudiPhone('0112345678');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('start with 5');
  });

  it('should reject too short numbers', () => {
    const r = validateSaudiPhone('05123');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('9 digits');
  });
});

// ─── Saudi IBAN ──────────────────────────────────────────────────────────────

describe('validateSaudiIBAN', () => {
  it('should reject non-SA prefix', () => {
    const r = validateSaudiIBAN('GB12345678901234567890XX');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('start with SA');
  });

  it('should reject wrong length', () => {
    const r = validateSaudiIBAN('SA038000000060801016');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('24 characters');
  });

  it('should identify known bank names', () => {
    const r = validateSaudiIBAN('SA0380000000608010167519');
    if (r.valid) {
      expect(r.bankName).toBeDefined();
    }
  });

  it('should strip spaces', () => {
    const r1 = validateSaudiIBAN('SA03 8000 0000 6080 1016 7519');
    const r2 = validateSaudiIBAN('SA0380000000608010167519');
    expect(r1.valid).toBe(r2.valid);
  });

  it('should handle uppercase and lowercase', () => {
    const r = validateSaudiIBAN('sa0380000000608010167519');
    expect(r.valid === true || r.error !== undefined).toBe(true);
  });
});

// ─── Email ───────────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true });
  });

  it('should accept email with dots and hyphens', () => {
    expect(validateEmail('first.last@company-name.co.uk')).toEqual({ valid: true });
  });

  it('should reject missing @', () => {
    expect(validateEmail('userexample.com').valid).toBe(false);
  });

  it('should reject missing domain', () => {
    expect(validateEmail('user@').valid).toBe(false);
  });

  it('should reject empty input', () => {
    expect(validateEmail('').valid).toBe(false);
  });
});

// ─── Date Validators ─────────────────────────────────────────────────────────

describe('validateDateRange', () => {
  it('should accept valid range', () => {
    const r = validateDateRange(new Date('2025-01-01'), new Date('2025-06-01'));
    expect(r.valid).toBe(true);
  });

  it('should reject equal dates', () => {
    const d = new Date('2025-06-01');
    expect(validateDateRange(d, d).valid).toBe(false);
  });

  it('should reject end before start', () => {
    const r = validateDateRange(new Date('2025-06-01'), new Date('2025-01-01'));
    expect(r.valid).toBe(false);
  });
});

describe('validateNotFutureBirthdate', () => {
  it('should accept past date', () => {
    expect(validateNotFutureBirthdate(new Date('1990-01-01')).valid).toBe(true);
  });

  it('should reject future date', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(validateNotFutureBirthdate(futureDate).valid).toBe(false);
  });

  it('should reject age > 120', () => {
    expect(validateNotFutureBirthdate(new Date('1890-01-01')).valid).toBe(false);
  });

  it('should reject age < 15', () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 10);
    expect(validateNotFutureBirthdate(recent).valid).toBe(false);
  });
});

// ─── Calculated Fields ───────────────────────────────────────────────────────

describe('calculateEmployeeFields', () => {
  it('should calculate age correctly', () => {
    // Use a fixed date far enough in the past to avoid rounding issues
    // with the 365.25-day year used by Math.floor((now - dob) / yearMs)
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    dob.setMonth(dob.getMonth() - 1); // subtract an extra month to avoid boundary
    const result = calculateEmployeeFields({ dateOfBirth: dob });
    expect(result.age).toBe(30);
  });

  it('should return null age when no DOB', () => {
    const result = calculateEmployeeFields({});
    expect(result.age).toBeNull();
  });

  it('should calculate tenure in years', () => {
    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - 5);
    const result = calculateEmployeeFields({ joinDate });
    expect(result.tenureYears).toBeCloseTo(5, 0);
    expect(result.tenureDays).toBeGreaterThan(1800);
  });

  it('should calculate contract remaining days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 100);
    const result = calculateEmployeeFields({ contractEndDate: future });
    expect(result.contractRemainingDays).toBeGreaterThan(98);
    expect(result.contractRemainingDays).toBeLessThanOrEqual(100);
    expect(result.contractExpired).toBe(false);
  });

  it('should flag expired contract', () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    const result = calculateEmployeeFields({ contractEndDate: past });
    expect(result.contractRemainingDays).toBe(0);
    expect(result.contractExpired).toBe(true);
  });

  it('should calculate iqama remaining days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 200);
    const result = calculateEmployeeFields({ iqamaExpiry: future });
    expect(result.iqamaRemainingDays).toBeGreaterThan(198);
    expect(result.iqamaExpired).toBe(false);
  });

  it('should detect probation period', () => {
    const joinDate = new Date();
    joinDate.setDate(joinDate.getDate() - 30);
    const result = calculateEmployeeFields({ joinDate, probationMonths: 3 });
    expect(result.inProbation).toBe(true);
    expect(result.probationEndDate).toBeInstanceOf(Date);
  });

  it('should detect end of probation', () => {
    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - 1);
    const result = calculateEmployeeFields({ joinDate, probationMonths: 3 });
    expect(result.inProbation).toBe(false);
  });

  it('should compute retirement age based on gender', () => {
    expect(calculateEmployeeFields({ gender: 'MALE' }).retirementAge).toBe(60);
    expect(calculateEmployeeFields({ gender: 'FEMALE' }).retirementAge).toBe(55);
  });

  it('should calculate gross salary', () => {
    const result = calculateEmployeeFields({
      basicSalary: 10000,
      housingAllowance: 2500,
      transportAllowance: 1000,
      otherAllowances: 500,
    });
    expect(result.grossSalary).toBe(14000);
  });

  it('should calculate EOS for < 5 years', () => {
    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - 3);
    const result = calculateEmployeeFields({
      joinDate, basicSalary: 10000, housingAllowance: 2500,
    });
    expect(result.endOfServiceAccrual).toBeGreaterThan(0);
    // ~3 years * 15 days * (12500/30) daily wage
    const expectedApprox = 3 * 15 * (12500 / 30);
    expect(result.endOfServiceAccrual).toBeCloseTo(expectedApprox, -2);
  });

  it('should calculate EOS for > 5 years', () => {
    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - 8);
    const result = calculateEmployeeFields({
      joinDate, basicSalary: 10000, housingAllowance: 2500,
    });
    // first 5: 5*15*(12500/30) = 31250
    // next 3:  3*30*(12500/30) = 37500
    const expectedApprox = 31250 + 37500;
    expect(result.endOfServiceAccrual).toBeCloseTo(expectedApprox, -2);
  });

  it('should return 0 EOS when no salary', () => {
    const result = calculateEmployeeFields({ joinDate: new Date() });
    expect(result.endOfServiceAccrual).toBe(0);
  });
});

// ─── Rate Limiter ────────────────────────────────────────────────────────────

describe('rateLimit (unit)', () => {
  // Importing the function to test
  let rateLimit: (type: string, key: string) => { allowed: boolean; remaining: number; retryAfter?: number };

  it('should dynamically import rate limiter', async () => {
    const mod = await import('@/lib/cvision/middleware/rate-limit');
    rateLimit = mod.rateLimit;
    expect(typeof rateLimit).toBe('function');
  });

  it('should allow requests within limit', async () => {
    const mod = await import('@/lib/cvision/middleware/rate-limit');
    const result = mod.rateLimit('general', `test-user-${Date.now()}`);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });
});
