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
  const col = db.collection('cvision_teams');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await col.find({ tenantId, isActive: true }).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'get') {
    const id = searchParams.get('id');
    const doc = await col.findOne({ tenantId, id });
    return NextResponse.json({ ok: true, data: doc });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.org.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_teams');
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, id: uuidv4(), name: body.name || '', nameAr: body.nameAr || '',
      description: body.purpose || body.description || '',
      leadEmployeeId: body.leaderId || userId,
      members: body.members || [],
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
      createdBy: userId, updatedBy: userId,
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }
  if (action === 'update') {
    const { teamId, ...updates } = body; delete updates.action; delete updates.tenantId;
    if (!teamId) return NextResponse.json({ ok: false, error: 'teamId required' }, { status: 400 });
    await col.updateOne({ tenantId, id: teamId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'add-member') {
    const { teamId, employeeId, name, role } = body;
    if (!teamId || !employeeId) return NextResponse.json({ ok: false, error: 'teamId and employeeId required' }, { status: 400 });
    await col.updateOne({ tenantId, id: teamId }, { $push: { members: { employeeId, name: name || '', role: role || 'Member' } } as Record<string, unknown>, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'remove-member') {
    const { teamId, employeeId } = body;
    if (!teamId || !employeeId) return NextResponse.json({ ok: false, error: 'teamId and employeeId required' }, { status: 400 });
    await col.updateOne({ tenantId, id: teamId }, { $pull: { members: { employeeId } } as Record<string, unknown>, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'archive') {
    const { teamId } = body;
    if (!teamId) return NextResponse.json({ ok: false, error: 'teamId required' }, { status: 400 });
    await col.updateOne({ tenantId, id: teamId }, { $set: { isActive: false, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.org.write' });
