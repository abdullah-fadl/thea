/**
 * Executive Analytics API
 *
 * Returns comprehensive patient volume metrics with multiple time granularities,
 * peak analysis, growth metrics, and source breakdowns. All data comes from
 * real Prisma/PostgreSQL queries against encounter_core and opd_bookings tables.
 *
 * Query params:
 *   period       — 7d | 14d | 30d | 90d | 365d  (default: 30d)
 *   granularity  — hourly | daily | weekly | monthly | yearly (default: daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PERIOD_MAP: Record<string, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePeriod(raw: string | null): number {
  return PERIOD_MAP[raw || '30d'] ?? 30;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

// ---------------------------------------------------------------------------
// Raw SQL result types
// ---------------------------------------------------------------------------

interface HourRow { hour: number; count: bigint }
interface DayRow { day: string; count: bigint }
interface WeekRow { week_start: string; count: bigint }
interface MonthRow { month: string; count: bigint }
interface YearRow { year: string; count: bigint }
interface DowRow { dow: number; avg_count: number }
interface MonthOfYearRow { month_num: number; avg_count: number }
interface BusiestDayRow { day: string; count: bigint }
interface DeptRow { department: string; count: bigint }

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const periodDays = parsePeriod(searchParams.get('period'));
    const granularity = searchParams.get('granularity') || 'daily';
    const startDate = daysAgo(periodDays);
    const prevStartDate = daysAgo(periodDays * 2);

    // =====================================================================
    // 1. Summary counts — current period vs previous period
    // =====================================================================

    const [currentCount, prevCount, totalPatients] = await Promise.all([
      prisma.encounterCore.count({
        where: { tenantId, createdAt: { gte: startDate } },
      }).catch(() => 0),

      prisma.encounterCore.count({
        where: { tenantId, createdAt: { gte: prevStartDate, lt: startDate } },
      }).catch(() => 0),

      prisma.encounterCore.count({
        where: { tenantId },
      }).catch(() => 0),
    ]);

    const avgDaily = periodDays > 0 ? Math.round((currentCount / periodDays) * 100) / 100 : 0;
    const prevAvgDaily = periodDays > 0 ? Math.round((prevCount / periodDays) * 100) / 100 : 0;

    // WoW / MoM / YoY — we need specific windows for each
    const [
      countLast7, countPrev7,
      countLast30, countPrev30,
      countLast365, countPrev365,
    ] = await Promise.all([
      prisma.encounterCore.count({ where: { tenantId, createdAt: { gte: daysAgo(7) } } }).catch(() => 0),
      prisma.encounterCore.count({ where: { tenantId, createdAt: { gte: daysAgo(14), lt: daysAgo(7) } } }).catch(() => 0),
      prisma.encounterCore.count({ where: { tenantId, createdAt: { gte: daysAgo(30) } } }).catch(() => 0),
      prisma.encounterCore.count({ where: { tenantId, createdAt: { gte: daysAgo(60), lt: daysAgo(30) } } }).catch(() => 0),
      prisma.encounterCore.count({ where: { tenantId, createdAt: { gte: daysAgo(365) } } }).catch(() => 0),
      prisma.encounterCore.count({ where: { tenantId, createdAt: { gte: daysAgo(730), lt: daysAgo(365) } } }).catch(() => 0),
    ]);

    const summary = {
      totalPatients,
      avgDailyVolume: avgDaily,
      prevAvgDailyVolume: prevAvgDaily,
      growthWoW: pct(countLast7, countPrev7),
      growthMoM: pct(countLast30, countPrev30),
      growthYoY: pct(countLast365, countPrev365),
    };

    // =====================================================================
    // 2. Trends — varies by granularity
    // =====================================================================

    // -- Hourly: count per hour for encounters in the current period
    let hourly: Array<{ hour: number; count: number }> = [];
    try {
      const hourRows: HourRow[] = await prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
          AND "createdAt" >= ${startDate}
        GROUP BY hour
        ORDER BY hour
      `;
      // Fill all 24 hours
      const hourMap = new Map(hourRows.map((r) => [Number(r.hour), Number(r.count)]));
      hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap.get(i) || 0 }));
    } catch {
      hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    }

    // -- Daily: count per day
    let daily: Array<{ date: string; count: number }> = [];
    try {
      const dayRows: DayRow[] = await prisma.$queryRaw`
        SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
          AND "createdAt" >= ${startDate}
        GROUP BY day
        ORDER BY day
      `;
      daily = dayRows.map((r) => ({ date: r.day, count: Number(r.count) }));
    } catch {
      daily = [];
    }

    // -- Weekly: count per ISO week
    let weekly: Array<{ weekStart: string; count: number }> = [];
    try {
      const weekStart12 = daysAgo(84); // 12 weeks
      const weekRows: WeekRow[] = await prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('week', "createdAt"), 'YYYY-MM-DD') AS week_start,
               COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
          AND "createdAt" >= ${weekStart12}
        GROUP BY week_start
        ORDER BY week_start
      `;
      weekly = weekRows.map((r) => ({ weekStart: r.week_start, count: Number(r.count) }));
    } catch {
      weekly = [];
    }

    // -- Monthly: count per month
    let monthly: Array<{ month: string; count: number }> = [];
    try {
      const monthStart12 = daysAgo(365);
      const monthRows: MonthRow[] = await prisma.$queryRaw`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
               COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
          AND "createdAt" >= ${monthStart12}
        GROUP BY month
        ORDER BY month
      `;
      monthly = monthRows.map((r) => ({ month: r.month, count: Number(r.count) }));
    } catch {
      monthly = [];
    }

    const trends = { hourly, daily, weekly, monthly };

    // =====================================================================
    // 3. Peaks
    // =====================================================================

    // -- Peak hours (top 3 busiest hours all-time for this tenant)
    let peakHours: Array<{ hour: number; count: number; label: string }> = [];
    try {
      const phRows: HourRow[] = await prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 3
      `;
      peakHours = phRows.map((r) => {
        const h = Number(r.hour);
        const suffix = h < 12 ? 'AM' : 'PM';
        const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return { hour: h, count: Number(r.count), label: `${display}:00 ${suffix}` };
      });
    } catch {
      peakHours = [];
    }

    // -- Peak days of week (top 3 by average daily count)
    let peakDays: Array<{ dayOfWeek: number; dayName: string; avgCount: number }> = [];
    try {
      const pdRows: DowRow[] = await prisma.$queryRaw`
        SELECT EXTRACT(DOW FROM "createdAt")::int AS dow,
               ROUND(COUNT(*) * 1.0 / GREATEST(
                 (SELECT COUNT(DISTINCT DATE_TRUNC('day', "createdAt"))
                  FROM encounter_core
                  WHERE "tenantId" = ${tenantId}::uuid
                    AND EXTRACT(DOW FROM "createdAt") = EXTRACT(DOW FROM ec."createdAt")),
                 1), 1)::float AS avg_count
        FROM encounter_core ec
        WHERE "tenantId" = ${tenantId}::uuid
        GROUP BY dow
        ORDER BY avg_count DESC
        LIMIT 3
      `;
      peakDays = pdRows.map((r) => ({
        dayOfWeek: Number(r.dow),
        dayName: DAY_NAMES[Number(r.dow)] || 'Unknown',
        avgCount: Math.round(Number(r.avg_count) * 10) / 10,
      }));
    } catch {
      peakDays = [];
    }

    // -- Peak months of year (top 3 by average monthly count)
    let peakMonths: Array<{ month: number; monthName: string; avgCount: number }> = [];
    try {
      const pmRows: MonthOfYearRow[] = await prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "createdAt")::int AS month_num,
               ROUND(COUNT(*) * 1.0 / GREATEST(
                 (SELECT COUNT(DISTINCT DATE_TRUNC('month', "createdAt"))
                  FROM encounter_core
                  WHERE "tenantId" = ${tenantId}::uuid
                    AND EXTRACT(MONTH FROM "createdAt") = EXTRACT(MONTH FROM ec."createdAt")),
                 1), 1)::float AS avg_count
        FROM encounter_core ec
        WHERE "tenantId" = ${tenantId}::uuid
        GROUP BY month_num
        ORDER BY avg_count DESC
        LIMIT 3
      `;
      peakMonths = pmRows.map((r) => ({
        month: Number(r.month_num),
        monthName: MONTH_NAMES[Number(r.month_num) - 1] || 'Unknown',
        avgCount: Math.round(Number(r.avg_count) * 10) / 10,
      }));
    } catch {
      peakMonths = [];
    }

    // -- Busiest day ever (single date with most encounters)
    let busiestDayEver: { date: string; count: number } | null = null;
    try {
      const bdRows: BusiestDayRow[] = await prisma.$queryRaw`
        SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
        GROUP BY day
        ORDER BY count DESC
        LIMIT 1
      `;
      if (bdRows.length > 0) {
        busiestDayEver = { date: bdRows[0].day, count: Number(bdRows[0].count) };
      }
    } catch {
      busiestDayEver = null;
    }

    const peaks = { peakHours, peakDays, peakMonths, busiestDayEver };

    // =====================================================================
    // 4. Breakdown
    // =====================================================================

    // -- By source: walk-in vs booked vs emergency
    const [walkInCount, emergencyCount, totalBookings] = await Promise.all([
      prisma.opdBooking.count({
        where: { tenantId, isWalkIn: true, createdAt: { gte: startDate } },
      }).catch(() => 0),

      prisma.encounterCore.count({
        where: { tenantId, encounterType: 'ER', createdAt: { gte: startDate } },
      }).catch(() => 0),

      prisma.opdBooking.count({
        where: { tenantId, createdAt: { gte: startDate } },
      }).catch(() => 0),
    ]);

    const bookedCount = Math.max(0, totalBookings - walkInCount);

    const bySource = {
      walkIn: walkInCount,
      booked: bookedCount,
      emergency: emergencyCount,
    };

    // -- New vs follow-up (from OpdBooking.isFirstVisit)
    const [newPatients, followUpPatients] = await Promise.all([
      prisma.opdBooking.count({
        where: { tenantId, isFirstVisit: true, createdAt: { gte: startDate } },
      }).catch(() => 0),

      prisma.opdBooking.count({
        where: { tenantId, isFirstVisit: false, createdAt: { gte: startDate } },
      }).catch(() => 0),
    ]);

    // If isFirstVisit is null for all rows, fall back to visitType enum analysis
    let byPatientType = { newPatients, followUp: followUpPatients };
    if (newPatients === 0 && followUpPatients === 0 && totalBookings > 0) {
      // Fallback: FVC/FVH = new, FU/RV/REF = follow-up from OpdEncounter.visitType
      const [newViaType, fuViaType] = await Promise.all([
        prisma.opdEncounter.count({
          where: { tenantId, visitType: { in: ['FVC', 'FVH'] }, createdAt: { gte: startDate } },
        }).catch(() => 0),
        prisma.opdEncounter.count({
          where: { tenantId, visitType: { in: ['FU', 'RV', 'REF'] }, createdAt: { gte: startDate } },
        }).catch(() => 0),
      ]);
      byPatientType = { newPatients: newViaType, followUp: fuViaType };
    }

    // -- By department (top 10 from encounter_core.department)
    let byDepartment: Array<{ departmentId: string; name: string; count: number }> = [];
    try {
      const deptRows: DeptRow[] = await prisma.$queryRaw`
        SELECT department, COUNT(*)::bigint AS count
        FROM encounter_core
        WHERE "tenantId" = ${tenantId}::uuid
          AND "createdAt" >= ${startDate}
        GROUP BY department
        ORDER BY count DESC
        LIMIT 10
      `;

      // Try to resolve department names from the departments table
      const deptCodes = deptRows.map((r) => r.department);
      let deptNameMap = new Map<string, string>();
      if (deptCodes.length > 0) {
        try {
          const depts = await prisma.department.findMany({
            where: { tenantId, code: { in: deptCodes } },
            select: { code: true, name: true },
          });
          deptNameMap = new Map(depts.map((d) => [d.code, d.name]));
        } catch {
          // Department lookup is best-effort
        }
      }

      byDepartment = deptRows.map((r) => ({
        departmentId: r.department,
        name: deptNameMap.get(r.department) || r.department,
        count: Number(r.count),
      }));
    } catch {
      byDepartment = [];
    }

    // -- By payment type: cash vs insured
    // Insured = patients with insuranceCompanyName set in PatientMaster
    // We join encounter_core with patient_master to determine this
    let byPaymentType = { cash: 0, insured: 0 };
    try {
      const payRows: Array<{ is_insured: boolean; count: bigint }> = await prisma.$queryRaw`
        SELECT
          (pm."insuranceCompanyName" IS NOT NULL AND pm."insuranceCompanyName" <> '') AS is_insured,
          COUNT(*)::bigint AS count
        FROM encounter_core ec
        JOIN patient_master pm ON ec."patientId" = pm.id
        WHERE ec."tenantId" = ${tenantId}::uuid
          AND ec."createdAt" >= ${startDate}
        GROUP BY is_insured
      `;
      for (const row of payRows) {
        if (row.is_insured) {
          byPaymentType.insured = Number(row.count);
        } else {
          byPaymentType.cash = Number(row.count);
        }
      }
    } catch {
      // Payment breakdown unavailable — return zeros
    }

    const breakdown = { bySource, byPatientType, byDepartment, byPaymentType };

    // =====================================================================
    // Response
    // =====================================================================

    return NextResponse.json({
      summary,
      trends,
      peaks,
      breakdown,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'analytics.view',
  },
);
