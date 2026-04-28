/**
 * CVision Notifications API (expanded)
 *
 * GET  action=list, unread-count, preferences
 * POST action=mark-read, mark-all-read, send, send-bulk, delete, update-preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const col = await getCVisionCollection<any>(tenantId, 'notifications');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const type = searchParams.get('type');
    const filter: any = { tenantId, recipientId: userId };
    if (type) filter.type = type;
    const [data, total] = await Promise.all([
      col.find(filter).sort({ readAt: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);
    return NextResponse.json({ ok: true, data, total, page, pages: Math.ceil(total / limit) });
  }

  if (action === 'unread-count') {
    const count = await col.countDocuments({ tenantId, recipientId: userId, readAt: null });
    return NextResponse.json({ ok: true, count });
  }

  if (action === 'preferences') {
    const db = await getCVisionDb(tenantId);
    const prefs = await db.collection('cvision_notification_preferences').findOne({ tenantId, employeeId: userId });
    return NextResponse.json({ ok: true, data: prefs || { channels: { inApp: true, email: true, sms: false }, quietHoursStart: null, quietHoursEnd: null, mutedTypes: [] } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.notifications.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const col = await getCVisionCollection<any>(tenantId, 'notifications');
  const body = await request.json();
  const action = body.action;

  if (action === 'mark-read') {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    await col.updateOne({ tenantId, notificationId: id, recipientId: userId }, { $set: { readAt: new Date(), status: 'READ' } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark-all-read') {
    await col.updateMany({ tenantId, recipientId: userId, readAt: null }, { $set: { readAt: new Date(), status: 'READ' } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'send') {
    const { recipientId, type, title, titleAr, body: notifBody, bodyAr, link, metadata, priority } = body;
    if (!recipientId || !title) return NextResponse.json({ ok: false, error: 'recipientId and title required' }, { status: 400 });
    const doc = { tenantId, notificationId: uuidv4(), recipientId, recipientType: 'EMPLOYEE', type: type || 'SYSTEM', title, titleAr: titleAr || title, body: notifBody || '', bodyAr: bodyAr || '', channel: 'IN_APP', status: 'SENT', priority: priority || 'NORMAL', link: link || '', metadata: metadata || {}, readAt: null, sentAt: new Date(), createdAt: new Date() };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'send-bulk') {
    const { recipientIds, departmentId, sendToAll, ...notifData } = body;

    /** Number of notification documents inserted per MongoDB bulkWrite. */
    const BATCH_SIZE = 200;

    const makeDoc = (id: string) => ({
      tenantId,
      notificationId: uuidv4(),
      recipientId: id,
      recipientType: 'EMPLOYEE',
      type: notifData.type || 'ANNOUNCEMENT',
      title: notifData.title || '',
      titleAr: notifData.titleAr || '',
      body: notifData.body || '',
      bodyAr: notifData.bodyAr || '',
      channel: 'IN_APP',
      status: 'SENT',
      priority: notifData.priority || 'NORMAL',
      link: notifData.link || '',
      metadata: notifData.metadata || {},
      readAt: null,
      sentAt: new Date(),
      createdAt: new Date(),
    });

    /**
     * Insert an array of recipient IDs in batches to avoid building a
     * single massive array of documents in memory.
     */
    const insertInBatches = async (ids: string[]): Promise<number> => {
      let totalInserted = 0;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const docs = batch.map(makeDoc);
        await col.insertMany(docs);
        totalInserted += docs.length;
      }
      return totalInserted;
    };

    let totalSent = 0;

    if (sendToAll || departmentId) {
      // Stream employee IDs from the database using a cursor so we never
      // materialise the full employee list in memory at once.
      const empCol = await getCVisionCollection<any>(tenantId, 'employees');
      const filter: Record<string, any> = { tenantId };
      if (sendToAll) {
        filter.status = { $in: ['ACTIVE', 'active'] };
      } else {
        filter.departmentId = departmentId;
      }

      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await empCol.find(filter).project({ employeeId: 1 }).skip(skip).limit(BATCH_SIZE).toArray();
        if (batch.length === 0) {
          hasMore = false;
          break;
        }
        const ids = batch.map((e: any) => e.employeeId).filter(Boolean);
        if (ids.length > 0) {
          const docs = ids.map(makeDoc);
          await col.insertMany(docs);
          totalSent += docs.length;
        }
        skip += BATCH_SIZE;
        if (batch.length < BATCH_SIZE) hasMore = false;
      }

    } else {
      // Caller supplied an explicit list of recipient IDs.
      const ids: string[] = (recipientIds || []).filter(Boolean);
      totalSent = await insertInBatches(ids);
    }

    return NextResponse.json({ ok: true, sent: totalSent });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    await col.deleteOne({ tenantId, notificationId: id, recipientId: userId });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-preferences') {
    const { channels, quietHoursStart, quietHoursEnd, mutedTypes } = body;
    const db = await getCVisionDb(tenantId);
    await db.collection('cvision_notification_preferences').updateOne(
      { tenantId, employeeId: userId },
      { $set: { channels, quietHoursStart, quietHoursEnd, mutedTypes, updatedAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.notifications.write' });
