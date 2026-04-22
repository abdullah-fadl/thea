import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { getReminderStats } from '@/lib/opd/reminderEngine';

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const stats = await getReminderStats(
      prisma,
      tenantId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );

    return NextResponse.json(stats);
  }),
  { platformKey: 'thea_health', permissionKey: 'opd.booking.view' },
);
