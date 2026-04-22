// lib/cvision/violations.ts
// Saudi Labor Law violation types and penalty calculations

/**
 * Violation penalty schedule per Saudi Labor Law Article 66
 */
export const SAUDI_VIOLATION_PENALTIES = {
  LATE_ATTENDANCE: {
    name: 'Late Attendance',
    penalties: [
      { occurrence: 1, penalty: 'VERBAL_WARNING', description: 'Verbal warning' },
      { occurrence: 2, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 3, penalty: 'SALARY_DEDUCTION', deductionPercent: 10, description: '10% daily salary deduction' },
      { occurrence: 4, penalty: 'SALARY_DEDUCTION', deductionPercent: 25, description: '25% daily salary deduction' },
      { occurrence: 5, penalty: 'SALARY_DEDUCTION', deductionDays: 1, description: 'One full day deduction' },
    ],
  },

  ABSENCE: {
    name: 'Unexcused Absence',
    penalties: [
      { occurrence: 1, penalty: 'SALARY_DEDUCTION', deductionDays: 1, description: 'One day deduction' },
      { occurrence: 2, penalty: 'SALARY_DEDUCTION', deductionDays: 2, description: 'Two days deduction' },
      { occurrence: 3, penalty: 'SALARY_DEDUCTION', deductionDays: 3, description: 'Three days deduction' },
      { occurrence: 4, penalty: 'WRITTEN_WARNING', description: 'Written warning + deduction' },
      { occurrence: 5, penalty: 'TERMINATION', description: 'Contract termination (30 intermittent or 15 consecutive days)' },
    ],
  },

  EARLY_LEAVE: {
    name: 'Unauthorized Early Leave',
    penalties: [
      { occurrence: 1, penalty: 'VERBAL_WARNING', description: 'Verbal warning' },
      { occurrence: 2, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 3, penalty: 'SALARY_DEDUCTION', deductionPercent: 15, description: '15% daily salary deduction' },
      { occurrence: 4, penalty: 'SALARY_DEDUCTION', deductionDays: 1, description: 'One full day deduction' },
    ],
  },

  MISCONDUCT: {
    name: 'Misconduct',
    penalties: [
      { occurrence: 1, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 2, penalty: 'SALARY_DEDUCTION', deductionDays: 2, description: 'Two days deduction' },
      { occurrence: 3, penalty: 'SUSPENSION', suspensionDays: 3, description: '3-day suspension' },
      { occurrence: 4, penalty: 'TERMINATION', description: 'Contract termination' },
    ],
  },

  INSUBORDINATION: {
    name: 'Insubordination',
    penalties: [
      { occurrence: 1, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 2, penalty: 'SALARY_DEDUCTION', deductionDays: 3, description: 'Three days deduction' },
      { occurrence: 3, penalty: 'SUSPENSION', suspensionDays: 5, description: '5-day suspension' },
      { occurrence: 4, penalty: 'TERMINATION', description: 'Contract termination' },
    ],
  },

  // Severe violations — immediate termination
  HARASSMENT: {
    name: 'Harassment',
    penalties: [
      { occurrence: 1, penalty: 'TERMINATION', description: 'Immediate termination without end-of-service benefit' },
    ],
  },

  THEFT: {
    name: 'Theft',
    penalties: [
      { occurrence: 1, penalty: 'TERMINATION', description: 'Immediate termination without end-of-service benefit' },
    ],
  },

  FRAUD: {
    name: 'Fraud / Forgery',
    penalties: [
      { occurrence: 1, penalty: 'TERMINATION', description: 'Immediate termination without end-of-service benefit' },
    ],
  },

  VIOLENCE: {
    name: 'Violence / Assault',
    penalties: [
      { occurrence: 1, penalty: 'TERMINATION', description: 'Immediate termination without end-of-service benefit' },
    ],
  },

  SAFETY: {
    name: 'Safety Violation',
    penalties: [
      { occurrence: 1, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 2, penalty: 'SALARY_DEDUCTION', deductionDays: 2, description: 'Two days deduction' },
      { occurrence: 3, penalty: 'SUSPENSION', suspensionDays: 5, description: '5-day suspension' },
      { occurrence: 4, penalty: 'TERMINATION', description: 'Contract termination' },
    ],
  },

  PERFORMANCE: {
    name: 'Poor Performance',
    penalties: [
      { occurrence: 1, penalty: 'VERBAL_WARNING', description: 'Verbal warning with improvement plan' },
      { occurrence: 2, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 3, penalty: 'DEMOTION', description: 'Demotion or transfer' },
      { occurrence: 4, penalty: 'TERMINATION', description: 'Contract termination' },
    ],
  },

  POLICY_BREACH: {
    name: 'Company Policy Breach',
    penalties: [
      { occurrence: 1, penalty: 'VERBAL_WARNING', description: 'Verbal warning' },
      { occurrence: 2, penalty: 'WRITTEN_WARNING', description: 'Written warning' },
      { occurrence: 3, penalty: 'SALARY_DEDUCTION', deductionDays: 1, description: 'One day deduction' },
      { occurrence: 4, penalty: 'SUSPENSION', suspensionDays: 3, description: '3-day suspension' },
    ],
  },
} as const;

