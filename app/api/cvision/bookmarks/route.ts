import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as engine from '@/lib/cvision/bookmarks/bookmarks-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const uid = userId || 'anonymous';
  await engine.ensureSeedData(db, tenantId, uid);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const bookmarks = await engine.listBookmarks(db, tenantId, uid);
    return NextResponse.json({ ok: true, bookmarks });
  }
  if (action === 'pinned') {
    const pinned = await engine.getPinned(db, tenantId, uid);
    return NextResponse.json({ ok: true, bookmarks: pinned });
  }
  if (action === 'recent-pages') {
    const recent = await engine.getRecentPages(db, tenantId, uid);
    return NextResponse.json({ ok: true, recent });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const uid = userId || 'anonymous';
  const body = await request.json();
  const { action } = body;

  if (action === 'add') {
    const id = await engine.addBookmark(db, tenantId, uid, body);
    return NextResponse.json({ ok: true, id });
  }
  if (action === 'remove') {
    await engine.removeBookmark(db, tenantId, uid, body.url);
    return NextResponse.json({ ok: true });
  }
  if (action === 'pin') {
    await engine.pinBookmark(db, tenantId, uid, body.url);
    return NextResponse.json({ ok: true });
  }
  if (action === 'unpin') {
    await engine.unpinBookmark(db, tenantId, uid, body.url);
    return NextResponse.json({ ok: true });
  }
  if (action === 'reorder') {
    await engine.reorderBookmarks(db, tenantId, uid, body.orderedUrls);
    return NextResponse.json({ ok: true });
  }
  if (action === 'track-page') {
    await engine.trackPageVisit(db, tenantId, uid, body.title, body.url);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
