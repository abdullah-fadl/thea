import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Dry Run API
 * POST /api/cvision/payroll/runs/:id/dry-run
 *
 * Generates payslips without locking data (status = DRY_RUN)
 * Includes: attendance, leaves, violations, loans data
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionPayrollRun,
  CVisionPayrollProfile,
  CVisionLoan,
  CVisionPayslip,
  CVisionEmployee,
  CVisionBaseRecord,
} from '@/lib/cvision/types';

// Types for attendance, leave, violation (not in main types yet)
interface AttendanceRecord extends CVisionBaseRecord {
  employeeId: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  status: string;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
}

interface LeaveRecord extends CVisionBaseRecord {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: string;
  leaveType?: string;
  status: string;
}

interface ViolationRecord extends CVisionBaseRecord {
  employeeId: string;
  type: string;
  violationType?: string;
  date: Date;
  penaltyAmount?: number;
  penaltyDays?: number;
}
import { calculatePayslip } from '@/lib/cvision/payroll/calc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to get working days in a month
function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    // Skip Friday (5) and Saturday (6) for Saudi Arabia
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  return workingDays;
}

// POST - Generate dry run payslips
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const runId = resolvedParams?.id as string;

      if (!runId) {
        return NextResponse.json(
          { error: 'Run ID is required' },
          { status: 400 }
        );
      }

      const runCollection = await getCVisionCollection<CVisionPayrollRun>(
        tenantId,
        'payrollRuns'
      );
      const run = await findById(runCollection, tenantId, runId);

      if (!run) {
        return NextResponse.json(
          { error: 'Payroll run not found' },
          { status: 404 }
        );
      }

      if (run.status !== 'DRAFT') {
        return NextResponse.json(
          {
            error: 'Invalid status',
            message: `Can only run dry-run on DRAFT runs. Current status: ${run.status}`,
          },
          { status: 400 }
        );
      }

      // Parse period (YYYY-MM)
      const [yearStr, monthStr] = run.period.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      // Get all collections
      const empCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const profileCollection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );
      const loanCollection = await getCVisionCollection<CVisionLoan>(
        tenantId,
        'loans'
      );
      const payslipCollection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );
      // Note: attendance, leaves, and violations collections may not exist yet
      // Using try-catch to handle gracefully
      let attendanceRecordsMap: Map<string, AttendanceRecord[]> = new Map();
      let leavesMap: Map<string, LeaveRecord[]> = new Map();
      let violationsMap: Map<string, ViolationRecord[]> = new Map();
      const yearlySickLeaveMap = new Map<string, number>();

      try {
        const { getCVisionDb } = await import('@/lib/cvision/db');
        const db = await getCVisionDb(tenantId);

        // Try to get attendance records
        try {
          const attendanceRecords = await db.collection('cvision_attendance')
            .find({
              tenantId,
              date: { $gte: startOfMonth, $lte: endOfMonth },
            })
            .toArray();
          for (const record of attendanceRecords) {
            const empId = record.employeeId;
            if (!attendanceRecordsMap.has(empId)) {
              attendanceRecordsMap.set(empId, []);
            }
            attendanceRecordsMap.get(empId)!.push(record as AttendanceRecord);
          }
        } catch (e) {
          logger.info('[Dry Run] No attendance data available');
        }

        // Try to get leave records
        try {
          const leaveRecords = await db.collection('cvision_leaves')
            .find({
              tenantId,
              status: { $in: ['APPROVED'] },
              $or: [
                { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
                { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
              ],
            })
            .toArray();
          for (const record of leaveRecords) {
            const empId = record.employeeId;
            if (!leavesMap.has(empId)) {
              leavesMap.set(empId, []);
            }
            leavesMap.get(empId)!.push(record as LeaveRecord);
          }
        } catch (e) {
          logger.info('[Dry Run] No leave data available');
        }

        // Try to get violation records
        try {
          const violationRecords = await db.collection('cvision_violations')
            .find({
              tenantId,
              date: { $gte: startOfMonth, $lte: endOfMonth },
            })
            .toArray();
          for (const record of violationRecords) {
            const empId = record.employeeId;
            if (!violationsMap.has(empId)) {
              violationsMap.set(empId, []);
            }
            violationsMap.get(empId)!.push(record as ViolationRecord);
          }
        } catch (e) {
          logger.info('[Dry Run] No violation data available');
        }

        // Calculate yearly sick leave usage per employee
        // Saudi labor law has tiered sick leave: first 30 days = 100%, next 60 days = 75%, next 30 days = 0%
        try {
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31, 23, 59, 59);
          const yearlySickLeaves = await db.collection('cvision_leaves')
            .find({
              tenantId,
              status: { $in: ['APPROVED'] },
              leaveType: 'SICK',
              startDate: { $gte: yearStart, $lte: yearEnd },
            })
            .toArray();
          for (const leave of yearlySickLeaves) {
            const empId = leave.employeeId;
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            yearlySickLeaveMap.set(empId, (yearlySickLeaveMap.get(empId) || 0) + days);
          }
        } catch (e) {
          logger.info('[Dry Run] Could not calculate yearly sick leave');
        }
      } catch (e) {
        logger.info('[Dry Run] Could not load additional data:', e);
      }

      // Get active employees (ACTIVE or PROBATION status)
      const employees = await empCollection
        .find(
          createTenantFilter(tenantId, {
            status: { $in: ['ACTIVE', 'PROBATION'] },
            isArchived: { $ne: true },
          })
        )
        .toArray();

      // Delete existing dry-run payslips for this run
      await payslipCollection.deleteMany(
        createTenantFilter(tenantId, { runId })
      );

      const now = new Date();
      let totalGross = 0;
      let totalNet = 0;
      let totalGosi = 0;
      let totalDeductions = 0;
      const payslips: CVisionPayslip[] = [];
      const workingDays = getWorkingDaysInMonth(year, month);

      // Generate payslips for each employee
      for (const employee of employees) {
        // Get payroll profile
        const profile = await profileCollection.findOne(
          createTenantFilter(tenantId, {
            employeeId: employee.id,
            isActive: true,
            isArchived: { $ne: true },
          })
        );

        if (!profile) {
          continue; // Skip employees without payroll profiles
        }

        // Get active loan
        const loan = await loanCollection.findOne(
          createTenantFilter(tenantId, {
            employeeId: employee.id,
            status: { $in: ['ACTIVE'] },
            isArchived: { $ne: true },
          })
        );

        // Get attendance for the month (from pre-loaded map)
        const attendanceRecords = attendanceRecordsMap.get(employee.id) || [];

        // Calculate attendance data
        let totalLateMinutes = 0;
        let totalEarlyLeaveMinutes = 0;
        let absentDays = 0;
        let overtimeMinutes = 0;
        let presentDays = 0;

        for (const record of attendanceRecords as AttendanceRecord[]) {
          if (record.status === 'ABSENT') {
            absentDays++;
          } else if (record.status === 'PRESENT' || record.status === 'LATE') {
            presentDays++;
            totalLateMinutes += record.lateMinutes || 0;
            totalEarlyLeaveMinutes += record.earlyLeaveMinutes || 0;
            overtimeMinutes += record.overtimeMinutes || 0;
          }
        }

        // Get approved leaves for the month (from pre-loaded map)
        const leaves = leavesMap.get(employee.id) || [];

        // Calculate leave data
        let unpaidLeaveDays = 0;
        let sickLeaveDays = 0;

        for (const leave of leaves as LeaveRecord[]) {
          // Calculate days within this month
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          const effectiveStart = leaveStart < startOfMonth ? startOfMonth : leaveStart;
          const effectiveEnd = leaveEnd > endOfMonth ? endOfMonth : leaveEnd;

          const daysInMonth = Math.ceil(
            (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;

          if (leave.leaveType === 'UNPAID') {
            unpaidLeaveDays += daysInMonth;
          } else if (leave.leaveType === 'SICK') {
            sickLeaveDays += daysInMonth;
          }
        }

        // Get violations for the month (from pre-loaded map)
        const violations = violationsMap.get(employee.id) || [];

        // Map violations to the format expected by calculator
        const mappedViolations = (violations as ViolationRecord[]).map((v) => ({
          id: v.id,
          type: v.violationType || v.type || 'other',
          penalty: ((v as unknown as Record<string, unknown>).penaltyType || (v as unknown as Record<string, unknown>).penalty || 'warning') as 'warning' | 'deduction' | 'suspension' | 'termination',
          penaltyAmount: v.penaltyAmount || 0,
          penaltyDays: v.penaltyDays || 0,
        }));

        // Calculate payslip with all data
        const calculation = calculatePayslip(
          profile,
          loan || null,
          {
            totalLateMinutes,
            totalEarlyLeaveMinutes,
            absentDays,
            overtimeMinutes,
            workingDays,
            presentDays,
          },
          {
            unpaidLeaveDays,
            sickLeaveDays,
            sickLeaveDaysUsedThisYear: yearlySickLeaveMap.get(employee.id) || yearlySickLeaveMap.get(employee._id?.toString()) || 0,
          },
          {
            violations: mappedViolations as any,
          },
          {
            includeGOSI: true,
            workingDaysPerMonth: workingDays,
            overtimeEnabled: true,
            maxMonthlyDeduction: 0.5,
          }
        );

        const payslip: CVisionPayslip = {
          id: uuidv4(),
          tenantId,
          runId,
          employeeId: employee.id,
          gross: calculation.gross,
          net: calculation.net,
          breakdown: {
            baseSalary: profile.baseSalary,
            allowances: calculation.breakdown.allowances || {},
            deductions: calculation.breakdown.deductions || {},
            loanDeduction: loan?.status === 'ACTIVE' ? (loan.monthlyDeduction || 0) : 0,
            totalAllowances: calculation.breakdown.totalAllowances || 0,
            totalDeductions: calculation.breakdown.totalDeductions || 0,
            overtime: calculation.breakdown.overtime || 0,
            gross: calculation.breakdown.gross || calculation.gross,
            net: calculation.breakdown.net || calculation.net,
            employerCost: calculation.breakdown.employerCost || 0,
            month,
            year,
            status: 'DRY_RUN',
            fullCalculation: calculation.fullCalculation || null,
          },
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };

        payslips.push(payslip);
        totalGross += calculation.gross;
        totalNet += calculation.net;
        totalDeductions += calculation.breakdown.totalDeductions || 0;

        if (calculation.breakdown.deductions?.gosi) {
          totalGosi += calculation.breakdown.deductions.gosi;
        }
      }

      // Insert all payslips
      if (payslips.length > 0) {
        await payslipCollection.insertMany(payslips);
      }

      // Update run status to DRY_RUN
      await runCollection.updateOne(
        createTenantFilter(tenantId, { id: runId }),
        {
          $set: {
            status: 'DRY_RUN',
            totals: {
              totalGross,
              totalNet,
              totalDeductions,
              employeeCount: payslips.length,
            },
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_run_dry_run',
        'PAYROLL_RUN',
        {
          resourceId: runId,
          metadata: {
            action: 'dry-run',
            period: run.period,
            payslipsGenerated: payslips.length,
            totalGross,
            totalNet,
            totalGosi,
            totalDeductions,
            workingDays,
          },
        }
      );

      return NextResponse.json({
        success: true,
        run: {
          ...run,
          status: 'DRY_RUN',
          totals: {
            totalGross,
            totalNet,
            totalGosi,
            totalDeductions,
            employeeCount: payslips.length,
            workingDays,
          },
        },
        payslipsGenerated: payslips.length,
        totals: {
          totalGross,
          totalNet,
          totalGosi,
          totalDeductions,
          workingDays,
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Payroll Dry Run POST]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