export type ViolationType = keyof typeof SAUDI_VIOLATION_PENALTIES;
export type PenaltyType = 'VERBAL_WARNING' | 'WRITTEN_WARNING' | 'SALARY_DEDUCTION' | 'SUSPENSION' | 'DEMOTION' | 'TERMINATION' | 'NO_ACTION';

export interface PenaltyRecommendation {
  penalty: PenaltyType;
  description: string;
  deductionDays?: number;
  deductionPercent?: number;
  suspensionDays?: number;
  deductionAmount?: number;
  isTermination: boolean;
  isSevere: boolean;
}

/**
 * Get recommended penalty based on violation type and occurrence count
 */
export function getRecommendedPenalty(
  violationType: ViolationType,
  occurrenceNumber: number,
  dailySalary: number = 0
): PenaltyRecommendation {
  const violationConfig = SAUDI_VIOLATION_PENALTIES[violationType];

  if (!violationConfig) {
    return {
      penalty: 'VERBAL_WARNING',
      description: 'Verbal warning (undefined violation type)',
      isTermination: false,
      isSevere: false,
    };
  }

  const penalties = violationConfig.penalties;
  const penaltyIndex = Math.min(occurrenceNumber - 1, penalties.length - 1);
  const penaltyConfig = penalties[penaltyIndex];

  let deductionAmount: number | undefined;

  const config = penaltyConfig as { deductionDays?: number; deductionPercent?: number; suspensionDays?: number; penalty: string; description: string };
  if (config.deductionDays && dailySalary > 0) {
    deductionAmount = config.deductionDays * dailySalary;
  } else if (config.deductionPercent && dailySalary > 0) {
    deductionAmount = (config.deductionPercent / 100) * dailySalary;
  }

  return {
    penalty: config.penalty as PenaltyType,
    description: config.description,
    deductionDays: config.deductionDays,
    deductionPercent: config.deductionPercent,
    suspensionDays: config.suspensionDays,
    deductionAmount: deductionAmount ? Math.round(deductionAmount * 100) / 100 : undefined,
    isTermination: config.penalty === 'TERMINATION',
    isSevere: ['TERMINATION', 'SUSPENSION', 'DEMOTION'].includes(config.penalty),
  };
}

/**
 * Count violations within time periods
 */
export interface ViolationCount {
  total: number;
  byType: Record<string, number>;
  lastViolationDate: Date | null;
  inLastYear: number;
  inLast6Months: number;
  inLast3Months: number;
}

export function countViolations(
  violations: { type: string; incidentDate: Date; status: string }[],
  today: Date = new Date()
): ViolationCount {
  const byType: Record<string, number> = {};
  let lastViolationDate: Date | null = null;
  let inLastYear = 0;
  let inLast6Months = 0;
  let inLast3Months = 0;

  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (const violation of violations) {
    if (violation.status !== 'DECIDED' && violation.status !== 'CLOSED') {
      continue;
    }

    const incidentDate = new Date(violation.incidentDate);
    byType[violation.type] = (byType[violation.type] || 0) + 1;

    if (!lastViolationDate || incidentDate > lastViolationDate) {
      lastViolationDate = incidentDate;
    }

    if (incidentDate >= oneYearAgo) inLastYear++;
    if (incidentDate >= sixMonthsAgo) inLast6Months++;
    if (incidentDate >= threeMonthsAgo) inLast3Months++;
  }

  return {
    total: violations.filter(v => v.status === 'DECIDED' || v.status === 'CLOSED').length,
    byType,
    lastViolationDate,
    inLastYear,
    inLast6Months,
    inLast3Months,
  };
}

/**
 * Check if employee can be terminated due to absences.
 * Saudi Labor Law Article 80: 30 intermittent or 15 consecutive unexcused absence days.
 */
