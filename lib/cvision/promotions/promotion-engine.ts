/**
 * CVision Promotion Engine
 *
 * Pure logic for readiness scoring, salary calculation, and recommendation
 * generation. No database or API dependencies.
 */

import { GOSI_RATES } from '@/lib/cvision/gosi';

// =============================================================================
// Types
// =============================================================================

export interface GradeStructure {
  id: string;
  code: string;
  name: string;
  level: number;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
}

export interface EmployeeSnapshot {
  id: string;
  name: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  jobTitleId: string;
  gradeId?: string | null;
  grade?: string | null;
  gradeLevel?: number | null;
  basicSalary: number;
  hireDate?: string | null;
}

export interface PerformanceSnapshot {
  overallScore: number | null;
  rating: string | null;
}

export interface ReadinessResult {
  employeeId: string;
  employee: EmployeeSnapshot;
  score: number;
  tier: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'CONSIDER' | 'NOT_READY';
  tenureScore: number;
  performanceScore: number;
  promotionHistoryScore: number;
  disciplinaryScore: number;
  tenureMonths: number | null;
  performance: PerformanceSnapshot;
  activeWarnings: number;
  lastPromotionDate: string | null;
  reasonText: string;
  suggestedGrade: GradeStructure | null;
  suggestedSalary: SalaryCalculation | null;
  suggestedTitle: string;
}

export interface SalaryCalculation {
  suggestedSalary: number;
  minAllowed: number;
  maxAllowed: number;
  midpoint: number;
  increase: number;
  increasePercent: number;
  monthlyImpact: number;
  annualImpact: number;
  gosiImpact: number;
}

// =============================================================================
// Default Grade Structure (Saudi market aligned)
// =============================================================================

export const DEFAULT_GRADE_STRUCTURE: Omit<GradeStructure, 'id'>[] = [
  { code: 'G1', name: 'Grade 1 - Entry Level',     level: 1, minSalary: 4000,  midSalary: 5500,  maxSalary: 7000  },
  { code: 'G2', name: 'Grade 2 - Junior',           level: 2, minSalary: 5500,  midSalary: 7500,  maxSalary: 9500  },
  { code: 'G3', name: 'Grade 3 - Mid-Level',        level: 3, minSalary: 7500,  midSalary: 10000, maxSalary: 12500 },
  { code: 'G4', name: 'Grade 4 - Senior',           level: 4, minSalary: 10000, midSalary: 13500, maxSalary: 17000 },
  { code: 'G5', name: 'Grade 5 - Lead/Specialist',  level: 5, minSalary: 13500, midSalary: 17500, maxSalary: 21500 },
  { code: 'G6', name: 'Grade 6 - Manager',          level: 6, minSalary: 17000, midSalary: 22000, maxSalary: 27000 },
  { code: 'G7', name: 'Grade 7 - Senior Manager',   level: 7, minSalary: 22000, midSalary: 28000, maxSalary: 34000 },
  { code: 'G8', name: 'Grade 8 - Director',         level: 8, minSalary: 28000, midSalary: 36000, maxSalary: 44000 },
];

// =============================================================================
// Scoring Functions
// =============================================================================

const PERFORMANCE_SCORE_MAP: Record<string, number> = {
  EXCEPTIONAL: 100,
  EXCEEDS_EXPECTATIONS: 80,
  MEETS_EXPECTATIONS: 50,
  NEEDS_IMPROVEMENT: 10,
  UNSATISFACTORY: 0,
  // Label forms (in case rating was stored as label rather than key)
  'Exceptional': 100,
  'Exceeds Expectations': 80,
  'Meets Expectations': 50,
  'Needs Improvement': 10,
  'Unsatisfactory': 0,
};

function scoreTenure(months: number | null): number {
  if (months === null || months < 6) return 0;
  if (months < 12) return 30;
  if (months < 24) return 70;
  if (months < 36) return 100;
  return 80; // 36+ months — may indicate being overlooked
}

/**
 * Convert performance data to a readiness score (0-100).
 * Accepts either a rating string or a numeric score on a 1-5 scale.
 */
function scorePerformance(rating: string | null, numericScore?: number | null): number {
  // Try rating string first
  if (rating && PERFORMANCE_SCORE_MAP[rating] !== undefined) {
    return PERFORMANCE_SCORE_MAP[rating];
  }

  // Fall back to numeric score (1-5 scale)
  if (numericScore != null && numericScore > 0) {
    if (numericScore >= 4.5) return 100; // Exceptional
    if (numericScore >= 3.5) return 80;  // Exceeds Expectations
    if (numericScore >= 2.5) return 50;  // Meets Expectations
    if (numericScore >= 1.5) return 10;  // Needs Improvement
    return 0;                             // Unsatisfactory
  }

  return 30; // No review data — neutral
}

