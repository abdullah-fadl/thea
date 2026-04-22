// lib/cvision/attendance.ts
// Attendance management per Saudi Labor Law

export const SAUDI_WORK_RULES = {
  MAX_HOURS_PER_DAY: 8,           // 8 hours per day
  MAX_HOURS_PER_WEEK: 48,         // 48 hours per week
  MAX_HOURS_RAMADAN: 6,           // 6 hours during Ramadan
  MAX_OVERTIME_PER_YEAR: 720,     // 720 overtime hours per year
  OVERTIME_RATE: 1.5,             // 150% for overtime
  FRIDAY_OVERTIME_RATE: 2.0,      // 200% for Friday work (kept for backward compat)
  REST_DAY_OVERTIME_RATE: 2.0,    // 200% for any configured rest day
  LATE_GRACE_MINUTES: 15,         // 15-minute grace period for lateness
  BREAK_MINUTES: 30,              // 30-minute break
} as const;

export interface WorkShift {
  name: string;
  startTime: string;    // "08:00"
  endTime: string;      // "17:00"
  breakMinutes: number;
  workingMinutes: number;
}

export const DEFAULT_SHIFTS: Record<string, WorkShift> = {
  MORNING: {
    name: 'Morning',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    workingMinutes: 480, // 8 hours
  },
  EVENING: {
    name: 'Evening',
    startTime: '14:00',
    endTime: '22:00',
    breakMinutes: 30,
    workingMinutes: 450,
  },
  NIGHT: {
    name: 'Night',
    startTime: '22:00',
    endTime: '06:00',
    breakMinutes: 30,
    workingMinutes: 450,
  },
  RAMADAN: {
    name: 'Ramadan',
    startTime: '10:00',
    endTime: '16:00',
    breakMinutes: 0,
    workingMinutes: 360, // 6 hours
  },
};

/**
 * Convert time string to minutes from start of day
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Lateness calculation
 */
export interface LateCalculation {
  isLate: boolean;
  lateMinutes: number;
  withinGrace: boolean;
  deductionMinutes: number;
}

export function calculateLateness(
  scheduledIn: string,
  actualIn: string,
  graceMinutes: number = SAUDI_WORK_RULES.LATE_GRACE_MINUTES
): LateCalculation {
  const scheduledMinutes = timeToMinutes(scheduledIn);
  const actualMinutes = timeToMinutes(actualIn);

  const lateMinutes = Math.max(0, actualMinutes - scheduledMinutes);
  const isLate = lateMinutes > 0;
  const withinGrace = lateMinutes <= graceMinutes;

  // Deduction starts after grace period
  const deductionMinutes = withinGrace ? 0 : lateMinutes;

  return {
    isLate,
    lateMinutes,
    withinGrace,
    deductionMinutes,
  };
}

/**
 * Early leave calculation
 */
export interface EarlyLeaveCalculation {
  isEarlyLeave: boolean;
  earlyMinutes: number;
  deductionMinutes: number;
}

export function calculateEarlyLeave(
  scheduledOut: string,
  actualOut: string
): EarlyLeaveCalculation {
  const scheduledMinutes = timeToMinutes(scheduledOut);
  const actualMinutes = timeToMinutes(actualOut);

  const earlyMinutes = Math.max(0, scheduledMinutes - actualMinutes);

  return {
    isEarlyLeave: earlyMinutes > 0,
    earlyMinutes,
    deductionMinutes: earlyMinutes,
  };
}

/**
 * Worked hours calculation
 */
export interface WorkedHoursCalculation {
  totalMinutes: number;
  totalHours: number;
  breakMinutes: number;
  netWorkingMinutes: number;
  netWorkingHours: number;
}

export function calculateWorkedHours(
  actualIn: Date,
  actualOut: Date,
  breakMinutes: number = SAUDI_WORK_RULES.BREAK_MINUTES
): WorkedHoursCalculation {
  const totalMinutes = Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60));
  const netWorkingMinutes = Math.max(0, totalMinutes - breakMinutes);

  return {
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    breakMinutes,
    netWorkingMinutes,
    netWorkingHours: Math.round((netWorkingMinutes / 60) * 100) / 100,
  };
}

/**
 * Overtime calculation
 */
export interface OvertimeCalculation {
  regularMinutes: number;
  overtimeMinutes: number;
  overtimeHours: number;
  isFridayOvertime: boolean;
  overtimeRate: number;
  overtimePay: number;
}

export function calculateOvertime(
  workedMinutes: number,
  scheduledMinutes: number,
  hourlyRate: number,
  isFriday: boolean = false
): OvertimeCalculation {
  const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);
  const overtimeHours = overtimeMinutes / 60;

  const rate = isFriday
    ? SAUDI_WORK_RULES.FRIDAY_OVERTIME_RATE
    : SAUDI_WORK_RULES.OVERTIME_RATE;

  const overtimePay = Math.round(overtimeHours * hourlyRate * rate * 100) / 100;

  return {
    regularMinutes: Math.min(workedMinutes, scheduledMinutes),
    overtimeMinutes,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    isFridayOvertime: isFriday,
    overtimeRate: rate,
    overtimePay,
  };
}

/**
 * Attendance deduction from salary
 */
export interface AttendanceDeduction {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absentDays: number;
  totalDeductionMinutes: number;
  dailyRate: number;
  minuteRate: number;
  lateDeduction: number;
  earlyLeaveDeduction: number;
  absentDeduction: number;
  totalDeduction: number;
}

