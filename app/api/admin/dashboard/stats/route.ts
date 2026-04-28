import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const todayVisits = await prisma.encounterCore.count({
      where: { tenantId, createdAt: { gte: todayStart } },
    });
    const yesterdayVisits = await prisma.encounterCore.count({
      where: {
        tenantId,
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
    });
    const visitsChange = yesterdayVisits
      ? Math.round(((todayVisits - yesterdayVisits) / Math.max(1, yesterdayVisits)) * 100)
      : 0;

    const visitsTrend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await prisma.encounterCore.count({
        where: {
          tenantId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });
      visitsTrend.push({ date: dayStart.toISOString(), visits: count });
    }

    const stats = {
      todayVisits,
      visitsChange,
      todayRevenue: 0,
      waitingPatients: 0,
      avgWaitTime: 0,
      occupancyRate: 0,
      newPatients: 0,
      labTests: 0,
      radExams: 0,
      prescriptions: 0,
      attendanceRate: 0,
    };

    return NextResponse.json({
      stats,
      visitsTrend,
      revenueByDept: [],
      topDiagnoses: [],
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.users.view' }
);
