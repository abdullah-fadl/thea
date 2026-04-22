import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bookings = await prisma.opdBooking
      .findMany({
        where: { tenantId, createdAt: { gte: startDate } },
        select: { createdAt: true, status: true },
      })
      .catch(() => [] as { createdAt: Date; status: string }[]);

    const byDay: Record<string, { total: number; completed: number }> = {};
    for (const b of bookings) {
      const day = b.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { total: 0, completed: 0 };
      byDay[day].total++;
      if (b.status === 'COMPLETED') byDay[day].completed++;
    }

    const trend = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, completed }]) => ({ date, total, completed }));

    return NextResponse.json({ trend, totalBookings: bookings.length });
  }),
  { permissionKey: 'analytics.view' },
);
