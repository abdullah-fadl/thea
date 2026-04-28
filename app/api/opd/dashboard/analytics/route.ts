import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { getAggregatedOPDData, calculateStatsFromRecords } from '@/lib/opd/data-aggregator';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildDateRange(period: string): { gte: Date; lte: Date } {
  const now = new Date();
  const lte = new Date(now);
  lte.setHours(23, 59, 59, 999);

  let gte: Date;
  switch (period) {
    case 'week':
      gte = new Date(now);
      gte.setDate(gte.getDate() - 7);
      break;
    case 'quarter':
      gte = new Date(now);
      gte.setMonth(gte.getMonth() - 3);
      break;
    case 'year':
      gte = new Date(now);
      gte.setFullYear(gte.getFullYear() - 1);
      break;
    case 'month':
    default:
      gte = new Date(now);
      gte.setMonth(gte.getMonth() - 1);
      break;
  }
  gte.setHours(0, 0, 0, 0);
  return { gte, lte };
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  try {
    const period = req.nextUrl.searchParams.get('period') || 'month';
    const departmentId = req.nextUrl.searchParams.get('departmentId') || undefined;

    const cacheKey = departmentId
      ? CacheKeys.opdAnalyticsWithDept(tenantId, period, departmentId)
      : CacheKeys.opdAnalytics(tenantId, period);

    const result = await cached(cacheKey, async () => {
      const dateRange = buildDateRange(period);
      const records = await getAggregatedOPDData(dateRange, departmentId, tenantId);
      const stats = calculateStatsFromRecords(records);

      // Department breakdown
      const byDepartment = new Map<string, any>();
      for (const r of records) {
        const deptId = r.departmentId || 'unknown';
        if (!byDepartment.has(deptId)) {
          byDepartment.set(deptId, {
            departmentId: deptId,
            totalVisits: 0,
            newPatients: 0,
            followUpPatients: 0,
            booked: 0,
            walkIn: 0,
            noShow: 0,
            utilizations: [] as number[],
          });
        }
        const d = byDepartment.get(deptId)!;
        d.totalVisits += r.patientCount || 0;
        d.newPatients += r.newPatients || 0;
        d.followUpPatients += r.followUpPatients || 0;
        d.booked += r.booked || 0;
        d.walkIn += r.walkIn || 0;
        d.noShow += r.noShow || 0;
        if (r.utilizationRate > 0) d.utilizations.push(r.utilizationRate);
      }

      // Resolve department names
      const deptIds = Array.from(byDepartment.keys()).filter((id) => id !== 'unknown');
      const departments = deptIds.length
        ? await prisma.department.findMany({
            where: { tenantId, id: { in: deptIds } },
            select: { id: true, name: true },
          })
        : [];
      const deptNameMap = new Map(departments.map((d) => [d.id, d.name]));

      const departmentBreakdown = Array.from(byDepartment.values()).map((d) => ({
        departmentId: d.departmentId,
        departmentName: deptNameMap.get(d.departmentId) || d.departmentId,
        totalVisits: d.totalVisits,
        newPatients: d.newPatients,
        followUpPatients: d.followUpPatients,
        booked: d.booked,
        walkIn: d.walkIn,
        noShow: d.noShow,
        avgUtilization: d.utilizations.length > 0
          ? Math.round(d.utilizations.reduce((a: number, b: number) => a + b, 0) / d.utilizations.length)
          : 0,
      }));

      // Daily trend
      const byDate = new Map<string, { visits: number; noShow: number; booked: number }>();
      for (const r of records) {
        const dateObj = r.date instanceof Date ? r.date : new Date(r.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        if (!byDate.has(dateStr)) byDate.set(dateStr, { visits: 0, noShow: 0, booked: 0 });
        const d = byDate.get(dateStr)!;
        d.visits += r.patientCount || 0;
        d.noShow += r.noShow || 0;
        d.booked += r.booked || 0;
      }

      const dailyTrend = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, ...data }));

      // Doctor leaderboard
      const byDoctor = new Map<string, { doctorId: string; totalVisits: number }>();
      for (const r of records) {
        const docId = r.doctorId || '';
        if (!docId) continue;
        if (!byDoctor.has(docId)) byDoctor.set(docId, { doctorId: docId, totalVisits: 0 });
        byDoctor.get(docId)!.totalVisits += r.patientCount || 0;
      }
      const topDoctors = Array.from(byDoctor.values())
        .sort((a, b) => b.totalVisits - a.totalVisits)
        .slice(0, 10);

      return {
        period,
        dateRange: {
          from: dateRange.gte.toISOString(),
          to: dateRange.lte.toISOString(),
        },
        stats,
        departmentBreakdown,
        dailyTrend,
        topDoctors,
        recordCount: records.length,
      };
    }, CacheTTL.ANALYTICS);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Dashboard analytics error', { category: 'opd', error });
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.dashboard.strategic' }
);
