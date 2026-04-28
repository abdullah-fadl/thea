import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const notificationId = String((params as Record<string, string>)?.id || '').trim();
  if (!notificationId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const notification = await prisma.notification.findFirst({
    where: { tenantId, id: notificationId },
  });
  if (!notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  if (notification.recipientUserId && String(notification.recipientUserId) !== String(userId || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!notification.recipientUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (notification.status === 'READ') {
    return NextResponse.json({ success: true, noOp: true, notification });
  }

  const now = new Date();
  const finalNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: { status: 'READ', readAt: now },
  });

  await createAuditLog(
    'notification',
    notificationId,
    'ACK',
    userId || 'system',
    user?.email,
    { before: notification, after: finalNotification },
    tenantId
  );

  return NextResponse.json({ notification: finalNotification });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'notifications.view' }
);
