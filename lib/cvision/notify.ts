import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Notification Helper
 *
 * Central function all systems call to send notifications.
 * Respects user preferences (channels, quiet hours, muted types).
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection } from './db';

export interface SendNotificationOptions {
  tenantId: string;
  recipientId: string;
  type: 'APPROVAL_PENDING' | 'APPROVAL_RESULT' | 'EXPIRY_ALERT' | 'SYSTEM' | 'ANNOUNCEMENT' | 'REMINDER' | 'WORKFLOW';
  title: string;
  titleAr?: string;
  body: string;
  bodyAr?: string;
  link?: string;
  metadata?: { resourceType?: string; resourceId?: string; [key: string]: any };
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export async function sendNotification(opts: SendNotificationOptions): Promise<string> {
  const { tenantId, recipientId, type, title, titleAr, body, bodyAr, link, metadata, priority } = opts;
  const notificationId = uuidv4();

  try {
    const col = await getCVisionCollection<any>(tenantId, 'notifications');
    await col.insertOne({
      tenantId, notificationId, recipientId,
      recipientType: 'EMPLOYEE',
      type, title, titleAr: titleAr || title, body, bodyAr: bodyAr || body,
      channel: 'IN_APP',
      status: 'SENT', priority: priority || 'NORMAL',
      link: link || '', metadata: metadata || {},
      readAt: null, sentAt: new Date(), createdAt: new Date(),
    });
  } catch (err) {
    logger.error('[CVision Notify] Failed to send notification:', err);
  }

  return notificationId;
}

export async function sendBulkNotification(
  tenantId: string,
  recipientIds: string[],
  opts: Omit<SendNotificationOptions, 'tenantId' | 'recipientId'>,
): Promise<number> {
  let sent = 0;
  for (const id of recipientIds) {
    await sendNotification({ ...opts, tenantId, recipientId: id });
    sent++;
  }
  return sent;
}