export function calculateAttendanceDeduction(
  lateMinutes: number,
  earlyLeaveMinutes: number,
  absentDays: number,
  basicSalary: number,
  housingAllowance: number = 0,
  workingDaysPerMonth: number = 22
): AttendanceDeduction {
  const totalSalary = basicSalary + housingAllowance;
  const dailyRate = totalSalary / 30; // Daily rate based on 30-day month
  const hourlyRate = dailyRate / 8;
  const minuteRate = hourlyRate / 60;

  const lateDeduction = Math.round(lateMinutes * minuteRate * 100) / 100;
  const earlyLeaveDeduction = Math.round(earlyLeaveMinutes * minuteRate * 100) / 100;
  const absentDeduction = Math.round(absentDays * dailyRate * 100) / 100;

  return {
    lateMinutes,
    earlyLeaveMinutes,
    absentDays,
    totalDeductionMinutes: lateMinutes + earlyLeaveMinutes,
    dailyRate: Math.round(dailyRate * 100) / 100,
    minuteRate: Math.round(minuteRate * 100) / 100,
    lateDeduction,
    earlyLeaveDeduction,
    absentDeduction,
    totalDeduction: lateDeduction + earlyLeaveDeduction + absentDeduction,
  };
}

/**
 * Monthly attendance summary
 */
export interface MonthlyAttendanceSummary {
  month: number;
  year: number;
  employeeId: string;
  totalDays: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  leaveDays: number;
  holidayDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  totalOvertimeMinutes: number;
  totalWorkedMinutes: number;
  attendancePercentage: number;
}

export function summarizeMonthlyAttendance(
  records: {
    date: Date;
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    workedMinutes: number;
  }[],
  employeeId: string,
  month: number,
  year: number,
  workingDaysInMonth: number = 22
): MonthlyAttendanceSummary {
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let earlyLeaveDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalWorkedMinutes = 0;

  for (const record of records) {
    switch (record.status) {
      case 'PRESENT':
        presentDays++;
        break;
      case 'ABSENT':
        absentDays++;
        break;
      case 'LATE':
        presentDays++;
        lateDays++;
        break;
      case 'EARLY_LEAVE':
        presentDays++;
        earlyLeaveDays++;
        break;
      case 'ON_LEAVE':
        leaveDays++;
        break;
      case 'HOLIDAY':
        holidayDays++;
        break;
    }

    totalLateMinutes += record.lateMinutes || 0;
    totalEarlyLeaveMinutes += record.earlyLeaveMinutes || 0;
    totalOvertimeMinutes += record.overtimeMinutes || 0;
    totalWorkedMinutes += record.workedMinutes || 0;
  }

  const attendancePercentage = workingDaysInMonth > 0
    ? Math.round((presentDays / workingDaysInMonth) * 100 * 100) / 100
    : 0;

  return {
    month,
    year,
    employeeId,
    totalDays: records.length,
    workingDays: workingDaysInMonth,
    presentDays,
    absentDays,
    lateDays,
    earlyLeaveDays,
    leaveDays,
    holidayDays,
    totalLateMinutes,
    totalEarlyLeaveMinutes,
    totalOvertimeMinutes,
    totalWorkedMinutes,
    attendancePercentage,
  };
}

/**
 * Work hours violation check per Saudi Labor Law
 */
export interface WorkHoursViolation {
  hasViolation: boolean;
  violations: string[];
  dailyHours: number;
  weeklyHours: number;
  yearlyOvertimeHours: number;
}

export function checkWorkHoursViolation(
  dailyWorkedMinutes: number,
  weeklyWorkedMinutes: number,
  yearlyOvertimeMinutes: number,
  isRamadan: boolean = false
): WorkHoursViolation {
  const violations: string[] = [];

  const maxDaily = isRamadan
    ? SAUDI_WORK_RULES.MAX_HOURS_RAMADAN * 60
    : SAUDI_WORK_RULES.MAX_HOURS_PER_DAY * 60;

  const maxWeekly = SAUDI_WORK_RULES.MAX_HOURS_PER_WEEK * 60;
  const maxYearlyOvertime = SAUDI_WORK_RULES.MAX_OVERTIME_PER_YEAR * 60;

  if (dailyWorkedMinutes > maxDaily) {
    violations.push(`Daily limit exceeded: ${Math.round(dailyWorkedMinutes/60)} hours (limit: ${maxDaily/60})`);
  }

  if (weeklyWorkedMinutes > maxWeekly) {
    violations.push(`Weekly limit exceeded: ${Math.round(weeklyWorkedMinutes/60)} hours (limit: ${maxWeekly/60})`);
  }

  if (yearlyOvertimeMinutes > maxYearlyOvertime) {
    violations.push(`Yearly overtime exceeded: ${Math.round(yearlyOvertimeMinutes/60)} hours (limit: ${maxYearlyOvertime/60})`);
  }

  return {
    hasViolation: violations.length > 0,
    violations,
    dailyHours: Math.round((dailyWorkedMinutes / 60) * 100) / 100,
    weeklyHours: Math.round((weeklyWorkedMinutes / 60) * 100) / 100,
    yearlyOvertimeHours: Math.round((yearlyOvertimeMinutes / 60) * 100) / 100,
  };
}

/**
 * Build a default WorkShift from tenant work-schedule settings.
 * Falls back to DEFAULT_SHIFTS.MORNING if no settings provided.
 */
export function getDefaultShiftFromSettings(ws?: {
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultWorkingHours?: number;
  breakDurationMinutes?: number;
}): WorkShift {
  if (!ws) return DEFAULT_SHIFTS.MORNING;
  const start = ws.defaultStartTime || '08:00';
  const end = ws.defaultEndTime || '17:00';
  const workHours = ws.defaultWorkingHours || 8;
  const breakMins = ws.breakDurationMinutes ?? 60;
  return {
    name: 'Default',
    startTime: start,
    endTime: end,
    breakMinutes: breakMins,
    workingMinutes: workHours * 60,
  };
}
