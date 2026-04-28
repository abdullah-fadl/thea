// lib/cvision/payroll/calculator.ts
// Comprehensive payroll calculator — combines all deductions and earnings

import { calculateGOSI } from '../gosi';
import { calculateAttendanceDeduction, calculateOvertime } from '../attendance';
import { calculateLeaveDeduction } from '../leaves';
import { calculateViolationDeductions } from '../violations';

/**
 * Basic salary structure
 */
export interface SalaryStructure {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  phoneAllowance: number;
  otherAllowances: number;
}

/**
 * Monthly attendance data
 */
export interface MonthlyAttendanceData {
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  absentDays: number;
  overtimeMinutes: number;
  workingDays: number;
  presentDays: number;
}

/**
 * Monthly leave data
 */
export interface MonthlyLeaveData {
  unpaidLeaveDays: number;
  sickLeaveDays: number;
  sickLeaveDaysUsedThisYear: number;
}

import { PenaltyType } from '../violations';

/**
 * Monthly violation data
 */
export interface MonthlyViolationData {
  violations: {
    id: string;
    type: string;
    penalty: PenaltyType;
    penaltyAmount?: number;
    penaltyDays?: number;
  }[];
}

/**
 * Loan data
 */
export interface LoanData {
  activeLoanInstallment: number;
  advanceDeduction: number;
}

/**
 * Company settings
 */
export interface CompanySettings {
  includeGOSI: boolean;
  gosiIncludeHazard: boolean;
  workingDaysPerMonth: number;
  overtimeEnabled: boolean;
  maxMonthlyDeduction: number; // Maximum deduction ratio (fraction of salary)
}

/**
 * Comprehensive payroll calculation details
 */
export interface PayrollCalculation {
  // Basic info
  employeeId: string;
  month: number;
  year: number;

  // Gross earnings
  earnings: {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    foodAllowance: number;
    phoneAllowance: number;
    otherAllowances: number;
    overtimePay: number;
    totalEarnings: number;
  };

  // Deductions
  deductions: {
    // Attendance deductions
    attendance: {
      lateDeduction: number;
      earlyLeaveDeduction: number;
      absentDeduction: number;
      totalAttendanceDeduction: number;
    };

    // Leave deductions
    leaves: {
      unpaidLeaveDeduction: number;
      sickLeaveDeduction: number;
      totalLeaveDeduction: number;
    };

    // Violation deductions
    violations: {
      count: number;
      totalViolationDeduction: number;
      details: { type: string; amount: number }[];
    };

    // GOSI (social insurance)
    gosi: {
      employeeContribution: number;
      employerContribution: number;
      hazardContribution: number;
    };

    // Loans and advances
    loans: {
      loanInstallment: number;
      advanceDeduction: number;
      totalLoanDeduction: number;
    };

    // Total deductions
    totalDeductions: number;
  };

  // Net salary
  netSalary: number;

  // Employer cost
  employerCost: {
    totalEarnings: number;
    gosiEmployerShare: number;
    hazardInsurance: number;
    totalCost: number;
  };

  // Additional info
  metadata: {
    calculatedAt: Date;
    workingDays: number;
    presentDays: number;
    attendancePercentage: number;
    warnings: string[];
    notes: string[];
  };
}

/**
 * Main function for comprehensive payroll calculation
 */
