// lib/cvision/leaves.ts
// Leave management per Saudi Labor Law

export const SAUDI_LEAVE_ENTITLEMENTS = {
  // Annual leave
  ANNUAL: {
    lessThan5Years: 21,  // 21 days for less than 5 years of service
    moreThan5Years: 30,  // 30 days for 5+ years of service
  },
  // Special leaves (paid)
  MARRIAGE: 5,           // Employee marriage
  PATERNITY: 3,          // New child birth
  BEREAVEMENT: 5,        // Death of spouse/parent/child
  MATERNITY: 70,         // Maternity leave (10 weeks)
  HAJJ: 10,              // Hajj pilgrimage (once during service)
  EXAM: 0,               // Exam days (as needed)
  // Other leaves
  SICK_PAID_FULL: 30,    // Sick leave fully paid
  SICK_PAID_75: 60,      // Sick leave at 75%
  SICK_UNPAID: 30,       // Sick leave unpaid
} as const;

export interface LeaveEntitlement {
  type: string;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
  carriedOver: number;
}

export interface LeaveBalanceSummary {
  year: number;
  employeeId: string;
  yearsOfService: number;
  balances: LeaveEntitlement[];
  totalEntitled: number;
  totalUsed: number;
  totalRemaining: number;
}

/**
 * Calculate annual leave entitlement
 */
export function calculateAnnualEntitlement(
  yearsOfService: number
): number {
  if (yearsOfService >= 5) {
    return SAUDI_LEAVE_ENTITLEMENTS.ANNUAL.moreThan5Years;
  }
  return SAUDI_LEAVE_ENTITLEMENTS.ANNUAL.lessThan5Years;
}

/**
 * Calculate leave days between two dates
 * excluding Friday (weekly rest day)
 */
export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  excludeFridays: boolean = true,
  excludeHolidays: string[] = [] // Official holiday dates
): { totalDays: number; workingDays: number; weekends: number; holidays: number } {
  let totalDays = 0;
  let workingDays = 0;
  let weekends = 0;
  let holidays = 0;

  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    totalDays++;

    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Friday = 5, Saturday = 6
    if (excludeFridays && (dayOfWeek === 5 || dayOfWeek === 6)) {
      weekends++;
    } else if (excludeHolidays.includes(dateStr)) {
      holidays++;
    } else {
      workingDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return { totalDays, workingDays, weekends, holidays };
}

/**
 * Validate leave request
 */
export interface LeaveValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLeaveRequest(
  leaveType: string,
  startDate: Date,
  endDate: Date,
  availableBalance: number,
  requestedDays: number,
  employeeStartDate: Date,
  existingLeaves: { startDate: Date; endDate: Date }[] = []
): LeaveValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Validate dates
  if (startDate < today) {
    errors.push('Cannot request leave with a past date');
  }

  if (endDate < startDate) {
    errors.push('End date must be after start date');
  }

  // Validate balance
  if (leaveType === 'ANNUAL' && requestedDays > availableBalance) {
    errors.push(`Available balance (${availableBalance} days) is insufficient for requested leave (${requestedDays} days)`);
  }

  // Validate probation for annual leave
  const monthsOfService = Math.floor(
    (today.getTime() - employeeStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  if (leaveType === 'ANNUAL' && monthsOfService < 3) {
    errors.push('Employee is not eligible for annual leave during probation (first 3 months)');
  }

  // Check overlap with existing leaves
  for (const leave of existingLeaves) {
    const existingStart = new Date(leave.startDate);
    const existingEnd = new Date(leave.endDate);

    if (
      (startDate >= existingStart && startDate <= existingEnd) ||
      (endDate >= existingStart && endDate <= existingEnd) ||
      (startDate <= existingStart && endDate >= existingEnd)
    ) {
      errors.push('Overlaps with an existing leave request');
      break;
    }
  }

  // Warnings
  const daysUntilLeave = Math.floor(
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilLeave < 7 && leaveType === 'ANNUAL') {
    warnings.push('Annual leave requests should be submitted at least one week in advance');
  }

  if (requestedDays > 14 && leaveType === 'ANNUAL') {
    warnings.push('Leave exceeding two weeks may require additional approval');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate leave salary deduction
 */
export interface LeaveDeduction {
  leaveType: string;
  days: number;
  dailyRate: number;
  deductionPercentage: number;
  totalDeduction: number;
}

export function calculateLeaveDeduction(
  leaveType: string,
  days: number,
  basicSalary: number,
  housingAllowance: number = 0,
  sickLeaveDaysUsed: number = 0 // Sick leave days used this year
): LeaveDeduction {
  if (days < 0) throw new Error('Leave days cannot be negative');
  if (basicSalary < 0) throw new Error('Basic salary cannot be negative');
  const totalSalary = basicSalary + housingAllowance;
  const dailyRate = totalSalary > 0 ? totalSalary / 30 : 0;
  let deductionPercentage = 0;

  switch (leaveType) {
    case 'UNPAID':
      deductionPercentage = 100;
      break;

    case 'SICK':
      // First 30 days fully paid
      // Next 60 days at 75%
      // Next 30 days unpaid
      if (sickLeaveDaysUsed < 30) {
        deductionPercentage = 0;
      } else if (sickLeaveDaysUsed < 90) {
        deductionPercentage = 25;
      } else {
        deductionPercentage = 100;
      }
      break;

    case 'MATERNITY':
      // Maternity leave fully paid
      deductionPercentage = 0;
      break;

    default:
      // Other leaves are paid
      deductionPercentage = 0;
  }

  const totalDeduction = Math.round(dailyRate * days * (deductionPercentage / 100) * 100) / 100;

  return {
    leaveType,
    days,
    dailyRate: Math.round(dailyRate * 100) / 100,
    deductionPercentage,
    totalDeduction,
  };
}

/**
 * Calculate remaining leave balance
 */
export function calculateRemainingBalance(
  entitled: number,
  used: number,
  pending: number,
  carriedOver: number = 0,
  maxCarryOver: number = 15 // Maximum carry-over days
): {
  total: number;
  available: number;
  effectiveCarryOver: number;
} {
  const effectiveCarryOver = Math.min(carriedOver, maxCarryOver);
  const total = entitled + effectiveCarryOver;
  const available = total - used - pending;

  return {
    total,
    available: Math.max(0, available),
    effectiveCarryOver,
  };
}
