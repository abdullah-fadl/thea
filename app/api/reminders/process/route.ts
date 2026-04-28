import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { processReminders } from '@/lib/opd/reminderEngine';

export const POST = withAuthTenant(
  withErrorHandler(async (_req, { tenantId }) => {
    const result = await processReminders(prisma, tenantId);
    return NextResponse.json(result);
  }),
  { platformKey: 'thea_health', permissionKey: 'opd.booking.view' },
);
