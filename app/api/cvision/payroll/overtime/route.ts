import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Overtime API
 * POST /api/cvision/payroll/overtime - Calculate overtime based on attendance
 *
 * Saudi Labor Law overtime rules:
 *   - Regular overtime: 125% of hourly rate (Art. 107)
 *   - Holiday/rest-day overtime: 150% of hourly rate (Art. 107)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';

// Saudi Labor Law overtime multipliers
const OVERTIME_REGULAR = 1.25; // 125% during regular days
const OVERTIME_HOLIDAY = 1.50; // 150% during holidays/rest days
const STANDARD_DAILY_MINUTES = 480; // 8 hours
const RAMADAN_DAILY_MINUTES = 360; // 6 hours

interface OvertimeResult {
  employeeId: string;
  employeeName?: string;
  period: string;
  regularOvertimeMinutes: number;
  holidayOvertimeMinutes: number;
  regularOvertimeAmount: number;
  holidayOvertimeAmount: number;
  totalOvertimeAmount: number;
  totalOvertimeHours: number;
  breakdown: { date: string; minutesWorked: number; scheduledMinutes: number; overtimeMinutes: number; isHoliday: boolean; rate: number; amount: number }[];
}

function computeOvertimeForDay(
  minutesWorked: number,
  scheduledMinutes: number,
  hourlyRate: number,
  isHoliday: boolean,
): { overtimeMinutes: number; rate: number; amount: number } {
  const overtimeMinutes = Math.max(0, minutesWorked - scheduledMinutes);
  if (overtimeMinutes <= 0) return { overtimeMinutes: 0, rate: 0, amount: 0 };

  const rate = isHoliday ? OVERTIME_HOLIDAY : OVERTIME_REGULAR;
  const overtimeHours = overtimeMinutes / 60;
  const amount = Math.round(overtimeHours * hourlyRate * rate * 100) / 100;

  return { overtimeMinutes, rate, amount };
}

// GET - Summary of overtime for employees
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const employeeId = searchParams.get('employeeId');
      const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

      const db = await getCVisionDb(tenantId);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const filter: any = {
        tenantId,
        date: { $gte: startDate.toISOString().slice(0, 10), $lte: endDate.toISOString().slice(0, 10) },
      };
      if (employeeId) filter.employeeId = employeeId;

      const records = await db.collection('cvision_attendance')
        .find(filter)
        .sort({ date: 1 })
        .limit(5000)
        .toArray();

      // Group by employee
      const byEmployee = new Map<string, any[]>();
      for (const r of records) {
        const eid = (r as any).employeeId;
        if (!byEmployee.has(eid)) byEmployee.set(eid, []);
        byEmployee.get(eid)!.push(r);
      }

      const results: any[] = [];
      for (const [eid, recs] of byEmployee) {
        let totalRegular = 0;
        let totalHoliday = 0;
        for (const r of recs) {
          const ot = (r as any).overtimeMinutes || 0;
          if (ot > 0) {
            const isFriday = new Date((r as any).date).getDay() === 5;
            if (isFriday || (r as any).isHoliday) {
              totalHoliday += ot;
            } else {
              totalRegular += ot;
            }
          }
        }
        results.push({
          employeeId: eid,
          month, year,
          regularOvertimeMinutes: totalRegular,
          holidayOvertimeMinutes: totalHoliday,
          totalOvertimeHours: Math.round((totalRegular + totalHoliday) / 60 * 100) / 100,
          daysWorked: recs.length,
        });
      }

      return NextResponse.json({ success: true, data: results });
    } catch (error: any) {
      logger.error('[CVision Payroll Overtime GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);

// POST - Calculate overtime with detailed breakdown
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const body = await request.json();
      const { employeeId, month, year, isRamadan = false } = body;

      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
      }

      const db = await getCVisionDb(tenantId);

      const targetMonth = month || new Date().getMonth() + 1;
      const targetYear = year || new Date().getFullYear();

      // Get employee salary for hourly rate
      const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const basicSalary = (employee as any).basicSalary || 0;
      const housingAllowance = (employee as any).housingAllowance || 0;
      const totalMonthlySalary = basicSalary + housingAllowance;
      const hourlyRate = totalMonthlySalary / (30 * 8); // approximate hourly rate

      // Get attendance records
      const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().slice(0, 10);
      const endDate = new Date(targetYear, targetMonth, 0).toISOString().slice(0, 10);

      const attendance = await db.collection('cvision_attendance')
        .find({ tenantId, employeeId, date: { $gte: startDate, $lte: endDate } })
        .sort({ date: 1 })
        .toArray();

      const dailyMinutes = isRamadan ? RAMADAN_DAILY_MINUTES : STANDARD_DAILY_MINUTES;
      let regularOvertimeMinutes = 0;
      let holidayOvertimeMinutes = 0;
      let regularOvertimeAmount = 0;
      let holidayOvertimeAmount = 0;
      const breakdown: OvertimeResult['breakdown'] = [];

      for (const record of attendance) {
        const r = record as any;
        const minutesWorked = r.workingMinutes || r.netWorkingMinutes || 0;
        const isHoliday = r.isHoliday || new Date(r.date).getDay() === 5; // Friday = rest day in Saudi

        const ot = computeOvertimeForDay(minutesWorked, dailyMinutes, hourlyRate, isHoliday);

        if (ot.overtimeMinutes > 0) {
          if (isHoliday) {
            holidayOvertimeMinutes += ot.overtimeMinutes;
            holidayOvertimeAmount += ot.amount;
          } else {
            regularOvertimeMinutes += ot.overtimeMinutes;
            regularOvertimeAmount += ot.amount;
          }

          breakdown.push({
            date: r.date,
            minutesWorked,
            scheduledMinutes: dailyMinutes,
            overtimeMinutes: ot.overtimeMinutes,
            isHoliday,
            rate: ot.rate,
            amount: ot.amount,
          });
        }
      }

      const result: OvertimeResult = {
        employeeId,
        employeeName: `${(employee as any).firstName || ''} ${(employee as any).lastName || ''}`.trim() || undefined,
        period: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        regularOvertimeMinutes,
        holidayOvertimeMinutes,
        regularOvertimeAmount: Math.round(regularOvertimeAmount * 100) / 100,
        holidayOvertimeAmount: Math.round(holidayOvertimeAmount * 100) / 100,
        totalOvertimeAmount: Math.round((regularOvertimeAmount + holidayOvertimeAmount) * 100) / 100,
        totalOvertimeHours: Math.round((regularOvertimeMinutes + holidayOvertimeMinutes) / 60 * 100) / 100,
        breakdown,
      };

      return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('[CVision Payroll Overtime POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);
