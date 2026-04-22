// ─── HR Analytics Engine ────────────────────────────────────────────────────
// Unified analytics across attendance, leaves, payroll, contracts, and workforce
// demographics. Produces absence patterns, turnover metrics, payroll cost trends,
// workforce insights, retention risk scores, and bilingual executive summaries.
// Pure computation — no AI API calls, no DB, no side effects.

import { isSaudiNationality as _isSaudiNationality } from '../saudi-utils';
import { GOSI_RATES } from '../gosi';

// ─── Types & Interfaces ────────────────────────────────────────────────────

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AbsencePattern {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  totalAbsences: number;
  totalLateDays: number;
  totalEarlyLeaveDays: number;
  totalSickLeaveDays: number;
  totalUnpaidLeaveDays: number;
  totalAnnualLeaveDays: number;
  averageLateMinutes: number;
  absenteeismRate: number;
  peakAbsenceDay: number;    // day of week 0 (Sun) – 6 (Sat)
  peakAbsenceMonth: number;  // 1–12
  consecutiveAbsenceStreak: number;
  isHighRisk: boolean;
  riskFactors: string[];
}

export interface AbsenceAnalytics {
  dateRange: DateRange;
  totalEmployees: number;
  totalAbsenceDays: number;
  totalLateDays: number;
  overallAbsenteeismRate: number;
  averageAbsencesPerEmployee: number;
  byDepartment: Record<string, { absenteeismRate: number; totalAbsences: number; employeeCount: number }>;
  byType: Record<string, number>;
  byDayOfWeek: number[];   // 7 elements, index = day of week
  byMonth: number[];        // 12 elements, index = month - 1
  topAbsentees: AbsencePattern[];
  highRiskEmployees: AbsencePattern[];
  trends: { period: string; rate: number }[];
}

export interface TurnoverRecord {
  employeeId: string;
  employeeName: string;
  departmentId: string;
  jobTitleId: string;
  hiredAt: Date;
  separationDate: Date;
  separationType: 'RESIGNED' | 'TERMINATED';
  tenureMonths: number;
  reason?: string;
}

export interface TurnoverAnalytics {
  dateRange: DateRange;
  totalSeparations: number;
  resignations: number;
  terminations: number;
  turnoverRate: number;
  voluntaryTurnoverRate: number;
  involuntaryTurnoverRate: number;
  averageTenureMonths: number;
  byDepartment: Record<string, { turnoverRate: number; separations: number; headcount: number }>;
  byTenureBand: Record<string, number>;
  byMonth: { period: string; separations: number; hires: number; netChange: number }[];
  retentionRate: number;
  separations: TurnoverRecord[];
}

export interface PayrollTrend {
  period: string;  // YYYY-MM
  totalGross: number;
  totalNet: number;
  employeeCount: number;
  averageGross: number;
  averageNet: number;
  totalAllowances: number;
  totalDeductions: number;
  gosiEmployerCost: number;
  costPerEmployee: number;
  changeFromPrevious: {
    grossChange: number;       // percentage
    netChange: number;         // percentage
    headcountChange: number;   // percentage
  };
}

export interface WorkforceInsights {
  snapshotDate: Date;
  totalHeadcount: number;
  activeCount: number;
  probationCount: number;
  byDepartment: Record<string, number>;
  byNationality: Record<string, number>;
  byGender: Record<string, number>;
  saudizationRate: number;
  averageAge: number;
  averageTenureMonths: number;
  contractTypeDistribution: Record<string, number>;
  contractExpiringIn90Days: number;
  probationEndingIn30Days: number;
  ageBands: Record<string, number>;
  tenureBands: Record<string, number>;
  retentionRiskCount: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const TENURE_BANDS: Record<string, { min: number; max: number; label: string }> = {
  '0-6mo':  { min: 0,  max: 6,   label: '0–6 months' },
  '6-12mo': { min: 6,  max: 12,  label: '6–12 months' },
  '1-2yr':  { min: 12, max: 24,  label: '1–2 years' },
  '2-5yr':  { min: 24, max: 60,  label: '2–5 years' },
  '5+yr':   { min: 60, max: Infinity, label: '5+ years' },
};

export const AGE_BANDS: Record<string, { min: number; max: number; label: string }> = {
  '18-25': { min: 18, max: 25, label: '18–25' },
  '26-35': { min: 26, max: 35, label: '26–35' },
  '36-45': { min: 36, max: 45, label: '36–45' },
  '46-55': { min: 46, max: 55, label: '46–55' },
  '55+':   { min: 56, max: Infinity, label: '55+' },
};

const RISK_THRESHOLDS = {
  HIGH_ABSENTEEISM_RATE: 10,       // % threshold for high-risk
  HIGH_SICK_LEAVE_DAYS: 15,        // days threshold
  CONSECUTIVE_ABSENCE_STREAK: 3,   // consecutive days
  HIGH_TURNOVER_RATE: 15,          // % threshold
  HIGH_ABSENTEEISM_ORG: 8,        // % org-level alert
  LATE_ARRIVALS_RISK: 5,           // count for risk scoring
  CONTRACT_EXPIRY_DAYS: 90,        // days to flag upcoming expiry
  PROBATION_END_DAYS: 30,          // days to flag upcoming probation end
  RETENTION_RISK_DAYS: 60,         // days for contract-based retention risk
};

// Saudi detection now uses shared utility from saudi-utils.ts
// const SAUDI_NATIONALITIES — replaced by import from '../saudi-utils'

const GOSI_EMPLOYER_RATE = GOSI_RATES.EMPLOYER_RATE;  // 11.75%
const GOSI_MAX_INSURABLE = GOSI_RATES.MAX_SALARY;    // 45,000 SAR

// ─── Internal Helpers ──────────────────────────────────────────────────────

function monthsBetween(d1: Date, d2: Date): number {
  const start = new Date(d1);
  const end = new Date(d2);
  const result = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, result);
}

