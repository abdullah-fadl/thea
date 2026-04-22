import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctx = await requireCtx(request);
  if (ctx instanceof NextResponse) return ctx;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get('tableId') || '';

  const prefs = await db.collection('cvision_table_preferences').findOne({ tenantId, userId: ctx.userId, tableId });
  return NextResponse.json({ ok: true, data: prefs || null });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctx = await requireCtx(request);
  if (ctx instanceof NextResponse) return ctx;
  const db = await getCVisionDb(tenantId);
  const body = await request.json();

  if (body.action !== 'save') return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });

  const { tableId, columns, sortBy, sortDir, pageSize, filters } = body;
  if (!tableId) return NextResponse.json({ ok: false, error: 'tableId required' }, { status: 400 });

  await db.collection('cvision_table_preferences').updateOne(
    { tenantId, userId: ctx.userId, tableId },
    { $set: { columns, sortBy, sortDir, pageSize, filters, updatedAt: new Date() }, $setOnInsert: { tenantId, userId: ctx.userId, tableId, createdAt: new Date() } },
    { upsert: true },
  );

  return NextResponse.json({ ok: true });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });
