// =============================================================================
// OPD Analytics — Throughput
// GET /api/opd/analytics/throughput?days=30
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bookings = await prisma.opdBooking
      .findMany({
        where: { tenantId, createdAt: { gte: startDate } },
        select: { createdAt: true, status: true, clinicId: true, departmentId: true },
        take: 5000,
      })
      .catch(
        () =>
          [] as {
            createdAt: Date;
            status: string;
            clinicId: string | null;
            departmentId: string | null;
          }[],
      );

    // By day of week (0=Sun, 6=Sat)
    const byDow = Array.from({ length: 7 }, (_, d) => ({
      day: d,
      total: 0,
      completed: 0,
    }));

    // By hour of day
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));

    // By clinic
    const byClinic: Record<string, number> = {};

    // By department
    const byDepartment: Record<string, number> = {};

    for (const b of bookings) {
      const d = new Date(b.createdAt);
      byDow[d.getDay()].total++;
      if (b.status === 'COMPLETED') byDow[d.getDay()].completed++;
      byHour[d.getHours()].total++;

      const clinic = b.clinicId ?? 'other';
      byClinic[clinic] = (byClinic[clinic] ?? 0) + 1;

      const dept = b.departmentId ?? 'other';
      byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    }

    return NextResponse.json({
      byDayOfWeek: byDow,
      byHour,
      byClinic: Object.entries(byClinic)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([clinic, count]) => ({ clinic, count })),
      byDepartment: Object.entries(byDepartment)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([department, count]) => ({ department, count })),
      totalBookings: bookings.length,
      period: days,
    });
  }),
  { permissionKey: 'opd.analytics.view' },
);