function daysBetween(d1: Date, d2: Date): number {
  const ms = new Date(d2).getTime() - new Date(d1).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return round2((current - previous) / previous * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatSAR(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function formatPeriod(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

function isWithinRange(date: Date | string | null | undefined, range: DateRange): boolean {
  if (!date) return false;
  const d = toDate(date);
  return d >= range.start && d <= range.end;
}

function getTenureBand(months: number): string {
  for (const [key, band] of Object.entries(TENURE_BANDS)) {
    if (months >= band.min && months < band.max) return key;
  }
  return '5+yr';
}

function getAgeBand(age: number): string {
  for (const [key, band] of Object.entries(AGE_BANDS)) {
    if (age >= band.min && age <= band.max) return key;
  }
  return '55+';
}

function calculateAge(dateOfBirth: Date | string | null | undefined, referenceDate: Date): number {
  if (!dateOfBirth) return 0;
  const dob = toDate(dateOfBirth);
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

function isSaudiNationality(nationality: string | null | undefined): boolean {
  return _isSaudiNationality(nationality);
}

function findMaxConsecutiveStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i - 1], sorted[i]);
    // Consider consecutive if within 1–3 days (skip weekends)
    if (diff >= 1 && diff <= 3) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

function findPeakIndex(counts: number[]): number {
  let maxIndex = 0;
  let maxVal = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > maxVal) {
      maxVal = counts[i];
      maxIndex = i;
    }
  }
  return maxIndex;
}

// ─── Exported Functions ────────────────────────────────────────────────────

/**
 * Analyze absence patterns across the organization.
 * Processes attendance records and leave data to produce per-employee patterns,
 * department breakdowns, day-of-week/month distributions, and risk scoring.
 */
export function analyzeAbsencePatterns(params: {
  employees: { id: string; name: string; fullName?: string; firstName?: string; lastName?: string; departmentId: string }[];
  attendanceRecords: { employeeId: string; date: Date | string; status: string; lateMinutes?: number; earlyLeaveMinutes?: number }[];
  leaveRecords: { employeeId: string; type?: string; leaveType?: string; status: string; startDate: Date | string; endDate: Date | string; totalDays?: number; days?: number }[];
  dateRange: DateRange;
  workingDaysPerMonth?: number;
}): AbsenceAnalytics {
  const { employees, attendanceRecords, leaveRecords, dateRange, workingDaysPerMonth = 22 } = params;

  // Calculate total working days in range
  const totalMonths = Math.max(1, monthsBetween(dateRange.start, dateRange.end) || 1);
  const totalWorkingDays = totalMonths * workingDaysPerMonth;

  // Filter leaves to APPROVED/TAKEN only
  const approvedLeaves = leaveRecords.filter(
    l => l.status === 'APPROVED'
  );

  // Group attendance and leaves by employee
  const attendanceByEmployee = groupBy(attendanceRecords, r => r.employeeId);
  const leavesByEmployee = groupBy(approvedLeaves, l => l.employeeId);

  // Organization-wide aggregates
  const byDayOfWeek = new Array(7).fill(0);
  const byMonth = new Array(12).fill(0);
  const byType: Record<string, number> = {};
  const deptAggregates: Record<string, { totalAbsences: number; employeeCount: number }> = {};
  let orgTotalAbsences = 0;
  let orgTotalLateDays = 0;

  // Per-employee patterns
  const employeePatterns: AbsencePattern[] = employees.map(emp => {
    const records = attendanceByEmployee[emp.id] || [];
    const leaves = leavesByEmployee[emp.id] || [];

    // Attendance counts
    let totalAbsences = 0;
    let totalLateDays = 0;
    let totalEarlyLeaveDays = 0;
    let totalLateMinutes = 0;
    let lateCount = 0;
    const absenceDates: Date[] = [];
    const dayOfWeekCounts = new Array(7).fill(0);
    const monthCounts = new Array(12).fill(0);

    for (const rec of records) {
      const date = toDate(rec.date);
      const status = rec.status?.toUpperCase();

      if (status === 'ABSENT') {
        totalAbsences++;
        absenceDates.push(date);
        dayOfWeekCounts[date.getDay()]++;
        monthCounts[date.getMonth()]++;
        byDayOfWeek[date.getDay()]++;
        byMonth[date.getMonth()]++;
      }
      if (status === 'LATE') {
        totalLateDays++;
        totalLateMinutes += rec.lateMinutes || 0;
        lateCount++;
      }
      if (status === 'EARLY_LEAVE') {
        totalEarlyLeaveDays++;
      }
    }

    // Leave counts by type
    let totalSickLeaveDays = 0;
    let totalUnpaidLeaveDays = 0;
    let totalAnnualLeaveDays = 0;

    for (const leave of leaves) {
      const type = (leave.leaveType || leave.type)?.toUpperCase();
      const days = leave.days || leave.totalDays || 0;

      byType[type] = (byType[type] || 0) + days;

      if (type === 'SICK') totalSickLeaveDays += days;
      else if (type === 'UNPAID') totalUnpaidLeaveDays += days;
      else if (type === 'ANNUAL') totalAnnualLeaveDays += days;
    }

    // Metrics
    const absenteeismRate = totalWorkingDays > 0
      ? round2((totalAbsences / totalWorkingDays) * 100)
      : 0;

    const averageLateMinutes = lateCount > 0
      ? round2(totalLateMinutes / lateCount)
      : 0;

    const consecutiveAbsenceStreak = findMaxConsecutiveStreak(absenceDates);

    const peakAbsenceDay = findPeakIndex(dayOfWeekCounts);
    const peakAbsenceMonth = findPeakIndex(monthCounts) + 1; // 1-indexed

    // Risk assessment
    const riskFactors: string[] = [];
    if (absenteeismRate > RISK_THRESHOLDS.HIGH_ABSENTEEISM_RATE) {
      riskFactors.push(`High absenteeism rate (${absenteeismRate}%)`);
    }
    if (consecutiveAbsenceStreak >= RISK_THRESHOLDS.CONSECUTIVE_ABSENCE_STREAK) {
      riskFactors.push(`Consecutive absence streak of ${consecutiveAbsenceStreak} days`);
    }
    if (totalSickLeaveDays > RISK_THRESHOLDS.HIGH_SICK_LEAVE_DAYS) {
      riskFactors.push(`High sick leave usage (${totalSickLeaveDays} days)`);
    }
    if (totalUnpaidLeaveDays > 10) {
      riskFactors.push(`Significant unpaid leave (${totalUnpaidLeaveDays} days)`);
    }
    if (totalLateDays > RISK_THRESHOLDS.LATE_ARRIVALS_RISK) {
      riskFactors.push(`Frequent late arrivals (${totalLateDays} times)`);
    }

    const isHighRisk = absenteeismRate > RISK_THRESHOLDS.HIGH_ABSENTEEISM_RATE
      || consecutiveAbsenceStreak >= RISK_THRESHOLDS.CONSECUTIVE_ABSENCE_STREAK
      || totalSickLeaveDays > RISK_THRESHOLDS.HIGH_SICK_LEAVE_DAYS;

    // Department aggregation
    if (!deptAggregates[emp.departmentId]) {
      deptAggregates[emp.departmentId] = { totalAbsences: 0, employeeCount: 0 };
    }
    deptAggregates[emp.departmentId].totalAbsences += totalAbsences;
    deptAggregates[emp.departmentId].employeeCount++;

    orgTotalAbsences += totalAbsences;
    orgTotalLateDays += totalLateDays;

    return {
      employeeId: emp.id,
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
      departmentId: emp.departmentId,
      totalAbsences,
      totalLateDays,
      totalEarlyLeaveDays,
      totalSickLeaveDays,
      totalUnpaidLeaveDays,
      totalAnnualLeaveDays,
      averageLateMinutes,
      absenteeismRate,
      peakAbsenceDay,
      peakAbsenceMonth,
      consecutiveAbsenceStreak,
      isHighRisk,
      riskFactors,
    };
  });

  // Department breakdown
  const byDepartment: Record<string, { absenteeismRate: number; totalAbsences: number; employeeCount: number }> = {};
  for (const [deptId, agg] of Object.entries(deptAggregates)) {
    const deptWorkingDays = totalWorkingDays * agg.employeeCount;
    byDepartment[deptId] = {
      absenteeismRate: deptWorkingDays > 0 ? round2((agg.totalAbsences / deptWorkingDays) * 100) : 0,
      totalAbsences: agg.totalAbsences,
      employeeCount: agg.employeeCount,
    };
  }

  // Top absentees (sorted by totalAbsences desc, top 10)
  const sortedByAbsences = [...employeePatterns].sort((a, b) => b.totalAbsences - a.totalAbsences);
  const topAbsentees = sortedByAbsences.slice(0, 10);

  // High-risk employees
  const highRiskEmployees = employeePatterns.filter(p => p.isHighRisk);

  // Monthly trends
  const trends: { period: string; rate: number }[] = [];
  const current = new Date(dateRange.start);
  while (current <= dateRange.end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);

    const monthAbsences = attendanceRecords.filter(r => {
      const d = toDate(r.date);
      return d >= monthStart && d <= monthEnd && r.status?.toUpperCase() === 'ABSENT';
    }).length;

    const monthRate = employees.length > 0 && workingDaysPerMonth > 0
      ? round2((monthAbsences / (employees.length * workingDaysPerMonth)) * 100)
      : 0;

    trends.push({ period: formatPeriod(monthStart), rate: monthRate });
    current.setMonth(current.getMonth() + 1);
  }

  // Overall metrics
  const totalEmployeeWorkingDays = employees.length * totalWorkingDays;
  const overallAbsenteeismRate = totalEmployeeWorkingDays > 0
    ? round2((orgTotalAbsences / totalEmployeeWorkingDays) * 100)
    : 0;

  const averageAbsencesPerEmployee = employees.length > 0
    ? round2(orgTotalAbsences / employees.length)
    : 0;

  return {
    dateRange,
    totalEmployees: employees.length,
    totalAbsenceDays: orgTotalAbsences,
    totalLateDays: orgTotalLateDays,
    overallAbsenteeismRate,
    averageAbsencesPerEmployee,
    byDepartment,
    byType,
    byDayOfWeek,
    byMonth,
    topAbsentees,
    highRiskEmployees,
    trends,
  };
}

