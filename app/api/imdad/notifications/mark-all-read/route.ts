/**
 * SCM Notifications — Mark All Read
 *
 * POST /api/imdad/notifications/mark-all-read — Mark all user's notifications as read
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (_req, { tenantId, userId }) => {
    try {
      const result = await prisma.imdadNotification.updateMany({
        where: {
          tenantId,
          userId,
          isRead: false,
          isDeleted: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    } catch {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.notifications.list' },
);