export interface AbsenceTerminationCheck {
  canTerminate: boolean;
  consecutiveAbsentDays: number;
  totalAbsentDaysInYear: number;
  reason: string;
}

export function checkAbsenceTermination(
  absences: { date: Date; isExcused: boolean }[],
  today: Date = new Date()
): AbsenceTerminationCheck {
  const unexcusedAbsences = absences
    .filter(a => !a.isExcused)
    .map(a => new Date(a.date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (unexcusedAbsences.length === 0) {
    return {
      canTerminate: false,
      consecutiveAbsentDays: 0,
      totalAbsentDaysInYear: 0,
      reason: 'No unexcused absences on record',
    };
  }

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < unexcusedAbsences.length; i++) {
    const diff = (unexcusedAbsences[i].getTime() - unexcusedAbsences[i-1].getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const absencesInYear = unexcusedAbsences.filter(d => d >= oneYearAgo).length;

  let canTerminate = false;
  let reason = '';

  if (maxConsecutive >= 15) {
    canTerminate = true;
    reason = `${maxConsecutive} consecutive absent days (threshold: 15)`;
  } else if (absencesInYear >= 30) {
    canTerminate = true;
    reason = `${absencesInYear} intermittent absent days this year (threshold: 30)`;
  } else {
    reason = `Within allowed limits (${maxConsecutive} consecutive, ${absencesInYear} intermittent this year)`;
  }

  return {
    canTerminate,
    consecutiveAbsentDays: maxConsecutive,
    totalAbsentDaysInYear: absencesInYear,
    reason,
  };
}

/**
 * Calculate total violation deductions for payroll
 */
export interface ViolationDeductions {
  totalDeductionDays: number;
  totalDeductionAmount: number;
  totalSuspensionDays: number;
  deductions: {
    violationId: string;
    type: string;
    deductionDays: number;
    deductionAmount: number;
    suspensionDays: number;
  }[];
}

export function calculateViolationDeductions(
  violations: {
    id: string;
    type: string;
    penalty: PenaltyType;
    penaltyAmount?: number;
    penaltyDays?: number;
  }[],
  dailySalary: number
): ViolationDeductions {
  let totalDeductionDays = 0;
  let totalDeductionAmount = 0;
  let totalSuspensionDays = 0;
  const deductions: ViolationDeductions['deductions'] = [];

  for (const violation of violations) {
    let deductionDays = 0;
    let deductionAmount = 0;
    let suspensionDays = 0;

    if (violation.penalty === 'SALARY_DEDUCTION') {
      deductionDays = violation.penaltyDays || 0;
      deductionAmount = violation.penaltyAmount || (deductionDays * dailySalary);
    } else if (violation.penalty === 'SUSPENSION') {
      suspensionDays = violation.penaltyDays || 0;
      // Suspension also deducts from salary
      deductionAmount = suspensionDays * dailySalary;
    }

    totalDeductionDays += deductionDays;
    totalDeductionAmount += deductionAmount;
    totalSuspensionDays += suspensionDays;

    deductions.push({
      violationId: violation.id,
      type: violation.type,
      deductionDays,
      deductionAmount: Math.round(deductionAmount * 100) / 100,
      suspensionDays,
    });
  }

  // Max monthly deduction: 5 days (Article 66)
  const maxMonthlyDeduction = 5 * dailySalary;

  return {
    totalDeductionDays,
    totalDeductionAmount: Math.min(Math.round(totalDeductionAmount * 100) / 100, maxMonthlyDeduction),
    totalSuspensionDays,
    deductions,
  };
}

/**
 * Generate a violation report for an employee
 */
export interface ViolationReport {
  employeeId: string;
  period: { from: Date; to: Date };
  summary: ViolationCount;
  deductions: ViolationDeductions;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export function generateViolationReport(
  employeeId: string,
  violations: {
    id: string;
    type: string;
    incidentDate: Date;
    status: string;
    penalty: PenaltyType;
    penaltyAmount?: number;
    penaltyDays?: number;
  }[],
  dailySalary: number,
  fromDate: Date,
  toDate: Date
): ViolationReport {
  const filteredViolations = violations.filter(
    v => new Date(v.incidentDate) >= fromDate && new Date(v.incidentDate) <= toDate
  );

  const summary = countViolations(
    filteredViolations.map(v => ({ type: v.type, incidentDate: v.incidentDate, status: v.status })),
    toDate
  );

  const decidedViolations = filteredViolations.filter(
    v => v.status === 'DECIDED' || v.status === 'CLOSED'
  );

  const deductions = calculateViolationDeductions(decidedViolations, dailySalary);

  let riskLevel: ViolationReport['riskLevel'] = 'LOW';
  const recommendations: string[] = [];

  if (summary.inLast3Months >= 5 || deductions.totalSuspensionDays > 0) {
    riskLevel = 'CRITICAL';
    recommendations.push('Immediate action required — repeated violations');
  } else if (summary.inLast3Months >= 3 || summary.inLastYear >= 8) {
    riskLevel = 'HIGH';
    recommendations.push('Review employee performance and schedule a warning meeting');
  } else if (summary.inLast6Months >= 2) {
    riskLevel = 'MEDIUM';
    recommendations.push('Schedule periodic follow-up with employee');
  }

  if (summary.byType['LATE_ATTENDANCE'] >= 3) {
    recommendations.push('Chronic attendance punctuality issue detected');
  }

  if (summary.byType['ABSENCE'] >= 2) {
    recommendations.push('Investigate reasons behind repeated absences');
  }

  return {
    employeeId,
    period: { from: fromDate, to: toDate },
    summary,
    deductions,
    riskLevel,
    recommendations,
  };
}

// ─── Disciplinary Action Constants ─────────────────────────────────

export const WARNING_TYPES = {
  VERBAL_WARNING: { label: 'Verbal Warning', level: 1, color: 'gray' },
  FIRST_WRITTEN: { label: 'First Written Warning', level: 2, color: 'yellow' },
  SECOND_WRITTEN: { label: 'Second Written Warning', level: 3, color: 'orange' },
  FINAL_WARNING: { label: 'Final Warning', level: 4, color: 'red' },
  SUSPENSION: { label: 'Suspension', level: 5, color: 'darkred' },
  TERMINATION: { label: 'Termination', level: 6, color: 'black' },
} as const;

export const SEVERITY_LEVELS = {
  MINOR: { label: 'Minor', description: 'First occurrence, minimal impact', color: 'yellow' },
  MODERATE: { label: 'Moderate', description: 'Repeated occurrence or noticeable impact', color: 'orange' },
  MAJOR: { label: 'Major', description: 'Serious violation with significant impact', color: 'red' },
  CRITICAL: { label: 'Critical', description: 'Severe violation, immediate action required', color: 'darkred' },
} as const;

export const CATEGORIES = {
  ATTENDANCE: 'Attendance',
  PERFORMANCE: 'Performance',
  CONDUCT: 'Conduct',
  POLICY_VIOLATION: 'Policy Violation',
  SAFETY: 'Safety',
  INSUBORDINATION: 'Insubordination',
  HARASSMENT: 'Harassment',
  THEFT: 'Theft',
  OTHER: 'Other',
} as const;

export const LABOR_LAW_ARTICLES = [
  { value: 'Article 66', label: 'Article 66 — Penalties for violations' },
  { value: 'Article 80', label: 'Article 80 — Termination without notice/compensation' },
  { value: 'Article 81', label: 'Article 81 — Employee right to leave without notice' },
  { value: 'Article 71', label: 'Article 71 — Probation period termination' },
  { value: 'Article 75', label: 'Article 75 — Contract termination' },
  { value: 'Article 76', label: 'Article 76 — Notice period' },
] as const;

export function suggestWarningType(activeWarningCount: number): keyof typeof WARNING_TYPES {
  if (activeWarningCount === 0) return 'VERBAL_WARNING';
  if (activeWarningCount === 1) return 'FIRST_WRITTEN';
  if (activeWarningCount === 2) return 'SECOND_WRITTEN';
  if (activeWarningCount === 3) return 'FINAL_WARNING';
  return 'SUSPENSION';
}

export function suggestActionText(type: keyof typeof WARNING_TYPES): string {
  switch (type) {
    case 'VERBAL_WARNING':
      return 'Verbal counseling provided. Employee reminded of company policy and expected standards of conduct.';
    case 'FIRST_WRITTEN':
      return 'First written warning issued. Employee must demonstrate improvement within 30 days.';
    case 'SECOND_WRITTEN':
      return 'Second written warning issued. Employee must immediately correct behavior. Further violations will result in final warning.';
    case 'FINAL_WARNING':
      return 'Final warning issued. Any further violation will result in suspension or termination of employment.';
    case 'SUSPENSION':
      return 'Employee suspended without pay effective immediately. Must report back on the designated return date.';
    case 'TERMINATION':
      return 'Employment terminated in accordance with Saudi Labor Law. Employee must complete exit procedures.';
    default:
      return '';
  }
}
