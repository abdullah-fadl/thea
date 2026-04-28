import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_announcements');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await col.find({ tenantId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort({ isPinned: -1, publishedAt: -1 }).limit(50).toArray();
    return NextResponse.json({ ok: true, data });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.notifications.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_announcements');
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, announcementId: uuidv4(), title: body.title || '', titleAr: body.titleAr || '',
      body: body.body || '', bodyAr: body.bodyAr || '',
      type: body.type || 'GENERAL', priority: body.priority || 'NORMAL',
      audience: body.audience || 'ALL', audienceIds: body.audienceIds || [],
      isPinned: body.isPinned || false,
      publishedAt: new Date(), expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      attachments: body.attachments || [], readBy: [],
      createdBy: userId, createdAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'pin') {
    const { announcementId } = body;
    if (!announcementId) return NextResponse.json({ ok: false, error: 'announcementId required' }, { status: 400 });
    const current = await col.findOne({ tenantId, announcementId }) as Record<string, unknown>;
    await col.updateOne({ tenantId, announcementId }, { $set: { isPinned: !current?.isPinned } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'archive') {
    const { announcementId } = body;
    if (!announcementId) return NextResponse.json({ ok: false, error: 'announcementId required' }, { status: 400 });
    await col.updateOne({ tenantId, announcementId }, { $set: { expiresAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark-read') {
    const { announcementId } = body;
    if (!announcementId) return NextResponse.json({ ok: false, error: 'announcementId required' }, { status: 400 });
    await col.updateOne({ tenantId, announcementId }, { $addToSet: { readBy: userId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.notifications.write' });
