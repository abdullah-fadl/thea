/**
 * CVision Internal Communication Hub
 * Announcements, news feed, engagement tracking
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const ANNOUNCEMENT_TYPES = ['NEWS', 'CEO_MESSAGE', 'POLICY_UPDATE', 'EVENT', 'URGENT', 'DEPARTMENT', 'GENERAL'] as const;
export const AUDIENCE_TYPES = ['ALL', 'DEPARTMENT', 'BRANCH', 'CUSTOM'] as const;
export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

const COL = 'cvision_announcements';

export async function createAnnouncement(db: Db, tenantId: string, data: Record<string, unknown>): Promise<{ id: string }> {
  const id = uuidv4();
  const now = new Date();
  await db.collection(COL).insertOne({
    id, tenantId, announcementId: `ANN-${Date.now()}`,
    type: data.type || 'GENERAL', title: data.title, content: data.content,
    author: data.author, authorName: data.authorName, authorTitle: data.authorTitle || '',
    coverImage: data.coverImage, attachments: data.attachments || [],
    audience: data.audience || 'ALL',
    targetDepartments: data.targetDepartments || [], targetBranches: data.targetBranches || [],
    targetEmployeeIds: data.targetEmployeeIds || [],
    views: 0, likes: [], comments: [],
    publishAt: data.publishAt ? new Date(data.publishAt as string) : null,
    pinned: false, pinnedUntil: null,
    readBy: [], requiresAcknowledgment: data.requiresAcknowledgment || false, acknowledgedBy: [],
    status: 'DRAFT', createdAt: now, updatedAt: now,
  });
  return { id };
}

export async function publishAnnouncement(db: Db, tenantId: string, announcementId: string): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, { $set: { status: 'PUBLISHED', updatedAt: new Date() } });
  return { success: true };
}

export async function archiveAnnouncement(db: Db, tenantId: string, announcementId: string): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, { $set: { status: 'ARCHIVED', updatedAt: new Date() } });
  return { success: true };
}

export async function pinAnnouncement(db: Db, tenantId: string, announcementId: string, pinnedUntil?: string): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, {
    $set: { pinned: true, pinnedUntil: pinnedUntil ? new Date(pinnedUntil) : null, updatedAt: new Date() },
  });
  return { success: true };
}

export async function likeAnnouncement(db: Db, tenantId: string, announcementId: string, employeeId: string): Promise<{ success: boolean }> {
  const doc = await db.collection(COL).findOne({ tenantId, id: announcementId });
  if (!doc) return { success: false };
  const likes = doc.likes || [];
  if (likes.includes(employeeId)) {
    await db.collection(COL).updateOne({ tenantId, id: announcementId }, { $pull: { likes: employeeId } });
  } else {
    await db.collection(COL).updateOne({ tenantId, id: announcementId }, { $push: { likes: employeeId } });
  }
  return { success: true };
}

export async function commentOnAnnouncement(db: Db, tenantId: string, announcementId: string, data: Record<string, unknown>): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, {
    $push: { comments: { employeeId: data.employeeId, employeeName: data.employeeName, text: data.text, createdAt: new Date() } },
  });
  return { success: true };
}

export async function acknowledgeAnnouncement(db: Db, tenantId: string, announcementId: string, employeeId: string): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, {
    $addToSet: { acknowledgedBy: { employeeId, acknowledgedAt: new Date() } },
  });
  return { success: true };
}

export async function markRead(db: Db, tenantId: string, announcementId: string, employeeId: string): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, {
    $addToSet: { readBy: { employeeId, readAt: new Date() } },
    $inc: { views: 1 },
  });
  return { success: true };
}

export async function scheduleAnnouncement(db: Db, tenantId: string, announcementId: string, publishAt: string): Promise<{ success: boolean }> {
  await db.collection(COL).updateOne({ tenantId, id: announcementId }, {
    $set: { publishAt: new Date(publishAt), updatedAt: new Date() },
  });
  return { success: true };
}

export async function getFeed(db: Db, tenantId: string, filters: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const query: Record<string, unknown> = { tenantId, status: 'PUBLISHED' };
  if (filters.type) query.type = filters.type;
  if (filters.departmentId) query.$or = [{ audience: 'ALL' }, { targetDepartments: filters.departmentId }];
  return db.collection(COL).find(query).sort({ pinned: -1, createdAt: -1 }).limit((filters.limit as number) || 50).toArray();
}

export async function getDetail(db: Db, tenantId: string, announcementId: string): Promise<Record<string, unknown> | null> {
  return db.collection(COL).findOne({ tenantId, id: announcementId });
}

export async function getPinned(db: Db, tenantId: string): Promise<Record<string, unknown>[]> {
  return db.collection(COL).find({ tenantId, pinned: true, status: 'PUBLISHED' }).sort({ createdAt: -1 }).toArray();
}

export async function getMyUnread(db: Db, tenantId: string, employeeId: string): Promise<Record<string, unknown>[]> {
  return db.collection(COL).find({
    tenantId, status: 'PUBLISHED', 'readBy.employeeId': { $ne: employeeId },
  }).sort({ createdAt: -1 }).limit(20).toArray();
}

export async function searchAnnouncements(db: Db, tenantId: string, query: string): Promise<Record<string, unknown>[]> {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return db.collection(COL).find({
    tenantId, $or: [
      { title: { $regex: escaped, $options: 'i' } },
      { content: { $regex: escaped, $options: 'i' } },
    ],
  }).sort({ createdAt: -1 }).limit(50).toArray();
}

export async function getDepartmentNews(db: Db, tenantId: string, departmentId: string): Promise<Record<string, unknown>[]> {
  return db.collection(COL).find({
    tenantId, status: 'PUBLISHED',
    $or: [{ audience: 'ALL' }, { audience: 'DEPARTMENT', targetDepartments: departmentId }],
  }).sort({ createdAt: -1 }).limit(30).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const total = await db.collection(COL).countDocuments({ tenantId });
  const published = await db.collection(COL).countDocuments({ tenantId, status: 'PUBLISHED' });
  const drafts = await db.collection(COL).countDocuments({ tenantId, status: 'DRAFT' });
  const pinned = await db.collection(COL).countDocuments({ tenantId, pinned: true });
  return { total, published, drafts, pinned };
}
