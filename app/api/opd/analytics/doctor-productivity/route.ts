// =============================================================================
// OPD Analytics — Doctor Productivity
// GET /api/opd/analytics/doctor-productivity?days=30
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
        select: { doctorId: true, status: true, clinicId: true },
        take: 3000,
      })
      .catch(() => [] as { doctorId: string | null; status: string; clinicId: string | null }[]);

    type DoctorStats = {
      total: number;
      completed: number;
      cancelled: number;
      noShow: number;
      clinics: Set<string>;
    };

    const byDoctor: Record<string, DoctorStats> = {};
    for (const b of bookings) {
      const docId = b.doctorId ?? 'unassigned';
      if (!byDoctor[docId]) {
        byDoctor[docId] = { total: 0, completed: 0, cancelled: 0, noShow: 0, clinics: new Set() };
      }
      byDoctor[docId].total++;
      if (b.status === 'COMPLETED') byDoctor[docId].completed++;
      else if (b.status === 'CANCELLED') byDoctor[docId].cancelled++;
      else if (b.status === 'NO_SHOW') byDoctor[docId].noShow++;
      if (b.clinicId) byDoctor[docId].clinics.add(b.clinicId);
    }

    const doctors = Object.entries(byDoctor)
      .map(([doctorId, d]) => ({
        doctorId,
        total: d.total,
        completed: d.completed,
        cancelled: d.cancelled,
        noShow: d.noShow,
        completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        noShowRate: d.total > 0 ? Math.round((d.noShow / d.total) * 100) : 0,
        clinics: Array.from(d.clinics),
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ doctors, period: days, totalBookings: bookings.length });
  }),
  { permissionKey: 'opd.analytics.view' },
);
