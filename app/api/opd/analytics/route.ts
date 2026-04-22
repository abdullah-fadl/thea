// =============================================================================
// OPD Analytics API — NEW FILE (no existing code modified)
// GET /api/opd/analytics?period=7d|30d|90d|custom&from=&to=
// =============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl;
    const period = url.searchParams.get('period') || '30d';
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date = now;

    if (fromParam && toParam) {
      dateFrom = new Date(fromParam);
      dateTo = new Date(toParam);
    } else {
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - days);
    }

    const fromStr = dateFrom.toISOString().split('T')[0];
    const toStr = dateTo.toISOString().split('T')[0];

    // ── Booking stats ───────────────────────────────────────────────────────
    const [
      totalBookings,
      byStatus,
      byDepartment,
      noShowCount,
      completedCount,
    ] = await Promise.all([
      prisma.opdBooking.count({
        where: { tenantId, date: { gte: fromStr, lte: toStr } },
      }),

      (prisma.opdBooking.groupBy as any)({
        by: ['status'],
        where: { tenantId, date: { gte: fromStr, lte: toStr } },
        _count: { _all: true },
      }),

      (prisma.opdBooking.groupBy as any)({
        by: ['department'],
        where: { tenantId, date: { gte: fromStr, lte: toStr } },
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }).catch(() => []),

      prisma.opdBooking.count({
        where: { tenantId, date: { gte: fromStr, lte: toStr }, status: 'NO_SHOW' },
      }),

      prisma.opdBooking.count({
        where: { tenantId, date: { gte: fromStr, lte: toStr }, status: 'COMPLETED' },
      }),
    ]);

    // ── Encounter stats ─────────────────────────────────────────────────────
    const [
      totalEncounters,
      encountersByType,
    ] = await Promise.all([
      prisma.encounterCore.count({
        where: {
          tenantId,
          createdAt: { gte: dateFrom, lte: dateTo },
          encounterType: 'OPD',
        },
      }),

      (prisma.encounterCore.groupBy as any)({
        by: ['visitType'],
        where: {
          tenantId,
          createdAt: { gte: dateFrom, lte: dateTo },
          encounterType: 'OPD',
        },
        _count: { _all: true },
      }).catch(() => []),
    ]);

    // ── Prescription stats ──────────────────────────────────────────────────
    const [totalPrescriptions, prescriptionsByStatus] = await Promise.all([
      prisma.ordersHub.count({
        where: {
          tenantId,
          kind: 'MEDICATION',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),

      prisma.ordersHub.groupBy({
        by: ['status'],
        where: {
          tenantId,
          kind: 'MEDICATION',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _count: { _all: true },
      }),
    ]);

    // ── Reminder stats ──────────────────────────────────────────────────────
    const reminderStats = await prisma.appointmentReminder.aggregate({
      where: {
        tenantId,
        appointmentDate: { gte: dateFrom, lte: dateTo },
      },
      _count: { _all: true },
    }).catch(() => ({ _count: { _all: 0 } }));

    // ── Compute KPIs ────────────────────────────────────────────────────────
    const noShowRate = totalBookings > 0
      ? Math.round((noShowCount / totalBookings) * 100)
      : 0;
    const completionRate = totalBookings > 0
      ? Math.round((completedCount / totalBookings) * 100)
      : 0;

    return NextResponse.json({
      period: { from: fromStr, to: toStr },
      kpis: {
        totalBookings,
        totalEncounters,
        totalPrescriptions,
        noShowRate,
        completionRate,
        totalReminders: reminderStats._count._all,
      },
      bookings: {
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
        byDepartment: (byDepartment as Array<{ department?: string; _count: { _all: number } }>).map((d) => ({
          department: d.department ?? 'Unknown',
          count: d._count._all,
        })),
      },
      encounters: {
        total: totalEncounters,
        byType: (encountersByType as Array<{ visitType?: string; _count: { _all: number } }>).map((e) => ({
          type: e.visitType ?? 'Unknown',
          count: e._count._all,
        })),
      },
      prescriptions: {
        total: totalPrescriptions,
        byStatus: prescriptionsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      },
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'opd.booking.view',
  },
);
