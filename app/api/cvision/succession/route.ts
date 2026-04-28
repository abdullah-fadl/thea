import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.SUCCESSION_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires SUCCESSION_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_succession_plans');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await col.find({ tenantId, status: { $ne: 'ARCHIVED' } }).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'get') {
    const id = searchParams.get('id');
    const doc = await col.findOne({ tenantId, positionId: id });
    return NextResponse.json({ ok: true, data: doc });
  }
  if (action === 'dashboard') {
    const plans = await col.find({ tenantId, status: 'ACTIVE' }).limit(500).toArray();
    const total = plans.length;
    const withReady = plans.filter((p: any) => (p.successors || []).some((s: any) => s.readiness === 'READY_NOW')).length;
    const critical = plans.filter((p: any) => p.criticality === 'CRITICAL').length;
    const criticalNoReady = plans.filter((p: any) => p.criticality === 'CRITICAL' && !(p.successors || []).some((s: any) => s.readiness === 'READY_NOW')).length;
    return NextResponse.json({ ok: true, data: { totalPositions: total, coveredPositions: withReady, coverageRate: total > 0 ? Math.round((withReady / total) * 100) : 0, criticalPositions: critical, atRisk: criticalNoReady } });
  }
  if (action === 'risk-analysis') {
    const plans = await col.find({ tenantId, status: 'ACTIVE' }).limit(500).toArray();
    const atRisk = plans.filter((p: any) => !(p.successors || []).some((s: any) => s.readiness === 'READY_NOW' || s.readiness === 'READY_1_YEAR'));
    return NextResponse.json({ ok: true, data: atRisk });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.succession.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.SUCCESSION_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SUCCESSION_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_succession_plans');
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, id: uuidv4(),
      positionId: body.positionId || uuidv4(),
      jobTitleId: body.jobTitleId || null,
      currentHolderId: body.currentIncumbent?.employeeId || null,
      successors: JSON.stringify([]),
      status: 'active',
      notes: JSON.stringify({ positionTitle: body.positionTitle || '', criticality: body.criticality || 'MEDIUM', departmentId: body.departmentId || '' }),
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'add-successor') {
    const { positionId, employeeId, name, readiness } = body;
    if (!positionId || !employeeId) return NextResponse.json({ ok: false, error: 'positionId and employeeId required' }, { status: 400 });
    const plan = await col.findOne({ tenantId, positionId }) as Record<string, unknown>;
    if (!plan) return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 404 });
    const existing = typeof plan.successors === 'string' ? JSON.parse(plan.successors) : (plan.successors || []);
    existing.push({ employeeId, name: name || '', readiness: readiness || 'DEVELOPING', lastAssessed: new Date() });
    await col.updateOne({ tenantId, positionId }, { $set: { successors: JSON.stringify(existing), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-readiness') {
    const { positionId, employeeId, readiness } = body;
    if (!positionId || !employeeId || !readiness) return NextResponse.json({ ok: false, error: 'positionId, employeeId, readiness required' }, { status: 400 });
    const plan = await col.findOne({ tenantId, positionId }) as Record<string, unknown>;
    if (!plan) return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 404 });
    const existing = typeof plan.successors === 'string' ? JSON.parse(plan.successors) : (plan.successors || []);
    const updated = existing.map((s: any) => s.employeeId === employeeId ? { ...s, readiness, lastAssessed: new Date() } : s);
    await col.updateOne({ tenantId, positionId }, { $set: { successors: JSON.stringify(updated), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.succession.write' });
