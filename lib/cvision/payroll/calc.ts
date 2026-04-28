// lib/cvision/payroll/calc.ts
// Payroll calculator — updated to include all deductions

import { calculateFullPayroll, PayrollCalculation } from './calculator';
import { PenaltyType } from '../violations';

/**
 * Calculate payslip (backward compatibility wrapper)
 */
export function calculatePayslip(
  profile: {
    baseSalary: number | string;
    // PG returns column name 'allowances'/'deductions', code uses 'allowancesJson'/'deductionsJson'
    allowancesJson?: Record<string, number>;
    deductionsJson?: Record<string, number>;
    allowances?: Record<string, number>;
    deductions?: Record<string, number>;
  },
  loan?: { monthlyInstalment?: number; status?: string } | null,
  // Additional data for the full calculator
  attendanceData?: {
    totalLateMinutes?: number;
    totalEarlyLeaveMinutes?: number;
    absentDays?: number;
    overtimeMinutes?: number;
    workingDays?: number;
    presentDays?: number;
  },
  leavesData?: {
    unpaidLeaveDays?: number;
    sickLeaveDays?: number;
    sickLeaveDaysUsedThisYear?: number;
  },
  violationsData?: {
    violations?: Array<{
      id: string;
      type: string;
      penalty: PenaltyType;
      penaltyAmount?: number;
      penaltyDays?: number;
    }>;
  },
  settings?: {
    includeGOSI?: boolean;
    gosiIncludeHazard?: boolean;
    workingDaysPerMonth?: number;
    overtimeEnabled?: boolean;
    maxMonthlyDeduction?: number;
  }
) {
  // Handle both PG column names (allowances/deductions) and code field names (allowancesJson/deductionsJson)
  const allowances: Record<string, number> = profile.allowancesJson || (profile as Record<string, unknown>).allowances as Record<string, number> || {};
  const deductions: Record<string, number> = profile.deductionsJson || (profile as Record<string, unknown>).deductions as Record<string, number> || {};
  // PG Decimal columns return as strings — coerce baseSalary to number
  const baseSalary = Number(profile.baseSalary) || 0;

  // Extract allowances
  const housingAllowance = allowances.housing || allowances.housingAllowance || 0;
  const transportAllowance = allowances.transport || allowances.transportAllowance || 0;
  const foodAllowance = allowances.food || allowances.foodAllowance || 0;
  const phoneAllowance = allowances.phone || allowances.phoneAllowance || 0;
  const otherAllowances = Object.entries(allowances)
    .filter(([key]) => !['housing', 'housingAllowance', 'transport', 'transportAllowance', 'food', 'foodAllowance', 'phone', 'phoneAllowance'].includes(key))
    .reduce((sum, [, val]) => sum + (Number(val) || 0), 0);

  // Loan deduction
  const loanDeduction = loan?.status === 'ACTIVE' ? (loan.monthlyInstalment || 0) : 0;

  // If additional data is provided, use the full calculator
  if (attendanceData || leavesData || violationsData || settings?.includeGOSI) {
    const fullCalc = calculateFullPayroll(
      'temp',
      new Date().getMonth() + 1,
      new Date().getFullYear(),
      {
        basicSalary: baseSalary,
        housingAllowance,
        transportAllowance,
        foodAllowance,
        phoneAllowance,
        otherAllowances,
      },
      {
        totalLateMinutes: attendanceData?.totalLateMinutes || 0,
        totalEarlyLeaveMinutes: attendanceData?.totalEarlyLeaveMinutes || 0,
        absentDays: attendanceData?.absentDays || 0,
        overtimeMinutes: attendanceData?.overtimeMinutes || 0,
        workingDays: attendanceData?.workingDays || settings?.workingDaysPerMonth || 22,
        presentDays: attendanceData?.presentDays || 22,
      },
      {
        unpaidLeaveDays: leavesData?.unpaidLeaveDays || 0,
        sickLeaveDays: leavesData?.sickLeaveDays || 0,
        sickLeaveDaysUsedThisYear: leavesData?.sickLeaveDaysUsedThisYear || 0,
      },
      {
        violations: violationsData?.violations || [],
      },
      {
        activeLoanInstallment: loanDeduction,
        advanceDeduction: 0,
      },
      {
        includeGOSI: settings?.includeGOSI ?? true,
        gosiIncludeHazard: settings?.gosiIncludeHazard ?? false,
        workingDaysPerMonth: settings?.workingDaysPerMonth ?? 22,
        overtimeEnabled: settings?.overtimeEnabled ?? true,
        maxMonthlyDeduction: settings?.maxMonthlyDeduction ?? 0.5,
      }
    );

    return {
      gross: fullCalc.earnings.totalEarnings,
      net: fullCalc.netSalary,
      breakdown: {
        baseSalary,
        allowances: {
          housing: housingAllowance,
          transport: transportAllowance,
          food: foodAllowance,
          phone: phoneAllowance,
          other: otherAllowances,
        },
        deductions: {
          gosi: fullCalc.deductions.gosi.employeeContribution,
          attendance: fullCalc.deductions.attendance.totalAttendanceDeduction,
          leaves: fullCalc.deductions.leaves.totalLeaveDeduction,
          violations: fullCalc.deductions.violations.totalViolationDeduction,
          loans: fullCalc.deductions.loans.totalLoanDeduction,
          ...deductions,
        },
        overtime: fullCalc.earnings.overtimePay,
        totalAllowances: fullCalc.earnings.totalEarnings - baseSalary,
        totalDeductions: fullCalc.deductions.totalDeductions,
        gross: fullCalc.earnings.totalEarnings,
        net: fullCalc.netSalary,
        employerCost: fullCalc.employerCost.totalCost,
      },
      fullCalculation: fullCalc,
    };
  }

  // Simple calculation (backward compatibility)
  const totalAllowances = Object.values(allowances).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalDeductions = Object.values(deductions).reduce((s, v) => s + (Number(v) || 0), 0);

  const gross = baseSalary + totalAllowances;
  const net = Math.max(0, gross - totalDeductions - loanDeduction);

  return {
    gross,
    net,
    breakdown: {
      baseSalary,
      allowances,
      deductions,
      loanDeduction: loanDeduction > 0 ? loanDeduction : undefined,
      totalAllowances,
      totalDeductions,
      gross,
      net,
    },
  };
}
