// lib/cvision/gosi.ts
// Saudi GOSI (General Organization for Social Insurance) calculations

export const GOSI_RATES = {
  // ── Component rates ──────────────────────────────────────────────────────
  PENSION_RATE: 0.09,        // 9%  pension (annuity) — same for employer & employee
  SANED_RATE: 0.0075,        // 0.75% SANED unemployment insurance — employer & employee each
  HAZARD_RATE: 0.02,         // 2%  occupational hazard — employer only

  // ── Composite rates ──────────────────────────────────────────────────────
  // Employee: pension 9% + SANED 0.75% = 9.75%
  EMPLOYEE_RATE: 0.0975,
  // Employer: pension 9% + SANED 0.75% + occupational hazards 2% = 11.75%
  EMPLOYER_RATE: 0.1175,

  // ── Salary bounds ────────────────────────────────────────────────────────
  MAX_SALARY: 45000,         // Maximum insurable salary cap (SAR)
  MIN_SALARY: 1500,          // Minimum salary threshold (SAR)
} as const;

export interface GOSICalculation {
  baseSalary: number;
  housingAllowance: number;
  totalInsurableSalary: number;
  employeeContribution: number;
  employerContribution: number;
  hazardContribution: number;
  totalContribution: number;
  isAboveMax: boolean;
  isBelowMin: boolean;
}

/**
 * Calculate GOSI social insurance contributions.
 * Insurable salary = basic salary + housing allowance (capped at 45,000 SAR).
 */
export function calculateGOSI(
  baseSalary: number,
  housingAllowance: number = 0,
  includeHazard: boolean = false
): GOSICalculation {
  let totalInsurableSalary = baseSalary + housingAllowance;

  const isAboveMax = totalInsurableSalary > GOSI_RATES.MAX_SALARY;
  const isBelowMin = totalInsurableSalary < GOSI_RATES.MIN_SALARY;

  if (isAboveMax) {
    totalInsurableSalary = GOSI_RATES.MAX_SALARY;
  }

  const employeeContribution = totalInsurableSalary * GOSI_RATES.EMPLOYEE_RATE;
  const employerContribution = totalInsurableSalary * GOSI_RATES.EMPLOYER_RATE;
  // hazardContribution is already included in EMPLOYER_RATE; expose separately for reporting only
  const hazardContribution = includeHazard
    ? totalInsurableSalary * GOSI_RATES.HAZARD_RATE
    : 0;

  // Round the total once to avoid accumulated rounding error from rounding each line separately
  const totalContribution = Math.round((employeeContribution + employerContribution + hazardContribution) * 100) / 100;

  return {
    baseSalary,
    housingAllowance,
    totalInsurableSalary,
    employeeContribution: Math.round(employeeContribution * 100) / 100,
    employerContribution: Math.round(employerContribution * 100) / 100,
    hazardContribution: Math.round(hazardContribution * 100) / 100,
    totalContribution,
    isAboveMax,
    isBelowMin,
  };
}

/**
 * End-of-service benefit calculation per Saudi Labor Law:
 * - First 5 years: half month salary per year
 * - After 5 years: full month salary per year
 * - Resignation: varies by tenure
 */
export interface EndOfServiceCalculation {
  yearsOfService: number;
  monthsOfService: number;
  totalDays: number;
  lastSalary: number;
  dailyRate: number;
  isResignation: boolean;
  first5YearsAmount: number;
  after5YearsAmount: number;
  grossAmount: number;
  resignationDeduction: number;
  netAmount: number;
  breakdown: string[];
}