function scorePromotionHistory(lastPromoDate: string | null): number {
  if (!lastPromoDate) return 100; // never promoted
  const months = monthsBetween(new Date(lastPromoDate), new Date());
  if (months >= 12) return 80;
  if (months >= 6) return 30;
  return 0; // promoted less than 6 months ago
}

function scoreDisciplinary(activeWarnings: number): number {
  if (activeWarnings === 0) return 100;
  if (activeWarnings === 1) return 50;
  return 0;
}

function monthsBetween(d1: Date, d2: Date): number {
  return Math.floor((d2.getTime() - d1.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
}

function determineTier(score: number): ReadinessResult['tier'] {
  if (score >= 80) return 'HIGHLY_RECOMMENDED';
  if (score >= 60) return 'RECOMMENDED';
  if (score >= 40) return 'CONSIDER';
  return 'NOT_READY';
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Score and rank all employees by promotion readiness.
 */
export function findEligibleEmployees(
  employees: EmployeeSnapshot[],
  performanceMap: Record<string, PerformanceSnapshot>,
  warningsMap: Record<string, number>,
  lastPromoMap: Record<string, string>,
  grades: GradeStructure[]
): ReadinessResult[] {
  const now = new Date();

  const results: ReadinessResult[] = employees.map((emp) => {
    const hireDate = emp.hireDate ? new Date(emp.hireDate) : null;
    const tenureMonths = hireDate ? monthsBetween(hireDate, now) : null;
    const perf = performanceMap[emp.id] || { overallScore: null, rating: null };
    const warnings = warningsMap[emp.id] || 0;
    const lastPromo = lastPromoMap[emp.id] || null;

    const tScore = scoreTenure(tenureMonths);
    const pScore = scorePerformance(perf.rating, perf.overallScore);
    const hScore = scorePromotionHistory(lastPromo);
    const dScore = scoreDisciplinary(warnings);

    const total = Math.round(tScore * 0.3 + pScore * 0.4 + hScore * 0.2 + dScore * 0.1);

    const nextGrade = suggestNextGrade(emp.gradeLevel, grades);
    const suggestedSalary = nextGrade
      ? calculateNewSalary(emp.basicSalary, emp.gradeLevel || 0, nextGrade.level, grades)
      : null;

    const suggestedTitle = nextGrade
      ? `Senior ${emp.jobTitle}`.replace(/^Senior Senior/, 'Senior')
      : emp.jobTitle;

    return {
      employeeId: emp.id,
      employee: emp,
      score: total,
      tier: determineTier(total),
      tenureScore: tScore,
      performanceScore: pScore,
      promotionHistoryScore: hScore,
      disciplinaryScore: dScore,
      tenureMonths,
      performance: perf,
      activeWarnings: warnings,
      lastPromotionDate: lastPromo,
      reasonText: generateReasonText(emp, perf, tenureMonths, warnings, lastPromo, nextGrade, suggestedSalary),
      suggestedGrade: nextGrade,
      suggestedSalary,
      suggestedTitle,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Given the employee's current grade level, suggest the next one up.
 */
function suggestNextGrade(
  currentLevel: number | null | undefined,
  grades: GradeStructure[]
): GradeStructure | null {
  if (!currentLevel || grades.length === 0) {
    // If no grade assigned, suggest the lowest grade
    const sorted = [...grades].sort((a, b) => a.level - b.level);
    return sorted.length > 0 ? sorted[0] : null;
  }
  const sorted = [...grades].sort((a, b) => a.level - b.level);
  return sorted.find((g) => g.level > currentLevel) || null;
}

/**
 * Calculate new salary based on grade structure.
 */
export function calculateNewSalary(
  currentSalary: number,
  currentGradeLevel: number,
  newGradeLevel: number,
  grades: GradeStructure[]
): SalaryCalculation {
  const newGrade = grades.find((g) => g.level === newGradeLevel);
  if (!newGrade) {
    const increase = Math.round(currentSalary * 0.15);
    return {
      suggestedSalary: currentSalary + increase,
      minAllowed: currentSalary,
      maxAllowed: currentSalary * 2,
      midpoint: currentSalary + increase,
      increase,
      increasePercent: 15,
      monthlyImpact: increase,
      annualImpact: increase * 12,
      gosiImpact: Math.round(Math.min(increase, GOSI_RATES.MAX_SALARY - currentSalary) * GOSI_RATES.EMPLOYEE_RATE),
    };
  }

  let suggested: number;
  if (currentSalary < newGrade.minSalary) {
    suggested = newGrade.minSalary;
  } else if (currentSalary >= newGrade.minSalary) {
    // Already above min — use midpoint or 15% raise, whichever is higher
    suggested = Math.max(newGrade.midSalary, Math.round(currentSalary * 1.15));
  } else {
    suggested = newGrade.midSalary;
  }

  // Never exceed max
  suggested = Math.min(suggested, newGrade.maxSalary);

  const increase = suggested - currentSalary;
  const increasePercent = currentSalary > 0 ? Math.round((increase / currentSalary) * 100) : 0;

  const gosiCurrentBase = Math.min(currentSalary, GOSI_RATES.MAX_SALARY);
  const gosiNewBase = Math.min(suggested, GOSI_RATES.MAX_SALARY);
  const gosiImpact = Math.round((gosiNewBase - gosiCurrentBase) * GOSI_RATES.EMPLOYEE_RATE);

  return {
    suggestedSalary: suggested,
    minAllowed: newGrade.minSalary,
    maxAllowed: newGrade.maxSalary,
    midpoint: newGrade.midSalary,
    increase,
    increasePercent,
    monthlyImpact: increase,
    annualImpact: increase * 12,
    gosiImpact,
  };
}

/**
 * Build a human-readable recommendation string.
 */
function generateReasonText(
  emp: EmployeeSnapshot,
  perf: PerformanceSnapshot,
  tenureMonths: number | null,
  warnings: number,
  lastPromo: string | null,
  nextGrade: GradeStructure | null,
  salaryCalc: SalaryCalculation | null
): string {
  const parts: string[] = [];

  // Performance
  if (perf.rating === 'EXCEPTIONAL') {
    parts.push('exceptional performance');
  } else if (perf.rating === 'EXCEEDS_EXPECTATIONS') {
    parts.push(`performance rating of ${perf.overallScore?.toFixed(1) || '—'} (Exceeds Expectations)`);
  } else if (perf.rating === 'MEETS_EXPECTATIONS') {
    parts.push('meets expectations consistently');
  } else if (perf.rating) {
    parts.push(`performance: ${perf.rating.replace(/_/g, ' ').toLowerCase()}`);
  }

  // Tenure
  if (tenureMonths !== null) {
    if (tenureMonths >= 12) {
      const years = Math.floor(tenureMonths / 12);
      const months = tenureMonths % 12;
      const tenureStr = years > 0
        ? `${years} year${years > 1 ? 's' : ''}${months > 0 ? ` ${months} month${months > 1 ? 's' : ''}` : ''}`
        : `${months} month${months > 1 ? 's' : ''}`;
      parts.push(`${tenureStr} of tenure`);
    } else {
      parts.push(`${tenureMonths} months of tenure`);
    }
  }

  // Warnings
  if (warnings === 0) {
    parts.push('clean disciplinary record');
  }

  // Promotion history
  if (!lastPromo) {
    parts.push('no prior promotions');
  }

  const intro = parts.length > 0
    ? `Based on ${(emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee')}'s ${parts.join(', ')}`
    : `${(emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee')} is being evaluated for promotion`;

  const gradePart = nextGrade
    ? ` to ${nextGrade.name} (${nextGrade.code})`
    : '';

  const salaryPart = salaryCalc && salaryCalc.increase > 0
    ? `. Suggested salary: SAR ${emp.basicSalary.toLocaleString()} → SAR ${salaryCalc.suggestedSalary.toLocaleString()} (+${salaryCalc.increasePercent}%)`
    : '';

  return `${intro}, we recommend promotion${gradePart}${salaryPart}.`;
}

/**
 * Build grade structures from raw DB grade documents.
 * Computes midSalary from min/max if not available.
 */
export function buildGradeStructures(rawGrades: any[]): GradeStructure[] {
  return rawGrades
    .filter((g) => g.isActive !== false)
    .map((g) => ({
      id: g.id,
      code: g.code || 'Unknown',
      name: g.name || g.nameEn || g.code || 'Unknown',
      level: g.level || 0,
      minSalary: g.minSalary || 0,
      midSalary: g.midSalary || (g.minSalary && g.maxSalary ? Math.round((g.minSalary + g.maxSalary) / 2) : 0),
      maxSalary: g.maxSalary || 0,
    }))
    .sort((a, b) => a.level - b.level);
}

/**
 * Format tenure months into a readable string.
 */
export function formatTenure(months: number | null): string {
  if (months === null) return 'Unknown';
  if (months < 1) return 'Less than 1 month';
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  let str = `${years} year${years > 1 ? 's' : ''}`;
  if (remaining > 0) str += ` ${remaining} month${remaining > 1 ? 's' : ''}`;
  return str;
}
