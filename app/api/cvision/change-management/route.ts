import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

function nextId() { return `CHG-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`; }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CHANGE_MGMT_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires CHANGE_MGMT_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_change_initiatives');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await col.find({ tenantId }).sort({ createdAt: -1 }).limit(50).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'get') {
    const id = searchParams.get('id');
    const data = await col.findOne({ tenantId, initiativeId: id });
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'dashboard') {
    const all = await col.find({ tenantId, status: { $nin: ['CANCELLED'] } }).limit(200).toArray();
    const active = all.filter((i: any) => i.status === 'IN_PROGRESS');
    const avgAdkar = active.length > 0 ? {
      awareness: Math.round(active.reduce((s, i: any) => s + (i.adkarScores?.awareness || 0), 0) / active.length),
      desire: Math.round(active.reduce((s, i: any) => s + (i.adkarScores?.desire || 0), 0) / active.length),
      knowledge: Math.round(active.reduce((s, i: any) => s + (i.adkarScores?.knowledge || 0), 0) / active.length),
      ability: Math.round(active.reduce((s, i: any) => s + (i.adkarScores?.ability || 0), 0) / active.length),
      reinforcement: Math.round(active.reduce((s, i: any) => s + (i.adkarScores?.reinforcement || 0), 0) / active.length),
    } : { awareness: 0, desire: 0, knowledge: 0, ability: 0, reinforcement: 0 };
    const avgAdoption = active.length > 0 ? Math.round(active.reduce((s, i: any) => s + (i.adoptionRate || 0), 0) / active.length) : 0;
    const byStatus: Record<string, number> = {};
    all.forEach((i: any) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
    return NextResponse.json({ ok: true, data: { total: all.length, active: active.length, avgAdkar, avgAdoption, byStatus } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.change_mgmt.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CHANGE_MGMT_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires CHANGE_MGMT_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_change_initiatives');
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, initiativeId: nextId(), title: body.title || '', titleAr: body.titleAr || '',
      description: body.description || '',
      type: body.type || 'CUSTOM', sponsor: body.sponsor || { employeeId: '', name: '' },
      changeManager: body.changeManager || { employeeId: userId, name: '' },
      priority: body.priority || 'MEDIUM', status: 'PLANNING',
      adkarScores: { awareness: 0, desire: 0, knowledge: 0, ability: 0, reinforcement: 0 },
      kotterPhase: 1,
      impactedGroups: body.impactedGroups || [],
      communications: [], trainingSessions: [], risks: [], milestones: body.milestones || [],
      adoptionRate: 0, adoptionHistory: [],
      startDate: body.startDate || null, targetEndDate: body.targetEndDate || null, actualEndDate: null,
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update') {
    const { initiativeId, ...updates } = body;
    delete updates.action; delete updates.tenantId;
    if (!initiativeId) return NextResponse.json({ ok: false, error: 'initiativeId required' }, { status: 400 });
    await col.updateOne({ tenantId, initiativeId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-phase') {
    const { initiativeId, kotterPhase, status: newStatus } = body;
    if (!initiativeId) return NextResponse.json({ ok: false, error: 'initiativeId required' }, { status: 400 });
    const set: any = { updatedAt: new Date() };
    if (kotterPhase != null) set.kotterPhase = kotterPhase;
    if (newStatus) set.status = newStatus;
    await col.updateOne({ tenantId, initiativeId }, { $set: set });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-stakeholder') {
    const { initiativeId, group } = body;
    if (!initiativeId || !group) return NextResponse.json({ ok: false, error: 'initiativeId and group required' }, { status: 400 });
    await col.updateOne({ tenantId, initiativeId }, { $push: { impactedGroups: { ...group, readinessScore: group.readinessScore || 0, resistanceLevel: group.resistanceLevel || 'MEDIUM' } } as Record<string, unknown>, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-adoption') {
    const { initiativeId, adoptionRate, adkarScores } = body;
    if (!initiativeId) return NextResponse.json({ ok: false, error: 'initiativeId required' }, { status: 400 });
    const set: any = { updatedAt: new Date() };
    if (adoptionRate != null) set.adoptionRate = adoptionRate;
    if (adkarScores) set.adkarScores = adkarScores;
    const push: any = {};
    if (adoptionRate != null) push.adoptionHistory = { date: new Date(), rate: adoptionRate };
    await col.updateOne({ tenantId, initiativeId }, { $set: set, ...(Object.keys(push).length > 0 ? { $push: push } : {}) });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-risk') {
    const { initiativeId, risk } = body;
    if (!initiativeId || !risk) return NextResponse.json({ ok: false, error: 'initiativeId and risk required' }, { status: 400 });
    await col.updateOne({ tenantId, initiativeId }, { $push: { risks: { riskId: uuidv4(), ...risk, status: 'OPEN' } } as Record<string, unknown>, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-communication') {
    const { initiativeId, communication } = body;
    if (!initiativeId || !communication) return NextResponse.json({ ok: false, error: 'initiativeId and communication required' }, { status: 400 });
    await col.updateOne({ tenantId, initiativeId }, { $push: { communications: { commId: uuidv4(), ...communication, status: 'PLANNED' } } as Record<string, unknown>, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.change_mgmt.write' });
