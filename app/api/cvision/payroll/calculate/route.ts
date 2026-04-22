import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/payroll/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  calculateFullPayroll,
  generatePayslipSummary,
  SalaryStructure,
  MonthlyAttendanceData,
  MonthlyLeaveData,
  MonthlyViolationData,
  LoanData,
  CompanySettings,
  PayrollCalculation,
} from '@/lib/cvision/payroll/calculator';
import { summarizeMonthlyAttendance } from '@/lib/cvision/attendance';

// Default settings
const DEFAULT_SETTINGS: CompanySettings = {
  includeGOSI: true,
  gosiIncludeHazard: false,
  workingDaysPerMonth: 22,
  overtimeEnabled: true,
  maxMonthlyDeduction: 0.5, // 50% max
};

/**
 * Gather employee monthly data
 */
async function gatherEmployeeMonthlyData(
  db: any,
  tenantId: string,
  employeeId: string,
  month: number,
  year: number
) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  // 1. Employee and salary data
  const employee = await db.collection('cvision_employees').findOne({
    id: employeeId,
    tenantId,
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Get salary data from contract or directly from employee
  const contract = await db.collection('cvision_contracts').findOne({
    tenantId,
    employeeId,
    status: 'ACTIVE',
  });

  const salary: SalaryStructure = {
    basicSalary: contract?.basicSalary || employee.basicSalary || 0,
    housingAllowance: contract?.housingAllowance || employee.housingAllowance || 0,
    transportAllowance: contract?.transportAllowance || employee.transportAllowance || 0,
    foodAllowance: employee.foodAllowance || 0,
    phoneAllowance: employee.phoneAllowance || 0,
    otherAllowances: contract?.otherAllowances || employee.otherAllowances || 0,
  };

  // 2. Attendance data
  const attendanceRecords = await db.collection('cvision_attendance').find({
    tenantId,
    employeeId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  }).toArray();

  const attendanceSummary = summarizeMonthlyAttendance(
    attendanceRecords.map((r: any) => ({
      date: r.date,
      status: r.status,
      lateMinutes: r.lateMinutes || 0,
      earlyLeaveMinutes: r.earlyLeaveMinutes || 0,
      overtimeMinutes: r.overtimeMinutes || 0,
      workedMinutes: r.workedMinutes || 0,
    })),
    employeeId,
    month,
    year
  );

  const attendance: MonthlyAttendanceData = {
    totalLateMinutes: attendanceSummary.totalLateMinutes,
    totalEarlyLeaveMinutes: attendanceSummary.totalEarlyLeaveMinutes,
    absentDays: attendanceSummary.absentDays,
    overtimeMinutes: attendanceSummary.totalOvertimeMinutes,
    workingDays: attendanceSummary.workingDays,
    presentDays: attendanceSummary.presentDays,
  };

  // 3. Leave data
  const leaveRecords = await db.collection('cvision_leaves').find({
    tenantId,
    employeeId,
    status: 'APPROVED',
    startDate: { $lte: endOfMonth },
    endDate: { $gte: startOfMonth },
    deletedAt: null,
  }).toArray();

  let unpaidLeaveDays = 0;
  let sickLeaveDays = 0;

  for (const leave of leaveRecords) {
    // Calculate days within the month only
    const leaveStart = new Date(Math.max(leave.startDate.getTime(), startOfMonth.getTime()));
    const leaveEnd = new Date(Math.min(leave.endDate.getTime(), endOfMonth.getTime()));
    const days = Math.ceil((leaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (leave.leaveType === 'UNPAID') {
      unpaidLeaveDays += days;
    } else if (leave.leaveType === 'SICK') {
      sickLeaveDays += days;
    }
  }

  // Sick leaves used this year
  const sickLeavesThisYear = await db.collection('cvision_leaves').aggregate([
    {
      $match: {
        tenantId,
        employeeId,
        leaveType: 'SICK',
        status: 'APPROVED',
        startDate: { $gte: new Date(year, 0, 1) },
      },
    },
    { $group: { _id: null, total: { $sum: '$days' } } },
  ]).toArray();

  const leaves: MonthlyLeaveData = {
    unpaidLeaveDays,
    sickLeaveDays,
    sickLeaveDaysUsedThisYear: sickLeavesThisYear[0]?.total || 0,
  };

  // 4. Violation data
  const violationRecords = await db.collection('cvision_violations').find({
    tenantId,
    employeeId,
    status: { $in: ['DECIDED', 'CLOSED'] },
    decidedAt: { $gte: startOfMonth, $lte: endOfMonth },
  }).toArray();

  const violations: MonthlyViolationData = {
    violations: violationRecords.map((v: any) => ({
      id: v._id.toString(),
      type: v.type,
      penalty: v.penalty,
      penaltyAmount: v.penaltyAmount,
      penaltyDays: v.penaltyDays,
    })),
  };

  // 5. Loan data
  const activeLoans = await db.collection('cvision_loans').find({
    tenantId,
    employeeId,
    status: 'ACTIVE',
  }).toArray();

  let activeLoanInstallment = 0;
  for (const loan of activeLoans) {
    activeLoanInstallment += loan.monthlyDeduction || 0;
  }

  // Pending advances
  const pendingAdvances = await db.collection('cvision_loans').find({
    tenantId,
    employeeId,
    type: 'ADVANCE',
    status: 'APPROVED',
    deductInMonth: month,
    deductInYear: year,
  }).toArray();

  let advanceDeduction = 0;
  for (const advance of pendingAdvances) {
    advanceDeduction += advance.principal || 0;
  }

  const loans: LoanData = {
    activeLoanInstallment,
    advanceDeduction,
  };

  return { employee, salary, attendance, leaves, violations, loans };
}

const payrollCalculateSchema = z.object({
  action: z.enum(['single', 'run', 'preview', 'compare']).optional(), // defaults to 'single' when missing
  employeeId: z.string().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  overrides: z.object({
    salary: z.record(z.string(), z.unknown()).optional(),
    attendance: z.record(z.string(), z.unknown()).optional(),
    leaves: z.record(z.string(), z.unknown()).optional(),
    loans: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  departmentId: z.string().optional(),
}).passthrough();

// POST /api/cvision/payroll/calculate
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) {
      return middlewareError(authResult);
    }

    const { tenantId, userId } = authResult.data;
    const body = await request.json();
    const parsed = payrollCalculateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { action } = body;

    const db = await getCVisionDb(tenantId);

    // Calculate single employee salary
    if (action === 'single' || !action) {
      const { employeeId, month, year, settings } = body;

      if (!employeeId || !month || !year) {
        return NextResponse.json(
          { success: false, error: 'Employee ID, month, and year are required' },
          { status: 400 }
        );
      }

      const data = await gatherEmployeeMonthlyData(db, tenantId, employeeId, month, year);

      const calculation = calculateFullPayroll(
        employeeId,
        month,
        year,
        data.salary,
        data.attendance,
        data.leaves,
        data.violations,
        data.loans,
        { ...DEFAULT_SETTINGS, ...settings }
      );

      const payslipText = generatePayslipSummary(calculation);

      return NextResponse.json({
        success: true,
        data: {
          calculation,
          payslipText,
          employee: {
            id: data.employee.id || data.employee._id,
            name: data.employee.fullName || `${data.employee.firstName || ''} ${data.employee.lastName || ''}`.trim(),
            employeeNumber: data.employee.employeeNo,
          },
        },
      });
    }

    // Calculate all employee salaries (Payroll Run)
    if (action === 'run') {
      const { month, year, settings, departmentId } = body;

      if (!month || !year) {
        return NextResponse.json(
          { success: false, error: 'Month and year are required' },
          { status: 400 }
        );
      }

      // CRITICAL: Prevent duplicate payroll runs for the same period
      const existingRun = await db.collection('cvision_payroll_runs').findOne({
        tenantId,
        month,
        year,
        status: { $in: ['FINALIZED', 'APPROVED'] },
      });

      if (existingRun) {
        return NextResponse.json(
          {
            success: false,
            error: `A ${existingRun.status.toLowerCase()} payroll run already exists for ${month}/${year}. Cannot create a new run.`,
            existingRunId: existingRun._id?.toString() || existingRun.id,
          },
          { status: 400 }
        );
      }

      // Get active employees list
      const employeeQuery: any = {
        tenantId,
        status: { $in: ['ACTIVE', 'PROBATION'] },
      };

      if (departmentId) {
        employeeQuery.departmentId = departmentId;
      }

      const employees = await db.collection('cvision_employees')
        .find(employeeQuery)
        .toArray();

      const calculations: PayrollCalculation[] = [];
      const errors: { employeeId: string; name: string; error: string }[] = [];

      let totalNetSalary = 0;
      let totalEmployerCost = 0;
      let totalDeductions = 0;

      for (const emp of employees) {
        try {
          const data = await gatherEmployeeMonthlyData(
            db, tenantId, emp.id, month, year
          );

          const calc = calculateFullPayroll(
            emp.id,
            month,
            year,
            data.salary,
            data.attendance,
            data.leaves,
            data.violations,
            data.loans,
            { ...DEFAULT_SETTINGS, ...settings }
          );

          calculations.push(calc);
          totalNetSalary += calc.netSalary;
          totalEmployerCost += calc.employerCost.totalCost;
          totalDeductions += calc.deductions.totalDeductions;

        } catch (err: any) {
          errors.push({
            employeeId: emp.id,
            name: emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
            error: err.message,
          });
        }
      }

      // Create Payroll Run record
      const payrollRun = {
        tenantId,
        month,
        year,
        status: 'DRAFT',
        employeeCount: calculations.length,
        totalNetSalary: Math.round(totalNetSalary * 100) / 100,
        totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        calculations,
        errors,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('cvision_payroll_runs').insertOne(payrollRun);

      return NextResponse.json({
        success: true,
        data: {
          runId: result.insertedId,
          summary: {
            employeeCount: calculations.length,
            errorCount: errors.length,
            totalNetSalary: payrollRun.totalNetSalary,
            totalEmployerCost: payrollRun.totalEmployerCost,
            totalDeductions: payrollRun.totalDeductions,
          },
          errors: errors.length > 0 ? errors : undefined,
        },
        message: `Payroll calculated for ${calculations.length} employees`,
      });
    }

    // Preview salary (Dry Run) without saving
    if (action === 'preview') {
      const { employeeId, month, year, settings, overrides } = body;

      if (!employeeId || !month || !year) {
        return NextResponse.json(
          { success: false, error: 'Employee ID, month, and year are required' },
          { status: 400 }
        );
      }

      const data = await gatherEmployeeMonthlyData(db, tenantId, employeeId, month, year);

      // Apply any manual overrides
      if (overrides) {
        if (overrides.salary) Object.assign(data.salary, overrides.salary);
        if (overrides.attendance) Object.assign(data.attendance, overrides.attendance);
        if (overrides.leaves) Object.assign(data.leaves, overrides.leaves);
        if (overrides.loans) Object.assign(data.loans, overrides.loans);
      }

      const calculation = calculateFullPayroll(
        employeeId,
        month,
        year,
        data.salary,
        data.attendance,
        data.leaves,
        data.violations,
        data.loans,
        { ...DEFAULT_SETTINGS, ...settings }
      );

      return NextResponse.json({
        success: true,
        data: {
          calculation,
          inputs: {
            salary: data.salary,
            attendance: data.attendance,
            leaves: data.leaves,
            violations: data.violations,
            loans: data.loans,
          },
        },
        message: 'Preview only - not saved',
      });
    }

    // Compare with previous month
    if (action === 'compare') {
      const { employeeId, month, year } = body;

      if (!employeeId || !month || !year) {
        return NextResponse.json(
          { success: false, error: 'Employee ID, month, and year are required' },
          { status: 400 }
        );
      }

      // Current month
      const currentData = await gatherEmployeeMonthlyData(db, tenantId, employeeId, month, year);
      const currentCalc = calculateFullPayroll(
        employeeId, month, year,
        currentData.salary, currentData.attendance, currentData.leaves,
        currentData.violations, currentData.loans, DEFAULT_SETTINGS
      );

      // Previous month
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      let previousCalc: PayrollCalculation | null = null;
      try {
        const prevData = await gatherEmployeeMonthlyData(db, tenantId, employeeId, prevMonth, prevYear);
        previousCalc = calculateFullPayroll(
          employeeId, prevMonth, prevYear,
          prevData.salary, prevData.attendance, prevData.leaves,
          prevData.violations, prevData.loans, DEFAULT_SETTINGS
        );
      } catch {
        // No data for previous month
      }

      const comparison = {
        current: {
          month, year,
          netSalary: currentCalc.netSalary,
          totalDeductions: currentCalc.deductions.totalDeductions,
        },
        previous: previousCalc ? {
          month: prevMonth, year: prevYear,
          netSalary: previousCalc.netSalary,
          totalDeductions: previousCalc.deductions.totalDeductions,
        } : null,
        difference: previousCalc ? {
          netSalary: currentCalc.netSalary - previousCalc.netSalary,
          totalDeductions: currentCalc.deductions.totalDeductions - previousCalc.deductions.totalDeductions,
          percentageChange: ((currentCalc.netSalary - previousCalc.netSalary) / previousCalc.netSalary * 100).toFixed(2),
        } : null,
      };

      return NextResponse.json({
        success: true,
        data: {
          currentCalculation: currentCalc,
          previousCalculation: previousCalc,
          comparison,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error: any) {
    logger.error('Payroll Calculate API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