export function calculateFullPayroll(
  employeeId: string,
  month: number,
  year: number,
  salary: SalaryStructure,
  attendance: MonthlyAttendanceData,
  leaves: MonthlyLeaveData,
  violations: MonthlyViolationData,
  loans: LoanData,
  settings: CompanySettings
): PayrollCalculation {
  const warnings: string[] = [];
  const notes: string[] = [];

  // ===============================
  // 1. Calculate Earnings
  // ===============================

  const totalBasicAllowances =
    salary.basicSalary +
    salary.housingAllowance +
    salary.transportAllowance +
    salary.foodAllowance +
    salary.phoneAllowance +
    salary.otherAllowances;

  // Calculate overtime.
  // `calculateOvertime(workedMinutes, scheduledMinutes, ...)` derives overtime
  // as max(0, workedMinutes - scheduledMinutes) internally, so we must pass
  // only the actual overtime minutes as workedMinutes and 0 as scheduled
  // minutes — NOT the full worked + scheduled total which double-counts the
  // scheduled portion.
  let overtimePay = 0;
  if (settings.overtimeEnabled && attendance.overtimeMinutes > 0) {
    const hourlyRate = (salary.basicSalary + salary.housingAllowance) / (settings.workingDaysPerMonth * 8);
    const overtimeCalc = calculateOvertime(
      attendance.overtimeMinutes, // Actual overtime minutes only
      0,                          // Scheduled minutes already excluded above
      hourlyRate,
      false
    );
    overtimePay = overtimeCalc.overtimePay;

    if (overtimePay > 0) {
      notes.push(`Overtime: ${Math.round(attendance.overtimeMinutes / 60)} hours`);
    }
  }

  const totalEarnings = totalBasicAllowances + overtimePay;

  // ===============================
  // 2. Calculate Deductions
  // ===============================

  // Guard against zero or negative salary to avoid division-by-zero and
  // nonsensical negative daily rates.
  if (salary.basicSalary < 0) throw new Error('Basic salary cannot be negative');
  const salaryBase = salary.basicSalary + salary.housingAllowance;
  if (salaryBase <= 0) {
    warnings.push('Basic salary + housing allowance is zero or negative — deductions that depend on daily rate will be zero');
  }
  const dailyRate = salaryBase > 0 ? salaryBase / 30 : 0;

  // --- Attendance deductions ---
  const attendanceDeduction = calculateAttendanceDeduction(
    attendance.totalLateMinutes,
    attendance.totalEarlyLeaveMinutes,
    attendance.absentDays,
    salary.basicSalary,
    salary.housingAllowance,
    settings.workingDaysPerMonth
  );

  if (attendanceDeduction.totalDeduction > 0) {
    if (attendance.totalLateMinutes > 0) {
      warnings.push(`Lateness: ${attendance.totalLateMinutes} minutes`);
    }
    if (attendance.absentDays > 0) {
      warnings.push(`Absence: ${attendance.absentDays} day(s)`);
    }
  }

  // --- Leave deductions ---
  const unpaidLeaveDeduction = calculateLeaveDeduction(
    'UNPAID',
    leaves.unpaidLeaveDays,
    salary.basicSalary,
    salary.housingAllowance
  );

  const sickLeaveDeduction = calculateLeaveDeduction(
    'SICK',
    leaves.sickLeaveDays,
    salary.basicSalary,
    salary.housingAllowance,
    leaves.sickLeaveDaysUsedThisYear
  );

  const totalLeaveDeduction = unpaidLeaveDeduction.totalDeduction + sickLeaveDeduction.totalDeduction;

  if (leaves.unpaidLeaveDays > 0) {
    notes.push(`Unpaid leave: ${leaves.unpaidLeaveDays} day(s)`);
  }

  // --- Violation deductions ---
  const violationDeductions = calculateViolationDeductions(violations.violations, dailyRate);

  if (violationDeductions.totalDeductionAmount > 0) {
    warnings.push(`Violations: ${violations.violations.length} violation(s)`);
  }

  // --- GOSI deductions ---
  let gosiCalc = { employeeContribution: 0, employerContribution: 0, hazardContribution: 0 };

  if (settings.includeGOSI) {
    gosiCalc = calculateGOSI(
      salary.basicSalary,
      salary.housingAllowance,
      settings.gosiIncludeHazard
    );
  }

  // --- Loan deductions ---
  const totalLoanDeduction = loans.activeLoanInstallment + loans.advanceDeduction;

  if (loans.activeLoanInstallment > 0) {
    notes.push(`Loan installment: ${loans.activeLoanInstallment} SAR`);
  }

  // ===============================
  // 3. Total Deductions
  // ===============================

  let totalDeductions =
    attendanceDeduction.totalDeduction +
    totalLeaveDeduction +
    violationDeductions.totalDeductionAmount +
    gosiCalc.employeeContribution +
    totalLoanDeduction;

  // Check maximum deduction cap (50% of salary as per Saudi Labor Law)
  const maxDeduction = totalEarnings * settings.maxMonthlyDeduction;

  if (totalDeductions > maxDeduction) {
    warnings.push(`Deductions exceed maximum (${settings.maxMonthlyDeduction * 100}%) — adjusted`);
    // Exclude GOSI from the cap since it is mandatory
    const deductionsWithoutGOSI = totalDeductions - gosiCalc.employeeContribution;
    if (deductionsWithoutGOSI > maxDeduction) {
      const ratio = maxDeduction / deductionsWithoutGOSI;
      // Reduce deductions proportionally (excluding GOSI)
      totalDeductions = maxDeduction + gosiCalc.employeeContribution;
    }
  }

  // ===============================
  // 4. Net Salary
  // ===============================

  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  // ===============================
  // 5. Employer Cost
  // ===============================

  const employerCost = {
    totalEarnings,
    gosiEmployerShare: gosiCalc.employerContribution,
    hazardInsurance: gosiCalc.hazardContribution,
    totalCost: totalEarnings + gosiCalc.employerContribution + gosiCalc.hazardContribution,
  };

  // ===============================
  // 6. Build Result
  // ===============================

  return {
    employeeId,
    month,
    year,

    earnings: {
      basicSalary: salary.basicSalary,
      housingAllowance: salary.housingAllowance,
      transportAllowance: salary.transportAllowance,
      foodAllowance: salary.foodAllowance,
      phoneAllowance: salary.phoneAllowance,
      otherAllowances: salary.otherAllowances,
      overtimePay: Math.round(overtimePay * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
    },

    deductions: {
      attendance: {
        lateDeduction: attendanceDeduction.lateDeduction,
        earlyLeaveDeduction: attendanceDeduction.earlyLeaveDeduction,
        absentDeduction: attendanceDeduction.absentDeduction,
        totalAttendanceDeduction: attendanceDeduction.totalDeduction,
      },

      leaves: {
        unpaidLeaveDeduction: unpaidLeaveDeduction.totalDeduction,
        sickLeaveDeduction: sickLeaveDeduction.totalDeduction,
        totalLeaveDeduction,
      },

      violations: {
        count: violations.violations.length,
        totalViolationDeduction: violationDeductions.totalDeductionAmount,
        details: violationDeductions.deductions.map(d => ({
          type: d.type,
          amount: d.deductionAmount,
        })),
      },

      gosi: {
        employeeContribution: gosiCalc.employeeContribution,
        employerContribution: gosiCalc.employerContribution,
        hazardContribution: gosiCalc.hazardContribution,
      },

      loans: {
        loanInstallment: loans.activeLoanInstallment,
        advanceDeduction: loans.advanceDeduction,
        totalLoanDeduction,
      },

      totalDeductions: Math.round(totalDeductions * 100) / 100,
    },

    netSalary: Math.round(netSalary * 100) / 100,

    employerCost: {
      totalEarnings: Math.round(employerCost.totalEarnings * 100) / 100,
      gosiEmployerShare: Math.round(employerCost.gosiEmployerShare * 100) / 100,
      hazardInsurance: Math.round(employerCost.hazardInsurance * 100) / 100,
      totalCost: Math.round(employerCost.totalCost * 100) / 100,
    },

    metadata: {
      calculatedAt: new Date(),
      workingDays: settings.workingDaysPerMonth,
      presentDays: attendance.presentDays,
      attendancePercentage: Math.round((attendance.presentDays / settings.workingDaysPerMonth) * 100),
      warnings,
      notes,
    },
  };
}

/**
 * Generate payslip summary for printing
 */
export function generatePayslipSummary(calc: PayrollCalculation): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════',
    '                   PAYSLIP                         ',
    '═══════════════════════════════════════════════════',
    `Month: ${calc.month}/${calc.year}`,
    `Issue Date: ${calc.metadata.calculatedAt.toLocaleDateString('en-US')}`,
    '',
    '─────────────────── EARNINGS ───────────────────',
    `Basic Salary:            ${calc.earnings.basicSalary.toLocaleString()} SAR`,
    `Housing Allowance:       ${calc.earnings.housingAllowance.toLocaleString()} SAR`,
    `Transport Allowance:     ${calc.earnings.transportAllowance.toLocaleString()} SAR`,
  ];

  if (calc.earnings.foodAllowance > 0) {
    lines.push(`Food Allowance:          ${calc.earnings.foodAllowance.toLocaleString()} SAR`);
  }
  if (calc.earnings.phoneAllowance > 0) {
    lines.push(`Phone Allowance:         ${calc.earnings.phoneAllowance.toLocaleString()} SAR`);
  }
  if (calc.earnings.otherAllowances > 0) {
    lines.push(`Other Allowances:        ${calc.earnings.otherAllowances.toLocaleString()} SAR`);
  }
  if (calc.earnings.overtimePay > 0) {
    lines.push(`Overtime Pay:            ${calc.earnings.overtimePay.toLocaleString()} SAR`);
  }

  lines.push(`                        ─────────────`);
  lines.push(`Total Earnings:          ${calc.earnings.totalEarnings.toLocaleString()} SAR`);
  lines.push('');
  lines.push('─────────────────── DEDUCTIONS ───────────────────');

  if (calc.deductions.attendance.totalAttendanceDeduction > 0) {
    lines.push(`Attendance Deduction:    ${calc.deductions.attendance.totalAttendanceDeduction.toLocaleString()} SAR`);
  }
  if (calc.deductions.leaves.totalLeaveDeduction > 0) {
    lines.push(`Leave Deduction:         ${calc.deductions.leaves.totalLeaveDeduction.toLocaleString()} SAR`);
  }
  if (calc.deductions.violations.totalViolationDeduction > 0) {
    lines.push(`Violation Deduction:     ${calc.deductions.violations.totalViolationDeduction.toLocaleString()} SAR`);
  }
  if (calc.deductions.gosi.employeeContribution > 0) {
    lines.push(`GOSI (Employee):         ${calc.deductions.gosi.employeeContribution.toLocaleString()} SAR`);
  }
  if (calc.deductions.loans.totalLoanDeduction > 0) {
    lines.push(`Loans & Advances:        ${calc.deductions.loans.totalLoanDeduction.toLocaleString()} SAR`);
  }

  lines.push(`                        ─────────────`);
  lines.push(`Total Deductions:        ${calc.deductions.totalDeductions.toLocaleString()} SAR`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════');
  lines.push(`Net Salary:              ${calc.netSalary.toLocaleString()} SAR`);
  lines.push('═══════════════════════════════════════════════════');

  if (calc.metadata.warnings.length > 0) {
    lines.push('');
    lines.push('Notes:');
    calc.metadata.warnings.forEach(w => lines.push(`  ! ${w}`));
  }

  return lines.join('\n');
}
