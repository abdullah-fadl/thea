import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { getUndoHistory, undoChange } from '@/lib/cvision/undo';
import { getDeleted, restore as restoreRecord } from '@/lib/cvision/soft-delete';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctx = await requireCtx(request);
  if (ctx instanceof NextResponse) return ctx;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'history';

  if (action === 'history') {
    const data = await getUndoHistory(tenantId, ctx.userId, 20);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'deleted') {
    const collection = searchParams.get('collection') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const result = await getDeleted(tenantId, collection, page);
    return NextResponse.json({ ok: true, data: result });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctx = await requireCtx(request);
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json();
  const action = body.action;

  if (action === 'undo') {
    try {
      await undoChange(tenantId, body.changeId);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
  }

  if (action === 'restore') {
    try {
      await restoreRecord(tenantId, body.collection, body.id, ctx.userId);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });
