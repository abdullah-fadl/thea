/**
 * Imdad Notification Service
 *
 * Creates and stores notifications for SCM platform users.
 * Supports multiple channels (in-app, email) and severity levels.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationParams {
  recipientUserId: string;
  type: string;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: string;
  channel?: string;
  actionUrl?: string;
  category?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationResult {
  notification: {
    id: string;
    [key: string]: unknown;
  };
  delivered: boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Send / create an Imdad notification for a user.
 * Persists to the ImdadNotification table and returns the created record.
 */
export async function sendImdadNotification(
  tenantId: string,
  params: NotificationParams,
): Promise<NotificationResult> {
  const notification = await prisma.imdadNotification.create({
    data: {
      tenantId,
      recipientUserId: params.recipientUserId,
      type: params.type,
      title: params.title,
      titleAr: params.titleAr || null,
      message: params.message,
      messageAr: params.messageAr || null,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      severity: params.severity || 'INFO',
      channel: params.channel || 'IN_APP',
      actionUrl: params.actionUrl || null,
      category: params.category || null,
      organizationId: params.organizationId || null,
      metadata: (params.metadata as any) || undefined,
      isRead: false,
    } as any,
  });

  return {
    notification: {
      id: notification.id,
      ...notification,
    },
    delivered: true,
  };
}
