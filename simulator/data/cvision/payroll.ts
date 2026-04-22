/**
 * CVision Payroll Data Generator
 * Saudi labor law compliant salary structures.
 */

export interface SalaryStructure {
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  grossSalary: number;
}

import { GOSI_RATES as _CANONICAL_GOSI } from '@/lib/cvision/gosi';

export interface GosiRates {
  employeeRate: number;
  employerRate: number;
  contributionCap: number;
}

/** Saudi GOSI contribution rates — derived from canonical gosi.ts */
export const GOSI_RATES: GosiRates = {
  employeeRate: _CANONICAL_GOSI.EMPLOYEE_RATE,   // 9.75%
  employerRate: _CANONICAL_GOSI.EMPLOYER_RATE,    // 11.75%
  contributionCap: _CANONICAL_GOSI.MAX_SALARY,    // 45,000 SAR max contribution base
};

export class CVisionPayrollGenerator {
  /** Generate salary structure for a given base salary */
  generateSalaryStructure(baseSalary: number): SalaryStructure {
    const housingAllowance = Math.round(baseSalary * 0.25);
    const transportAllowance = Math.round(baseSalary * 0.10);
    const otherAllowances = Math.round(baseSalary * (Math.random() * 0.05));
    return {
      baseSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      grossSalary: baseSalary + housingAllowance + transportAllowance + otherAllowances,
    };
  }

  /** Calculate GOSI contributions */
  calculateGosi(baseSalary: number, housingAllowance: number) {
    const gosiBase = Math.min(baseSalary + housingAllowance, GOSI_RATES.contributionCap);
    return {
      employeeContribution: Math.round(gosiBase * GOSI_RATES.employeeRate),
      employerContribution: Math.round(gosiBase * GOSI_RATES.employerRate),
      gosiBase,
    };
  }

  /** Calculate End of Service (EOS) per Saudi labor law */
  calculateEOS(baseSalary: number, tenureYears: number, isResignation: boolean): number {
    // First 5 years: half month per year
    const first5 = Math.min(tenureYears, 5);
    const eosFirst5 = (baseSalary / 2) * first5;

    // After 5 years: full month per year
    const after5 = Math.max(0, tenureYears - 5);
    const eosAfter5 = baseSalary * after5;

    const totalEOS = eosFirst5 + eosAfter5;

    if (!isResignation) return Math.round(totalEOS);

    // Resignation deductions per Saudi labor law
    if (tenureYears < 2) return 0;                               // <2 years: forfeit all
    if (tenureYears < 5) return Math.round(totalEOS * (1 / 3));  // 2-5 years: 1/3
    if (tenureYears < 10) return Math.round(totalEOS * (2 / 3)); // 5-10 years: 2/3
    return Math.round(totalEOS);                                  // 10+ years: full
  }

  /** Generate a random payroll period (YYYY-MM) */
  generatePeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Generate IBAN */
  generateIBAN(): string {
    let digits = '';
    for (let i = 0; i < 22; i++) digits += Math.floor(Math.random() * 10);
    return `SA${digits}`;
  }
}