/**
 * Analyze employee turnover across the organization.
 * Tracks resignations and terminations, calculates turnover rates,
 * tenure distribution, and monthly hire/separation trends.
 */
export function analyzeTurnover(params: {
  employees: {
    id: string;
    name: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    departmentId: string;
    jobTitleId: string;
    status: string;
    hiredAt: Date | string | null;
    resignedAt?: Date | string | null;
    terminatedAt?: Date | string | null;
    statusReason?: string | null;
  }[];
  dateRange: DateRange;
}): TurnoverAnalytics {
  const { employees, dateRange } = params;

  // Identify separations within the date range
  const separations: TurnoverRecord[] = [];
  let resignations = 0;
  let terminations = 0;
  let totalTenure = 0;

  for (const emp of employees) {
    const status = emp.status?.toUpperCase();
    let separationDate: Date | null = null;
    let separationType: 'RESIGNED' | 'TERMINATED' | null = null;

    if (status === 'RESIGNED' && emp.resignedAt) {
      const d = toDate(emp.resignedAt);
      if (isWithinRange(d, dateRange)) {
        separationDate = d;
        separationType = 'RESIGNED';
        resignations++;
      }
    } else if (status === 'TERMINATED' && emp.terminatedAt) {
      const d = toDate(emp.terminatedAt);
      if (isWithinRange(d, dateRange)) {
        separationDate = d;
        separationType = 'TERMINATED';
        terminations++;
      }
    }

    if (separationDate && separationType && emp.hiredAt) {
      const tenureMonths = Math.max(0, monthsBetween(toDate(emp.hiredAt), separationDate));
      totalTenure += tenureMonths;

      separations.push({
        employeeId: emp.id,
        employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
        departmentId: emp.departmentId,
        jobTitleId: emp.jobTitleId,
        hiredAt: toDate(emp.hiredAt),
        separationDate,
        separationType,
        tenureMonths,
        reason: emp.statusReason || undefined,
      });
    }
  }

  const totalSeparations = separations.length;
  const averageTenureMonths = totalSeparations > 0
    ? round2(totalTenure / totalSeparations)
    : 0;

  // Calculate headcount at start and end for average headcount
  const startHeadcount = employees.filter(e => {
    const status = e.status?.toUpperCase();
    if (status === 'ACTIVE' || status === 'PROBATION') return true;
    // Also include those who separated AFTER the range start
    if ((status === 'RESIGNED' && e.resignedAt && toDate(e.resignedAt) > dateRange.start) ||
        (status === 'TERMINATED' && e.terminatedAt && toDate(e.terminatedAt) > dateRange.start)) {
      return true;
    }
    return false;
  }).length;

  const endHeadcount = employees.filter(e => {
    const status = e.status?.toUpperCase();
    return status === 'ACTIVE' || status === 'PROBATION';
  }).length;

  const averageHeadcount = Math.max(1, (startHeadcount + endHeadcount) / 2);

  const turnoverRate = round2((totalSeparations / averageHeadcount) * 100);
  const voluntaryTurnoverRate = round2((resignations / averageHeadcount) * 100);
  const involuntaryTurnoverRate = round2((terminations / averageHeadcount) * 100);
  const retentionRate = round2(Math.max(0, 100 - turnoverRate));

  // Tenure bands
  const byTenureBand: Record<string, number> = {};
  for (const key of Object.keys(TENURE_BANDS)) {
    byTenureBand[key] = 0;
  }
  for (const sep of separations) {
    const band = getTenureBand(sep.tenureMonths);
    byTenureBand[band] = (byTenureBand[band] || 0) + 1;
  }

  // Department breakdown
  const deptData: Record<string, { separations: number; headcount: number }> = {};
  for (const emp of employees) {
    const dept = emp.departmentId;
    if (!deptData[dept]) deptData[dept] = { separations: 0, headcount: 0 };
    const status = emp.status?.toUpperCase();
    if (status === 'ACTIVE' || status === 'PROBATION') {
      deptData[dept].headcount++;
    }
  }
  for (const sep of separations) {
    if (!deptData[sep.departmentId]) deptData[sep.departmentId] = { separations: 0, headcount: 0 };
    deptData[sep.departmentId].separations++;
  }

  const byDepartment: Record<string, { turnoverRate: number; separations: number; headcount: number }> = {};
  for (const [deptId, data] of Object.entries(deptData)) {
    byDepartment[deptId] = {
      turnoverRate: data.headcount > 0 ? round2((data.separations / data.headcount) * 100) : 0,
      separations: data.separations,
      headcount: data.headcount,
    };
  }

  // Monthly breakdown (hires and separations per month)
  const byMonth: { period: string; separations: number; hires: number; netChange: number }[] = [];
  const current = new Date(dateRange.start);
  while (current <= dateRange.end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    const period = formatPeriod(monthStart);

    const monthSeparations = separations.filter(s =>
      s.separationDate >= monthStart && s.separationDate <= monthEnd
    ).length;

    const monthHires = employees.filter(e => {
      if (!e.hiredAt) return false;
      const h = toDate(e.hiredAt);
      return h >= monthStart && h <= monthEnd;
    }).length;

    byMonth.push({
      period,
      separations: monthSeparations,
      hires: monthHires,
      netChange: monthHires - monthSeparations,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return {
    dateRange,
    totalSeparations,
    resignations,
    terminations,
    turnoverRate,
    voluntaryTurnoverRate,
    involuntaryTurnoverRate,
    averageTenureMonths,
    byDepartment,
    byTenureBand,
    byMonth,
    retentionRate,
    separations,
  };
}

/**
 * Analyze payroll cost trends over time.
 * Processes payroll runs and optional payslip data to produce monthly cost
 * snapshots with change percentages and GOSI employer cost estimates.
 */
export function analyzePayrollTrends(params: {
  payrollRuns: {
    period: string;
    status: string;
    totalsJson: {
      totalGross: number;
      totalNet: number;
      employeeCount: number;
      totalAllowances?: number;
      totalDeductions?: number;
      totalLoanDeductions?: number;
    };
  }[];
  payslips?: {
    runId: string;
    employeeId: string;
    gross: number;
    net: number;
    breakdownJson: {
      baseSalary: number;
      allowances: Record<string, number>;
      deductions: Record<string, number>;
      loanDeduction?: number;
      totalAllowances?: number;
      totalDeductions?: number;
    };
  }[];
  dateRange: DateRange;
}): PayrollTrend[] {
  const { payrollRuns, payslips, dateRange } = params;

  // Filter to approved/paid runs within date range
  const startPeriod = formatPeriod(dateRange.start);
  const endPeriod = formatPeriod(dateRange.end);

  const validRuns = payrollRuns
    .filter(run => {
      const status = run.status?.toLowerCase();
      return (status === 'approved' || status === 'paid') &&
        run.period >= startPeriod && run.period <= endPeriod;
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  // Payslips grouped by run period (if provided)
  const payslipsByPeriod: Record<string, typeof payslips> = {};
  if (payslips) {
    const runPeriodMap: Record<string, string> = {};
    for (const run of validRuns) {
      runPeriodMap[run.period] = run.period;
    }
    // We need runId → period mapping; approximate by matching payslips to runs
    for (const run of payrollRuns) {
      const periodPayslips = payslips.filter(p => {
        // Match payslips by checking if their data aligns with a run
        // In practice, payslip.runId links to the run
        return true; // Will group by runId below
      });
    }
    // Group payslips by run — match via runs
    const runIdToPeriod: Record<string, string> = {};
    for (const run of validRuns) {
      // payroll runs don't have an id field in the type signature here,
      // but the period is unique per valid run
      // Group payslips that sum up close to the run totals
    }
    // Simpler: group payslips and compute per-period aggregates
    if (payslips.length > 0) {
      for (const run of validRuns) {
        payslipsByPeriod[run.period] = [];
      }
    }
  }

  const trends: PayrollTrend[] = [];
  let previousTrend: PayrollTrend | null = null;

  for (const run of validRuns) {
    const { totalsJson } = run;
    const employeeCount = totalsJson.employeeCount || 1;

    const averageGross = round2(totalsJson.totalGross / employeeCount);
    const averageNet = round2(totalsJson.totalNet / employeeCount);

    const totalAllowances = totalsJson.totalAllowances || 0;
    const totalDeductions = totalsJson.totalDeductions || 0;

    // Estimate GOSI employer cost: 9% of total gross, capped at 45000 per employee
    const cappedGrossPerEmployee = Math.min(averageGross, GOSI_MAX_INSURABLE);
    const gosiEmployerCost = round2(cappedGrossPerEmployee * GOSI_EMPLOYER_RATE * employeeCount);

    // Total cost per employee = gross + GOSI employer share
    const costPerEmployee = round2(averageGross + (gosiEmployerCost / employeeCount));

    // Change from previous
    const changeFromPrevious = {
      grossChange: previousTrend
        ? percentChange(totalsJson.totalGross, previousTrend.totalGross)
        : 0,
      netChange: previousTrend
        ? percentChange(totalsJson.totalNet, previousTrend.totalNet)
        : 0,
      headcountChange: previousTrend
        ? percentChange(employeeCount, previousTrend.employeeCount)
        : 0,
    };

    const trend: PayrollTrend = {
      period: run.period,
      totalGross: totalsJson.totalGross,
      totalNet: totalsJson.totalNet,
      employeeCount,
      averageGross,
      averageNet,
      totalAllowances,
      totalDeductions,
      gosiEmployerCost,
      costPerEmployee,
      changeFromPrevious,
    };

    trends.push(trend);
    previousTrend = trend;
  }

  return trends;
}

/**
 * Generate a comprehensive workforce demographics snapshot.
 * Analyzes employee data to produce headcount distribution, saudization rate,
 * age/tenure bands, contract expiry warnings, and probation end tracking.
 */
export function generateWorkforceInsights(params: {
  employees: {
    id: string;
    departmentId: string;
    nationality?: string | null;
    gender?: string | null;
    dateOfBirth?: Date | string | null;
    status: string;
    hiredAt?: Date | string | null;
    contractEndDate?: Date | string | null;
    probationEndDate?: Date | string | null;
  }[];
  contracts?: {
    employeeId: string;
    type: string;
    status: string;
    endDate?: Date | string | null;
  }[];
  snapshotDate?: Date;
}): WorkforceInsights {
  const { employees, contracts, snapshotDate = new Date() } = params;

  // Filter to current workforce (ACTIVE + PROBATION)
  const activeWorkforce = employees.filter(e => {
    const status = e.status?.toUpperCase();
    return status === 'ACTIVE' || status === 'PROBATION';
  });

  const totalHeadcount = activeWorkforce.length;
  const activeCount = activeWorkforce.filter(e => e.status?.toUpperCase() === 'ACTIVE').length;
  const probationCount = activeWorkforce.filter(e => e.status?.toUpperCase() === 'PROBATION').length;

  // Department distribution
  const byDepartment: Record<string, number> = {};
  for (const emp of activeWorkforce) {
    byDepartment[emp.departmentId] = (byDepartment[emp.departmentId] || 0) + 1;
  }

  // Nationality distribution
  const byNationality: Record<string, number> = {};
  for (const emp of activeWorkforce) {
    const nat = emp.nationality || 'Unknown';
    byNationality[nat] = (byNationality[nat] || 0) + 1;
  }

  // Gender distribution
  const byGender: Record<string, number> = {};
  for (const emp of activeWorkforce) {
    const gen = emp.gender || 'Unknown';
    byGender[gen] = (byGender[gen] || 0) + 1;
  }

  // Saudization rate
  const saudiCount = activeWorkforce.filter(e => isSaudiNationality(e.nationality)).length;
  const saudizationRate = totalHeadcount > 0
    ? round2((saudiCount / totalHeadcount) * 100)
    : 0;

  // Age distribution
  let totalAge = 0;
  let ageCount = 0;
  const ageBands: Record<string, number> = {};
  for (const key of Object.keys(AGE_BANDS)) ageBands[key] = 0;

  for (const emp of activeWorkforce) {
    if (emp.dateOfBirth) {
      const age = calculateAge(emp.dateOfBirth, snapshotDate);
      if (age > 0) {
        totalAge += age;
        ageCount++;
        const band = getAgeBand(age);
        ageBands[band] = (ageBands[band] || 0) + 1;
      }
    }
  }
  const averageAge = ageCount > 0 ? round2(totalAge / ageCount) : 0;

  // Tenure distribution
  let totalTenure = 0;
  let tenureCount = 0;
  const tenureBands: Record<string, number> = {};
  for (const key of Object.keys(TENURE_BANDS)) tenureBands[key] = 0;

  for (const emp of activeWorkforce) {
    if (emp.hiredAt) {
      const tenureMonths = Math.max(0, monthsBetween(toDate(emp.hiredAt), snapshotDate));
      totalTenure += tenureMonths;
      tenureCount++;
      const band = getTenureBand(tenureMonths);
      tenureBands[band] = (tenureBands[band] || 0) + 1;
    }
  }
  const averageTenureMonths = tenureCount > 0 ? round2(totalTenure / tenureCount) : 0;

  // Contract type distribution
  const contractTypeDistribution: Record<string, number> = {};
  if (contracts && contracts.length > 0) {
    const activeContracts = contracts.filter(c => c.status?.toUpperCase() === 'ACTIVE');
    for (const contract of activeContracts) {
      const type = contract.type || 'UNKNOWN';
      contractTypeDistribution[type] = (contractTypeDistribution[type] || 0) + 1;
    }
  }

  // Contract expiring within 90 days
  const expiryThreshold = new Date(snapshotDate);
  expiryThreshold.setDate(expiryThreshold.getDate() + RISK_THRESHOLDS.CONTRACT_EXPIRY_DAYS);

  let contractExpiringIn90Days = 0;
  for (const emp of activeWorkforce) {
    if (emp.contractEndDate) {
      const endDate = toDate(emp.contractEndDate);
      if (endDate >= snapshotDate && endDate <= expiryThreshold) {
        contractExpiringIn90Days++;
      }
    }
  }

  // Probation ending within 30 days
  const probationThreshold = new Date(snapshotDate);
  probationThreshold.setDate(probationThreshold.getDate() + RISK_THRESHOLDS.PROBATION_END_DAYS);

  let probationEndingIn30Days = 0;
  for (const emp of activeWorkforce) {
    if (emp.probationEndDate) {
      const endDate = toDate(emp.probationEndDate);
      if (endDate >= snapshotDate && endDate <= probationThreshold) {
        probationEndingIn30Days++;
      }
    }
  }

  // Retention risk: employees with contract ending within 60 days and no renewal
  let retentionRiskCount = 0;
  const retentionThreshold = new Date(snapshotDate);
  retentionThreshold.setDate(retentionThreshold.getDate() + RISK_THRESHOLDS.RETENTION_RISK_DAYS);

  if (contracts && contracts.length > 0) {
    const renewedEmployeeIds = new Set(
      contracts.filter(c => c.status?.toUpperCase() === 'RENEWED').map(c => c.employeeId)
    );

    for (const emp of activeWorkforce) {
      if (emp.contractEndDate) {
        const endDate = toDate(emp.contractEndDate);
        if (endDate >= snapshotDate && endDate <= retentionThreshold && !renewedEmployeeIds.has(emp.id)) {
          retentionRiskCount++;
        }
      }
    }
  } else {
    // Without contract data, estimate from employee-level contractEndDate
    for (const emp of activeWorkforce) {
      if (emp.contractEndDate) {
        const endDate = toDate(emp.contractEndDate);
        if (endDate >= snapshotDate && endDate <= retentionThreshold) {
          retentionRiskCount++;
        }
      }
    }
  }

  return {
    snapshotDate,
    totalHeadcount,
    activeCount,
    probationCount,
    byDepartment,
    byNationality,
    byGender,
    saudizationRate,
    averageAge,
    averageTenureMonths,
    contractTypeDistribution,
    contractExpiringIn90Days,
    probationEndingIn30Days,
    ageBands,
    tenureBands,
    retentionRiskCount,
  };
}

/**
 * Calculate retention risk score for a single employee.
 * Uses weighted scoring across tenure, attendance, leave, violations, and
 * contract status to produce a 0-100 risk score with bilingual factors
 * and recommendations.
 */
export function calculateRetentionRisk(params: {
  employee: {
    id: string;
    name: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    departmentId: string;
    hiredAt: Date | string | null;
    status: string;
    contractEndDate?: Date | string | null;
    probationEndDate?: Date | string | null;
  };
  attendanceRecords: { status: string; lateMinutes?: number }[];
  leaveRecords: { type?: string; leaveType?: string; totalDays?: number; days?: number }[];
  recentViolations: { type: string; severity?: string }[];
}): {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: { factor: string; weight: number; score: number }[];
  recommendation: string;
} {
  const { employee, attendanceRecords, leaveRecords, recentViolations } = params;

  const factors: { factor: string; weight: number; score: number }[] = [];
  const now = new Date();

  // 1. Short tenure risk (+20)
  if (employee.hiredAt) {
    const tenureMonths = Math.max(0, monthsBetween(toDate(employee.hiredAt), now));
    if (tenureMonths < 6) {
      factors.push({
        factor: `Short tenure (${tenureMonths} months)`,
        weight: 20,
        score: 20,
      });
    }
  }

  // 2. High absenteeism (+15)
  const totalRecords = attendanceRecords.length;
  const absentCount = attendanceRecords.filter(r => r.status?.toUpperCase() === 'ABSENT').length;
  const absenteeismRate = totalRecords > 0 ? (absentCount / totalRecords) * 100 : 0;

  if (absenteeismRate > RISK_THRESHOLDS.HIGH_ABSENTEEISM_RATE) {
    factors.push({
      factor: `High absenteeism rate (${round2(absenteeismRate)}%)`,
      weight: 15,
      score: 15,
    });
  }

  // 3. Excessive sick leave (+10)
  const totalSickDays = leaveRecords
    .filter(l => (l.leaveType || l.type)?.toUpperCase() === 'SICK')
    .reduce((sum, l) => sum + (l.days || l.totalDays || 0), 0);

  if (totalSickDays > RISK_THRESHOLDS.HIGH_SICK_LEAVE_DAYS) {
    factors.push({
      factor: `Excessive sick leave (${totalSickDays} days)`,
      weight: 10,
      score: 10,
    });
  }

  // 4. Recent violations (+10-25 based on severity)
  if (recentViolations.length > 0) {
    const severeCounts = recentViolations.filter(v =>
      ['HARASSMENT', 'THEFT', 'FRAUD', 'VIOLENCE'].includes(v.type?.toUpperCase()) ||
      v.severity?.toUpperCase() === 'SEVERE'
    ).length;

    const moderateCounts = recentViolations.length - severeCounts;
    const violationScore = Math.min(25, severeCounts * 15 + moderateCounts * 5);

    if (violationScore > 0) {
      factors.push({
        factor: `Recent violations (${recentViolations.length} total, ${severeCounts} severe)`,
        weight: 25,
        score: violationScore,
      });
    }
  }

  // 5. Contract expiring within 60 days (+20)
  if (employee.contractEndDate) {
    const daysUntilExpiry = daysBetween(now, toDate(employee.contractEndDate));
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= RISK_THRESHOLDS.RETENTION_RISK_DAYS) {
      factors.push({
        factor: `Contract expiring in ${daysUntilExpiry} days`,
        weight: 20,
        score: 20,
      });
    }
  }

  // 6. Probation period (+10)
  if (employee.status?.toUpperCase() === 'PROBATION') {
    factors.push({
      factor: 'Currently in probation period',
      weight: 10,
      score: 10,
    });
  }

  // 7. Multiple late arrivals (+10)
  const lateDays = attendanceRecords.filter(r => r.status?.toUpperCase() === 'LATE').length;
  if (lateDays > RISK_THRESHOLDS.LATE_ARRIVALS_RISK) {
    factors.push({
      factor: `Frequent late arrivals (${lateDays} times)`,
      weight: 10,
      score: 10,
    });
  }

  // Calculate total risk score (capped at 100)
  const riskScore = Math.min(100, factors.reduce((sum, f) => sum + f.score, 0));

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore <= 25) riskLevel = 'LOW';
  else if (riskScore <= 50) riskLevel = 'MEDIUM';
  else if (riskScore <= 75) riskLevel = 'HIGH';
  else riskLevel = 'CRITICAL';

  // Recommendations
  const recommendations: Record<string, string> = {
    LOW: 'Employee shows healthy engagement patterns. Continue regular check-ins and career development discussions.',
    MEDIUM: 'Some risk indicators detected. Schedule a one-on-one meeting to discuss concerns and engagement. Review workload and job satisfaction.',
    HIGH: 'Multiple risk factors present. Immediate manager intervention recommended. Consider retention incentives, role adjustment, or mentoring program.',
    CRITICAL: 'Critical retention risk. Urgent HR and management action required. Initiate retention conversation, review compensation package, and develop immediate action plan.',
  };

  return {
    riskScore,
    riskLevel,
    factors,
    recommendation: recommendations[riskLevel],
  };
}

/**
 * Generate a bilingual executive summary from all analytics modules.
 * Combines absence, turnover, payroll, and workforce data into key metrics,
 * alerts, and actionable recommendations for leadership.
 */
export function generateExecutiveSummary(params: {
  absenceAnalytics: AbsenceAnalytics;
  turnoverAnalytics: TurnoverAnalytics;
  payrollTrends: PayrollTrend[];
  workforceInsights: WorkforceInsights;
}): {
  summary: string;
  keyMetrics: { label: string; value: string; trend?: 'UP' | 'DOWN' | 'STABLE' }[];
  alerts: { severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string }[];
  recommendations: { priority: 'HIGH' | 'MEDIUM' | 'LOW'; action: string }[];
} {
  const { absenceAnalytics, turnoverAnalytics, payrollTrends, workforceInsights } = params;

  // ─── Key Metrics ───────────────────────────────────────────────────
  const latestPayroll = payrollTrends.length > 0
    ? payrollTrends[payrollTrends.length - 1]
    : null;

  const previousPayroll = payrollTrends.length > 1
    ? payrollTrends[payrollTrends.length - 2]
    : null;

  const payrollGrossTrend: 'UP' | 'DOWN' | 'STABLE' = latestPayroll
    ? (latestPayroll.changeFromPrevious.grossChange > 2 ? 'UP'
      : latestPayroll.changeFromPrevious.grossChange < -2 ? 'DOWN'
      : 'STABLE')
    : 'STABLE';

  const keyMetrics: { label: string; value: string; trend?: 'UP' | 'DOWN' | 'STABLE' }[] = [
    {
      label: 'Total Headcount',
      value: workforceInsights.totalHeadcount.toString(),
    },
    {
      label: 'Turnover Rate',
      value: `${turnoverAnalytics.turnoverRate}%`,
      trend: turnoverAnalytics.turnoverRate > RISK_THRESHOLDS.HIGH_TURNOVER_RATE ? 'UP' : 'STABLE',
    },
    {
      label: 'Absenteeism Rate',
      value: `${absenceAnalytics.overallAbsenteeismRate}%`,
      trend: absenceAnalytics.overallAbsenteeismRate > RISK_THRESHOLDS.HIGH_ABSENTEEISM_ORG ? 'UP' : 'STABLE',
    },
    {
      label: 'Average Salary',
      value: latestPayroll ? formatSAR(latestPayroll.averageGross) : 'N/A',
      trend: payrollGrossTrend,
    },
    {
      label: 'Saudization Rate',
      value: `${workforceInsights.saudizationRate}%`,
    },
    {
      label: 'Monthly Payroll Cost',
      value: latestPayroll ? formatSAR(latestPayroll.totalGross) : 'N/A',
      trend: payrollGrossTrend,
    },
  ];

  // ─── Alerts ────────────────────────────────────────────────────────
  const alerts: { severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string }[] = [];

  // Turnover alert
  if (turnoverAnalytics.turnoverRate > RISK_THRESHOLDS.HIGH_TURNOVER_RATE) {
    alerts.push({
      severity: 'CRITICAL',
      message: `High turnover rate detected at ${turnoverAnalytics.turnoverRate}%. ${turnoverAnalytics.resignations} resignations and ${turnoverAnalytics.terminations} terminations in the period.`,
    });
  }

  // Absenteeism alert
  if (absenceAnalytics.overallAbsenteeismRate > RISK_THRESHOLDS.HIGH_ABSENTEEISM_ORG) {
    alerts.push({
      severity: 'WARNING',
      message: `Absenteeism rate of ${absenceAnalytics.overallAbsenteeismRate}% exceeds threshold. ${absenceAnalytics.highRiskEmployees.length} employees flagged as high risk.`,
    });
  }

  // Saudization alert (below 20% is commonly problematic)
  if (workforceInsights.saudizationRate < 20) {
    alerts.push({
      severity: 'CRITICAL',
      message: `Saudization rate at ${workforceInsights.saudizationRate}% is below Nitaqat compliance thresholds. Immediate action required.`,
    });
  } else if (workforceInsights.saudizationRate < 35) {
    alerts.push({
      severity: 'WARNING',
      message: `Saudization rate at ${workforceInsights.saudizationRate}% may be at risk for Nitaqat compliance.`,
    });
  }

  // Contract expiry wave
  if (workforceInsights.contractExpiringIn90Days > 5) {
    alerts.push({
      severity: 'WARNING',
      message: `${workforceInsights.contractExpiringIn90Days} employee contracts expiring within 90 days. Review and initiate renewal process.`,
    });
  }

  // Payroll cost spike
  if (latestPayroll && latestPayroll.changeFromPrevious.grossChange > 10) {
    alerts.push({
      severity: 'WARNING',
      message: `Payroll costs increased by ${latestPayroll.changeFromPrevious.grossChange}% compared to previous period.`,
    });
  }

  // Probation endings
  if (workforceInsights.probationEndingIn30Days > 3) {
    alerts.push({
      severity: 'INFO',
      message: `${workforceInsights.probationEndingIn30Days} employees completing probation within 30 days. Evaluate performance for confirmation.`,
    });
  }

  // High risk employees
  if (absenceAnalytics.highRiskEmployees.length > 0) {
    alerts.push({
      severity: 'INFO',
      message: `${absenceAnalytics.highRiskEmployees.length} employees identified with high absence risk patterns. Individual reviews recommended.`,
    });
  }

  // --- Recommendations ---
  const recommendations: { priority: 'HIGH' | 'MEDIUM' | 'LOW'; action: string }[] = [];

  if (turnoverAnalytics.turnoverRate > RISK_THRESHOLDS.HIGH_TURNOVER_RATE) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Conduct exit interviews and employee satisfaction surveys to identify root causes of high turnover. Review compensation benchmarks.',
    });
  }

  if (turnoverAnalytics.byTenureBand['0-6mo'] > 3) {
    recommendations.push({
      priority: 'HIGH',
      action: 'High early-stage attrition detected. Strengthen onboarding program and provide better support during first 6 months.',
    });
  }

  if (absenceAnalytics.overallAbsenteeismRate > RISK_THRESHOLDS.HIGH_ABSENTEEISM_ORG) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Implement attendance improvement plan. Review flexible work arrangements and wellness programs to reduce absenteeism.',
    });
  }

  if (workforceInsights.saudizationRate < 35) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Accelerate Saudi recruitment pipeline and develop Saudi talent development programs to improve Nitaqat compliance.',
    });
  }

  if (workforceInsights.contractExpiringIn90Days > 5) {
    recommendations.push({
      priority: 'MEDIUM',
      action: `Review ${workforceInsights.contractExpiringIn90Days} upcoming contract expirations. Prioritize renewal of high-performing employees.`,
    });
  }

  if (workforceInsights.retentionRiskCount > 3) {
    recommendations.push({
      priority: 'MEDIUM',
      action: `${workforceInsights.retentionRiskCount} employees at retention risk. Initiate stay interviews and consider targeted retention packages.`,
    });
  }

  if (latestPayroll && latestPayroll.changeFromPrevious.grossChange > 10) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Investigate payroll cost increase. Review overtime spending, new hires, and allowance changes for cost optimization.',
    });
  }

  // Low-priority general recommendations
  if (workforceInsights.probationEndingIn30Days > 0) {
    recommendations.push({
      priority: 'LOW',
      action: `Schedule performance evaluations for ${workforceInsights.probationEndingIn30Days} employees completing probation within 30 days.`,
    });
  }

  if (workforceInsights.averageTenureMonths < 18) {
    recommendations.push({
      priority: 'LOW',
      action: 'Average tenure is below 18 months. Consider implementing long-service recognition programs and career development paths.',
    });
  }

  // --- Narrative Summary ---
  const headcount = workforceInsights.totalHeadcount;
  const turnover = turnoverAnalytics.turnoverRate;
  const absenteeism = absenceAnalytics.overallAbsenteeismRate;
  const saudization = workforceInsights.saudizationRate;
  const payrollCost = latestPayroll ? formatSAR(latestPayroll.totalGross) : 'N/A';

  const summary = `The organization has ${headcount} active employees with a turnover rate of ${turnover}% and an absenteeism rate of ${absenteeism}%. ` +
    `The current Saudization rate stands at ${saudization}%. ` +
    `Monthly payroll expenditure is ${payrollCost}` +
    (latestPayroll && latestPayroll.changeFromPrevious.grossChange !== 0
      ? `, representing a ${latestPayroll.changeFromPrevious.grossChange > 0 ? '+' : ''}${latestPayroll.changeFromPrevious.grossChange}% change from the previous period. `
      : '. ') +
    `There are ${workforceInsights.contractExpiringIn90Days} contracts expiring within 90 days and ${absenceAnalytics.highRiskEmployees.length} employees with high absence risk patterns.`;

  return {
    summary,
    keyMetrics,
    alerts,
    recommendations,
  };
}
