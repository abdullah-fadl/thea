import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  // Get user's department
  const userDeptKey = (user as any)?.departmentKey || (user as any)?.department;

  // Build query for user's notifications
  const orConditions: any[] = [
    { recipientType: 'user', recipientUserId: userId },
  ];
  if (userDeptKey) {
    orConditions.push({ recipientType: 'department', recipientDeptKey: userDeptKey });
  }

  // Mark all unread as read
  const result = await prisma.notification.updateMany({
    where: {
      tenantId,
      OR: orConditions,
      readAt: null, // Only unread notifications
    },
    data: {
      readAt: new Date(),
      status: 'READ',
    },
  });

  return NextResponse.json({
    success: true,
    updated: result.count,
  });
}),
  { tenantScoped: true, permissionKey: 'notifications.read' }
);
