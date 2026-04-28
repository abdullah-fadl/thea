/**
 * Internal Communications Engine
 *
 * Provides announcements (company/department-wide), direct messaging
 * between employees, and a general-purpose notification system.
 *
 * Works alongside (not replacing) the existing recruitment-focused
 * cvision_notifications. This engine adds announcements, DMs,
 * and broader notification categories.
 *
 * Collections:
 *   cvision_announcements  — Company/department/branch announcements
 *   cvision_messages       — Direct messages between employees
 *   cvision_comms_notifications — General HR notifications (broader than recruitment)
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_COLLECTIONS } from '@/lib/cvision/constants';

// ─── Collection helpers ─────────────────────────────────────────────────────

const ANN_COL = 'cvision_announcements';
const MSG_COL = 'cvision_messages';
const NOTIF_COL = 'cvision_comms_notifications';

async function annCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(ANN_COL);
}

async function msgCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(MSG_COL);
}

async function notifCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(NOTIF_COL);
}

async function empCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection(CVISION_COLLECTIONS.employees);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type AnnouncementType = 'GENERAL' | 'POLICY' | 'EVENT' | 'URGENT' | 'HR_UPDATE' | 'SYSTEM';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

export interface AnnouncementComment {
  id: string;
  employeeId: string;
  employeeName: string;
  content: string;
  createdAt: Date;
}

export interface Announcement {
  id: string;
  tenantId: string;
  announcementId: string;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: Priority;
  audience: 'ALL' | 'DEPARTMENT' | 'BRANCH' | 'ROLE' | 'SPECIFIC';
  audienceFilter?: {
    departments?: string[];
    branches?: string[];
    roles?: string[];
    employeeIds?: string[];
  };
  status: AnnouncementStatus;
  publishedAt?: Date;
  scheduledAt?: Date;
  expiresAt?: Date;
  publishedBy: string;
  publishedByName: string;
  readBy: { employeeId: string; readAt: Date }[];
  readCount: number;
  totalAudience: number;
  pinned: boolean;
  requiresAcknowledgment: boolean;
  acknowledgedBy: { employeeId: string; acknowledgedAt: Date }[];
  allowComments: boolean;
  comments: AnnouncementComment[];
  createdAt: Date;
  updatedAt: Date;
}

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface DirectMessage {
  id: string;
  tenantId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  subject?: string;
  content: string;
  status: MessageStatus;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  threadId: string;
  parentMessageId?: string;
  isReply: boolean;
}

export type NotificationType = 'INFO' | 'WARNING' | 'ACTION_REQUIRED' | 'APPROVAL' | 'REMINDER' | 'SYSTEM';
export type NotificationCategory =
  | 'LEAVE' | 'ATTENDANCE' | 'PAYROLL' | 'PERFORMANCE'
  | 'DISCIPLINARY' | 'RECRUITMENT' | 'GENERAL' | 'RETENTION'
  | 'IQAMA' | 'SYSTEM' | 'ANNOUNCEMENT';

export interface CommsNotification {
  id: string;
  tenantId: string;
  notificationId: string;
  recipientId: string;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  isDismissed: boolean;
  priority: Priority;
  createdAt: Date;
  expiresAt?: Date;
}

// ─── ID generators ──────────────────────────────────────────────────────────

async function nextAnnId(tenantId: string): Promise<string> {
  const c = await annCol(tenantId);
  const count = await c.countDocuments({ tenantId });
  return `ANN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

async function nextMsgId(tenantId: string): Promise<string> {
  const c = await msgCol(tenantId);
  const count = await c.countDocuments({ tenantId });
  return `MSG-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
}

async function nextNotifId(tenantId: string): Promise<string> {
  const c = await notifCol(tenantId);
  const count = await c.countDocuments({ tenantId });
  return `NTF-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function createAnnouncement(
  tenantId: string,
  data: Partial<Announcement>,
  createdBy: string
): Promise<Announcement> {
  const c = await annCol(tenantId);
  const now = new Date();

  // Calculate audience size
  let totalAudience = 0;
  if (data.audience === 'ALL' || !data.audience) {
    const ec = await empCol(tenantId);
    totalAudience = await ec.countDocuments({ tenantId, deletedAt: { $exists: false }, status: { $in: ['ACTIVE', 'PROBATION'] } });
  } else if (data.audienceFilter?.departments?.length) {
    const ec = await empCol(tenantId);
    totalAudience = await ec.countDocuments({ tenantId, deletedAt: { $exists: false }, departmentId: { $in: data.audienceFilter.departments } });
  } else if (data.audienceFilter?.employeeIds?.length) {
    totalAudience = data.audienceFilter.employeeIds.length;
  } else {
    totalAudience = 0;
  }

  const ann: Announcement = {
    id: uuidv4(),
    tenantId,
    announcementId: await nextAnnId(tenantId),
    title: data.title || '',
    content: data.content || '',
    type: data.type || 'GENERAL',
    priority: data.priority || 'NORMAL',
    audience: data.audience || 'ALL',
    audienceFilter: data.audienceFilter,
    status: data.status || 'DRAFT',
    publishedBy: createdBy,
    publishedByName: data.publishedByName || '',
    readBy: [],
    readCount: 0,
    totalAudience,
    pinned: data.pinned ?? false,
    requiresAcknowledgment: data.requiresAcknowledgment ?? false,
    acknowledgedBy: [],
    allowComments: data.allowComments ?? true,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };

  if (data.scheduledAt) {
    ann.status = 'SCHEDULED';
    ann.scheduledAt = new Date(data.scheduledAt);
  }

  await c.insertOne(ann as unknown as Record<string, unknown>);
  return ann;
}

export async function publishAnnouncement(
  tenantId: string,
  announcementId: string
): Promise<Announcement> {
  const c = await annCol(tenantId);
  const now = new Date();

  await c.updateOne(
    { tenantId, $or: [{ announcementId }, { id: announcementId }] },
    { $set: { status: 'PUBLISHED', publishedAt: now, updatedAt: now } }
  );

  const updated = await c.findOne({ tenantId, $or: [{ announcementId }, { id: announcementId }] });
  return updated as unknown as Announcement;
}

export async function getAnnouncements(
  tenantId: string,
  filters?: { status?: string; type?: string; audience?: string }
): Promise<Announcement[]> {
  const c = await annCol(tenantId);
  const query: Record<string, unknown> = { tenantId };
  if (filters?.status) query.status = filters.status;
  if (filters?.type) query.type = filters.type;

  return (await c.find(query).sort({ pinned: -1, publishedAt: -1, createdAt: -1 }).toArray()) as unknown as Announcement[];
}

export async function getAnnouncementDetail(
  tenantId: string,
  announcementId: string
): Promise<Announcement | null> {
  const c = await annCol(tenantId);
  const result = await c.findOne({ tenantId, $or: [{ announcementId }, { id: announcementId }] });
  return (result as unknown as Announcement) || null;
}

export async function markAnnouncementRead(
  tenantId: string,
  announcementId: string,
  employeeId: string
): Promise<void> {
  const c = await annCol(tenantId);
  const ann = await c.findOne({ tenantId, $or: [{ announcementId }, { id: announcementId }] }) as Record<string, unknown> | null;
  if (!ann) return;

  const readByList = (ann.readBy || []) as { employeeId: string }[];
  const alreadyRead = readByList.some((r) => r.employeeId === employeeId);
  if (alreadyRead) return;

  await c.updateOne(
    { tenantId, $or: [{ announcementId }, { id: announcementId }] },
    {
      $push: { readBy: { employeeId, readAt: new Date() } } as Record<string, unknown>,
      $inc: { readCount: 1 },
      $set: { updatedAt: new Date() },
    }
  );
}

export async function acknowledgeAnnouncement(
  tenantId: string,
  announcementId: string,
  employeeId: string
): Promise<void> {
  const c = await annCol(tenantId);
  const ann = await c.findOne({ tenantId, $or: [{ announcementId }, { id: announcementId }] }) as Record<string, unknown> | null;
  if (!ann) return;

  const ackedList = (ann.acknowledgedBy || []) as { employeeId: string }[];
  const already = ackedList.some((a) => a.employeeId === employeeId);
  if (already) return;

  await c.updateOne(
    { tenantId, $or: [{ announcementId }, { id: announcementId }] },
    {
      $push: { acknowledgedBy: { employeeId, acknowledgedAt: new Date() } } as Record<string, unknown>,
      $set: { updatedAt: new Date() },
    }
  );

  // Also mark as read
  await markAnnouncementRead(tenantId, announcementId, employeeId);
}

export async function addComment(
  tenantId: string,
  announcementId: string,
  employeeId: string,
  employeeName: string,
  content: string
): Promise<AnnouncementComment> {
  const c = await annCol(tenantId);
  const comment: AnnouncementComment = {
    id: uuidv4(),
    employeeId,
    employeeName,
    content,
    createdAt: new Date(),
  };

  await c.updateOne(
    { tenantId, $or: [{ announcementId }, { id: announcementId }] },
    { $push: { comments: comment } as Record<string, unknown>, $set: { updatedAt: new Date() } }
  );

  return comment;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

export async function sendMessage(
  tenantId: string,
  data: {
    senderId: string;
    senderName: string;
    recipientId: string;
    recipientName: string;
    subject?: string;
    content: string;
    threadId?: string;
    parentMessageId?: string;
  }
): Promise<DirectMessage> {
  const c = await msgCol(tenantId);
  const now = new Date();
  const threadId = data.threadId || uuidv4();

  const msg: DirectMessage = {
    id: uuidv4(),
    tenantId,
    messageId: await nextMsgId(tenantId),
    senderId: data.senderId,
    senderName: data.senderName,
    recipientId: data.recipientId,
    recipientName: data.recipientName,
    subject: data.subject,
    content: data.content,
    status: 'SENT',
    sentAt: now,
    threadId,
    parentMessageId: data.parentMessageId,
    isReply: !!data.parentMessageId,
  };

  await c.insertOne(msg as unknown as Record<string, unknown>);

  // Create notification for recipient
  await createNotification(tenantId, {
    recipientId: data.recipientId,
    title: `New message from ${data.senderName}`,
    message: data.subject || data.content.slice(0, 100),
    type: 'INFO',
    category: 'GENERAL',
    entityType: 'message',
    entityId: msg.messageId,
    actionUrl: '/cvision/communications?tab=messages',
    priority: 'NORMAL',
  });

  return msg;
}

export async function getInbox(
  tenantId: string,
  userId: string
): Promise<DirectMessage[]> {
  const c = await msgCol(tenantId);
  return (await c.find({ tenantId, recipientId: userId })
    .sort({ sentAt: -1 }).limit(100).toArray()) as unknown as DirectMessage[];
}

export async function getSentMessages(
  tenantId: string,
  userId: string
): Promise<DirectMessage[]> {
  const c = await msgCol(tenantId);
  return (await c.find({ tenantId, senderId: userId })
    .sort({ sentAt: -1 }).limit(100).toArray()) as unknown as DirectMessage[];
}

export async function getThread(
  tenantId: string,
  threadId: string
): Promise<DirectMessage[]> {
  const c = await msgCol(tenantId);
  return (await c.find({ tenantId, threadId }).sort({ sentAt: 1 }).toArray()) as unknown as DirectMessage[];
}

export async function markMessageRead(
  tenantId: string,
  messageId: string
): Promise<void> {
  const c = await msgCol(tenantId);
  await c.updateOne(
    { tenantId, $or: [{ messageId }, { id: messageId }] },
    { $set: { status: 'READ', readAt: new Date() } }
  );
}

export async function getUnreadMessageCount(
  tenantId: string,
  userId: string
): Promise<number> {
  const c = await msgCol(tenantId);
  return c.countDocuments({ tenantId, recipientId: userId, status: { $ne: 'READ' } });
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createNotification(
  tenantId: string,
  data: Partial<CommsNotification>
): Promise<CommsNotification> {
  const c = await notifCol(tenantId);
  const now = new Date();

  const notif: CommsNotification = {
    id: uuidv4(),
    tenantId,
    notificationId: await nextNotifId(tenantId),
    recipientId: data.recipientId || '',
    title: data.title || '',
    message: data.message || '',
    type: data.type || 'INFO',
    category: data.category || 'GENERAL',
    entityType: data.entityType,
    entityId: data.entityId,
    actionUrl: data.actionUrl,
    isRead: false,
    isDismissed: false,
    priority: data.priority || 'NORMAL',
    createdAt: now,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
  };

  await c.insertOne(notif as unknown as Record<string, unknown>);
  return notif;
}

export async function getNotifications(
  tenantId: string,
  userId: string,
  filters?: { unreadOnly?: boolean; category?: string; limit?: number }
): Promise<CommsNotification[]> {
  const c = await notifCol(tenantId);
  const query: Record<string, unknown> = { tenantId, recipientId: userId, isDismissed: false };
  if (filters?.unreadOnly) query.isRead = false;
  if (filters?.category) query.category = filters.category;

  const limit = filters?.limit || 50;
  return (await c.find(query).sort({ isRead: 1, createdAt: -1 }).limit(limit).toArray()) as unknown as CommsNotification[];
}

export async function markNotificationRead(
  tenantId: string,
  notificationId: string
): Promise<void> {
  const c = await notifCol(tenantId);
  await c.updateOne(
    { tenantId, $or: [{ notificationId }, { id: notificationId }] },
    { $set: { isRead: true, readAt: new Date() } }
  );
}

export async function markAllNotificationsRead(
  tenantId: string,
  userId: string
): Promise<number> {
  const c = await notifCol(tenantId);
  const result = await c.updateMany(
    { tenantId, recipientId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount;
}

export async function dismissNotification(
  tenantId: string,
  notificationId: string
): Promise<void> {
  const c = await notifCol(tenantId);
  await c.updateOne(
    { tenantId, $or: [{ notificationId }, { id: notificationId }] },
    { $set: { isDismissed: true } }
  );
}

export async function getUnreadCount(
  tenantId: string,
  userId: string
): Promise<number> {
  const c = await notifCol(tenantId);
  return c.countDocuments({ tenantId, recipientId: userId, isRead: false, isDismissed: false });
}

// ─── Bulk notification helpers ──────────────────────────────────────────────

export async function notifyDepartment(
  tenantId: string,
  departmentId: string,
  notification: Partial<CommsNotification>
): Promise<number> {
  const ec = await empCol(tenantId);
  const employees = await ec.find({
    tenantId, departmentId, deletedAt: { $exists: false },
    status: { $in: ['ACTIVE', 'PROBATION'] },
  }).project({ id: 1 }).toArray();

  let count = 0;
  for (const emp of employees) {
    await createNotification(tenantId, { ...notification, recipientId: String((emp as Record<string, unknown>).id) });
    count++;
  }
  return count;
}

export async function notifyAll(
  tenantId: string,
  notification: Partial<CommsNotification>
): Promise<number> {
  const ec = await empCol(tenantId);
  const employees = await ec.find({
    tenantId, deletedAt: { $exists: false },
    status: { $in: ['ACTIVE', 'PROBATION'] },
  }).project({ id: 1 }).toArray();

  let count = 0;
  for (const emp of employees) {
    await createNotification(tenantId, { ...notification, recipientId: String((emp as Record<string, unknown>).id) });
    count++;
  }
  return count;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getCommsStats(tenantId: string, userId: string): Promise<{
  unreadNotifications: number;
  unreadMessages: number;
  pendingAcknowledgments: number;
  totalAnnouncements: number;
}> {
  const [unreadNotifications, unreadMessages] = await Promise.all([
    getUnreadCount(tenantId, userId),
    getUnreadMessageCount(tenantId, userId),
  ]);

  const ac = await annCol(tenantId);
  const announcements = await ac.find({
    tenantId, status: 'PUBLISHED', requiresAcknowledgment: true,
  }).toArray() as unknown as Record<string, unknown>[];

  let pendingAcknowledgments = 0;
  for (const ann of announcements) {
    const ackedList = (ann.acknowledgedBy || []) as { employeeId: string }[];
    const acked = ackedList.some((a) => a.employeeId === userId);
    if (!acked) pendingAcknowledgments++;
  }

  const totalAnnouncements = await ac.countDocuments({ tenantId, status: 'PUBLISHED' });

  return { unreadNotifications, unreadMessages, pendingAcknowledgments, totalAnnouncements };
}
