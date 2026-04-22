import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type BookmarkType = 'PAGE' | 'EMPLOYEE' | 'REPORT' | 'CUSTOM';

const BOOKMARKS_COLL = 'cvision_bookmarks';
const RECENT_COLL = 'cvision_recent_pages';

/* ── Seed ──────────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string, userId: string) {
  const coll = db.collection(BOOKMARKS_COLL);
  if (await coll.countDocuments({ tenantId, userId }) > 0) return;

  const now = new Date();
  await coll.insertMany([
    { tenantId, userId, title: 'Dashboard', url: '/cvision', icon: '📊', type: 'PAGE' as BookmarkType, pinned: true, order: 1, createdAt: now },
    { tenantId, userId, title: 'Employees', url: '/cvision/employees', icon: '👤', type: 'PAGE' as BookmarkType, pinned: true, order: 2, createdAt: now },
    { tenantId, userId, title: 'Payroll', url: '/cvision/payroll', icon: '💰', type: 'PAGE' as BookmarkType, pinned: false, order: 3, createdAt: now },
  ]);
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function listBookmarks(db: Db, tenantId: string, userId: string) {
  return db.collection(BOOKMARKS_COLL).find({ tenantId, userId }).sort({ order: 1 }).toArray();
}

export async function getPinned(db: Db, tenantId: string, userId: string) {
  return db.collection(BOOKMARKS_COLL).find({ tenantId, userId, pinned: true }).sort({ order: 1 }).toArray();
}

export async function getRecentPages(db: Db, tenantId: string, userId: string, limit = 10) {
  return db.collection(RECENT_COLL).find({ tenantId, userId }).sort({ visitedAt: -1 }).limit(limit).toArray();
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function addBookmark(db: Db, tenantId: string, userId: string, data: { title: string; url: string; icon?: string; type?: BookmarkType }) {
  const existing = await db.collection(BOOKMARKS_COLL).findOne({ tenantId, userId, url: data.url });
  if (existing) return existing._id;
  const count = await db.collection(BOOKMARKS_COLL).countDocuments({ tenantId, userId });
  const result = await db.collection(BOOKMARKS_COLL).insertOne({
    tenantId, userId, title: data.title, url: data.url,
    icon: data.icon || '⭐', type: data.type || 'PAGE',
    pinned: false, order: count + 1, createdAt: new Date(),
  });
  return result.insertedId;
}

export async function removeBookmark(db: Db, tenantId: string, userId: string, url: string) {
  await db.collection(BOOKMARKS_COLL).deleteOne({ tenantId, userId, url });
}

export async function pinBookmark(db: Db, tenantId: string, userId: string, url: string) {
  await db.collection(BOOKMARKS_COLL).updateOne({ tenantId, userId, url }, { $set: { pinned: true } });
}

export async function unpinBookmark(db: Db, tenantId: string, userId: string, url: string) {
  await db.collection(BOOKMARKS_COLL).updateOne({ tenantId, userId, url }, { $set: { pinned: false } });
}

export async function reorderBookmarks(db: Db, tenantId: string, userId: string, orderedUrls: string[]) {
  for (let i = 0; i < orderedUrls.length; i++) {
    await db.collection(BOOKMARKS_COLL).updateOne(
      { tenantId, userId, url: orderedUrls[i] },
      { $set: { order: i + 1 } },
    );
  }
}

export async function trackPageVisit(db: Db, tenantId: string, userId: string, title: string, url: string) {
  await db.collection(RECENT_COLL).updateOne(
    { tenantId, userId, url },
    { $set: { title, url, tenantId, userId, visitedAt: new Date() } },
    { upsert: true },
  );
  const count = await db.collection(RECENT_COLL).countDocuments({ tenantId, userId });
  if (count > 20) {
    const oldest = await db.collection(RECENT_COLL).find({ tenantId, userId }).sort({ visitedAt: 1 }).limit(count - 20).toArray();
    if (oldest.length > 0) await db.collection(RECENT_COLL).deleteMany({ _id: { $in: oldest.map(o => o._id) }, tenantId });
  }
}