export function calculateEndOfService(
  startDate: Date,
  endDate: Date,
  lastBasicSalary: number,
  lastHousingAllowance: number = 0,
  isResignation: boolean = false
): EndOfServiceCalculation {
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const yearsOfService = totalDays / 365;
  const monthsOfService = totalDays / 30;

  const lastSalary = lastBasicSalary + lastHousingAllowance;
  const dailyRate = lastSalary / 30;

  const breakdown: string[] = [];
  let first5YearsAmount = 0;
  let after5YearsAmount = 0;

  if (yearsOfService <= 0) {
    return {
      yearsOfService: 0,
      monthsOfService: 0,
      totalDays,
      lastSalary,
      dailyRate,
      isResignation,
      first5YearsAmount: 0,
      after5YearsAmount: 0,
      grossAmount: 0,
      resignationDeduction: 0,
      netAmount: 0,
      breakdown: ['Service period less than one year — not eligible for benefit'],
    };
  }

  // First 5 years: half salary per year
  const firstFiveYears = Math.min(yearsOfService, 5);
  first5YearsAmount = (lastSalary / 2) * firstFiveYears;
  breakdown.push(`First ${firstFiveYears.toFixed(2)} years x half salary = SAR ${first5YearsAmount.toFixed(2)}`);

  // After 5 years: full salary per year
  if (yearsOfService > 5) {
    const remainingYears = yearsOfService - 5;
    after5YearsAmount = lastSalary * remainingYears;
    breakdown.push(`${remainingYears.toFixed(2)} years after 5th x full salary = SAR ${after5YearsAmount.toFixed(2)}`);
  }

  let grossAmount = first5YearsAmount + after5YearsAmount;
  let resignationDeduction = 0;

  if (isResignation) {
    if (yearsOfService < 2) {
      resignationDeduction = grossAmount;
      breakdown.push('Resignation before 2 years: not eligible for benefit');
    } else if (yearsOfService < 5) {
      resignationDeduction = grossAmount * (2/3);
      breakdown.push('Resignation (2-5 years): eligible for 1/3 of benefit');
    } else if (yearsOfService < 10) {
      resignationDeduction = grossAmount * (1/3);
      breakdown.push('Resignation (5-10 years): eligible for 2/3 of benefit');
    } else {
      breakdown.push('Resignation (10+ years): eligible for full benefit');
    }
  }

  const netAmount = Math.round((grossAmount - resignationDeduction) * 100) / 100;

  return {
    yearsOfService: Math.round(yearsOfService * 100) / 100,
    monthsOfService: Math.round(monthsOfService * 100) / 100,
    totalDays,
    lastSalary,
    dailyRate: Math.round(dailyRate * 100) / 100,
    isResignation,
    first5YearsAmount: Math.round(first5YearsAmount * 100) / 100,
    after5YearsAmount: Math.round(after5YearsAmount * 100) / 100,
    grossAmount: Math.round(grossAmount * 100) / 100,
    resignationDeduction: Math.round(resignationDeduction * 100) / 100,
    netAmount,
    breakdown,
  };
}

/**
 * Nitaqat (Saudization) band calculation
 */
export interface NitaqatCalculation {
  totalEmployees: number;
  saudiEmployees: number;
  nonSaudiEmployees: number;
  saudizationPercentage: number;
  requiredPercentage: number;
  status: 'PLATINUM' | 'GREEN_HIGH' | 'GREEN_MID' | 'GREEN_LOW' | 'YELLOW' | 'RED';
  deficit: number; // Number of Saudi employees needed to meet requirements
}

export function calculateNitaqat(
  saudiCount: number,
  nonSaudiCount: number,
  activityType: string = 'GENERAL',
  companySize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT' = 'MEDIUM'
): NitaqatCalculation {
  const totalEmployees = saudiCount + nonSaudiCount;

  if (totalEmployees === 0) {
    return {
      totalEmployees: 0,
      saudiEmployees: 0,
      nonSaudiEmployees: 0,
      saudizationPercentage: 0,
      requiredPercentage: 0,
      status: 'RED',
      deficit: 0,
    };
  }

  const saudizationPercentage = (saudiCount / totalEmployees) * 100;

  const requiredPercentages: Record<string, number> = {
    SMALL: 10,   // 10-49 employees
    MEDIUM: 12,  // 50-499 employees
    LARGE: 15,   // 500-2999 employees
    GIANT: 18,   // 3000+ employees
  };

  const requiredPercentage = requiredPercentages[companySize] || 12;

  let status: NitaqatCalculation['status'];
  if (saudizationPercentage >= requiredPercentage + 25) {
    status = 'PLATINUM';
  } else if (saudizationPercentage >= requiredPercentage + 15) {
    status = 'GREEN_HIGH';
  } else if (saudizationPercentage >= requiredPercentage + 5) {
    status = 'GREEN_MID';
  } else if (saudizationPercentage >= requiredPercentage) {
    status = 'GREEN_LOW';
  } else if (saudizationPercentage >= requiredPercentage - 5) {
    status = 'YELLOW';
  } else {
    status = 'RED';
  }

  const requiredSaudis = Math.ceil((requiredPercentage / 100) * totalEmployees);
  const deficit = Math.max(0, requiredSaudis - saudiCount);

  return {
    totalEmployees,
    saudiEmployees: saudiCount,
    nonSaudiEmployees: nonSaudiCount,
    saudizationPercentage: Math.round(saudizationPercentage * 100) / 100,
    requiredPercentage,
    status,
    deficit,
  };
}
