/**
 * CVision Payroll Calculation Engine Tests
 * 
 * Tests for deterministic calculation logic
 */

import { describe, it, expect } from 'vitest';
import { calculatePayslip } from '@/lib/cvision/payroll/calc';
import type {
  CVisionPayrollProfile,
} from '@/lib/cvision/types';

describe('Payroll Calculation Engine', () => {
  const baseProfile: CVisionPayrollProfile = {
    id: 'test-profile-1',
    tenantId: 'test-tenant',
    employeeId: 'test-employee-1',
    baseSalary: 10000,
    allowancesJson: {
      housing: 5000,
      transport: 2000,
    },
    deductionsJson: {
      insurance: 500,
      tax: 1000,
    },
    isActive: true,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
    updatedBy: 'test-user',
  };

  describe('calculatePayslip', () => {
    it('should calculate gross correctly (base + allowances)', () => {
      const result = calculatePayslip(baseProfile);
      expect(result.gross).toBe(17000); // 10000 + 5000 + 2000
    });

    it('should calculate net correctly (gross - deductions)', () => {
      const result = calculatePayslip(baseProfile);
      expect(result.net).toBe(15500); // 17000 - 500 - 1000
    });

    it('should include loan deduction when loan is active', () => {
      // calculatePayslip reads loan.monthlyInstalment and checks loan.status === 'ACTIVE' (uppercase)
      const loan = {
        monthlyInstalment: 1000,
        status: 'ACTIVE',
      };

      const result = calculatePayslip(baseProfile, loan);
      expect(result.net).toBe(14500); // 17000 - 500 - 1000 - 1000 (loan)
      expect(result.breakdown.loanDeduction).toBe(1000);
    });

    it('should not deduct loan when loan status is not ACTIVE', () => {
      const loan = {
        monthlyInstalment: 1000,
        status: 'PAID_OFF',
      };

      const result = calculatePayslip(baseProfile, loan);
      expect(result.net).toBe(15500); // No loan deduction
      expect(result.breakdown.loanDeduction).toBeUndefined();
    });

    it('should return non-negative net pay', () => {
      const profileWithHighDeductions: CVisionPayrollProfile = {
        ...baseProfile,
        deductionsJson: {
          insurance: 5000,
          tax: 20000, // Exceeds gross
        },
      };

      const result = calculatePayslip(profileWithHighDeductions);
      expect(result.net).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty allowances and deductions', () => {
      const profile: CVisionPayrollProfile = {
        ...baseProfile,
        allowancesJson: {},
        deductionsJson: {},
      };

      const result = calculatePayslip(profile);
      expect(result.gross).toBe(10000); // Base salary only
      expect(result.net).toBe(10000);
      expect(result.breakdown.totalAllowances).toBe(0);
      expect(result.breakdown.totalDeductions).toBe(0);
    });

    it('should be deterministic (same inputs = same outputs)', () => {
      const result1 = calculatePayslip(baseProfile);
      const result2 = calculatePayslip(baseProfile);
      
      expect(result1.gross).toBe(result2.gross);
      expect(result1.net).toBe(result2.net);
      expect(result1.breakdown).toEqual(result2.breakdown);
    });

    it('should calculate breakdown correctly', () => {
      const result = calculatePayslip(baseProfile);
      
      expect(result.breakdown.baseSalary).toBe(10000);
      expect(result.breakdown.allowances).toEqual({
        housing: 5000,
        transport: 2000,
      });
      expect(result.breakdown.deductions).toEqual({
        insurance: 500,
        tax: 1000,
      });
      expect(result.breakdown.totalAllowances).toBe(7000);
      expect(result.breakdown.totalDeductions).toBe(1500);
    });
  });

  describe('profile validation (inline)', () => {
    it('should handle zero base salary', () => {
      const profile: CVisionPayrollProfile = {
        ...baseProfile,
        baseSalary: 0,
      };

      const result = calculatePayslip(profile);
      expect(result.gross).toBe(7000); // 0 + 5000 + 2000
    });

    it('should handle negative values by coercing to number', () => {
      const profile: CVisionPayrollProfile = {
        ...baseProfile,
        baseSalary: -1000,
      };

      const result = calculatePayslip(profile);
      // baseSalary = -1000, allowances = 7000, gross = 6000
      expect(result.gross).toBe(6000);
    });
  });
});
