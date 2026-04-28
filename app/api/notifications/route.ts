import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/notifications
 * List notifications for current user
 *
 * Query params:
 * - unread: '1' | '0' (filter by read status)
 * - recipientType: 'user' | 'department'
 * - limit: number (default: 50)
 * - skip: number (default: 0)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  const { searchParams } = new URL(req.url);
  const unread = searchParams.get('unread');
  const recipientType = searchParams.get('recipientType');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = parseInt(searchParams.get('skip') || '0');

  // Build query - get notifications for this user with tenant isolation
  // User can receive notifications as:
  // 1. Direct user notifications (recipientType='user', recipientUserId=userId)
  // 2. Department notifications (recipientType='department', recipientDeptKey matches user's department)
  const departmentKey = (user as any).departmentKey || (user as any).department;
  const orConditions: any[] = [
    { recipientType: 'user', recipientUserId: userId },
  ];
  if (departmentKey) {
    orConditions.push({ recipientType: 'department', recipientDeptKey: departmentKey });
  }

  const baseWhere: any = {
    tenantId,
    OR: orConditions,
  };

  // Filter by read status
  if (unread === '1') {
    baseWhere.readAt = null;
  } else if (unread === '0') {
    baseWhere.readAt = { not: null };
  }

  // Filter by recipient type if specified
  if (recipientType) {
    baseWhere.recipientType = recipientType;
  }

  // Fetch notifications
  const notifications = await prisma.notification.findMany({
    where: baseWhere,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip,
  });

  // Get total count
  const total = await prisma.notification.count({ where: baseWhere });

  // Get unread count
  const unreadWhere = { ...baseWhere, readAt: null };
  const unreadCount = await prisma.notification.count({ where: unreadWhere });

  return NextResponse.json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: {
      total,
      limit,
      skip,
      hasMore: skip + limit < total,
    },
  });
}),
  { tenantScoped: true, permissionKey: 'notifications.read' }
);
