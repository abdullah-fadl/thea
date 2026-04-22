import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
    const status = url.searchParams.get('status');
    const dateStr = url.searchParams.get('date');

    const where: any = { tenantId };
    if (status) where.status = status;
    if (dateStr) where.appointmentDate = new Date(dateStr);

    const [items, total] = await Promise.all([
      prisma.appointmentReminder.findMany({
        where: where as Record<string, unknown>,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointmentReminder.count({ where: where as Record<string, unknown> }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  }),
  { platformKey: 'thea_health', permissionKey: 'opd.booking.view' },
);
