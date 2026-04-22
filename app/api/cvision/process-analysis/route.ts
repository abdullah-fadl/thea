import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { calculateProcessMetrics } from '@/lib/cvision/od/process-metrics';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.PROCESS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires PROCESS_READ');
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';

  if (action === 'dashboard') {
    const data = await calculateProcessMetrics(tenantId, 6);
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'process') {
    const type = searchParams.get('type') || 'LEAVE';
    const data = await calculateProcessMetrics(tenantId, 6);
    const proc = data.processMetrics.find(p => p.processType === type);
    return NextResponse.json({ ok: true, data: proc || null });
  }
  if (action === 'bottlenecks') {
    const data = await calculateProcessMetrics(tenantId, 3);
    return NextResponse.json({ ok: true, data: data.topBottlenecks });
  }
  if (action === 'sla-report') {
    const data = await calculateProcessMetrics(tenantId, 6);
    const slaReport = data.processMetrics.map(p => ({ processType: p.processType, slaTarget: p.slaTarget, slaComplianceRate: p.slaComplianceRate, totalInstances: p.totalInstances, avgDuration: p.avgDuration }));
    return NextResponse.json({ ok: true, data: slaReport });
  }
  if (action === 'trends') {
    const months = parseInt(searchParams.get('months') || '6', 10);
    const data = await calculateProcessMetrics(tenantId, months);
    const trends = data.processMetrics.map(p => ({ processType: p.processType, monthlyTrend: p.monthlyTrend }));
    return NextResponse.json({ ok: true, data: trends });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.process.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.PROCESS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires PROCESS_WRITE');
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'set-sla') {
    const { processType, targetHours, warningHours, criticalHours } = body;
    if (!processType || !targetHours) return NextResponse.json({ ok: false, error: 'processType and targetHours required' }, { status: 400 });
    const slaCol = db.collection('cvision_process_slas');
    await slaCol.updateOne(
      { tenantId, processType },
      { $set: { targetHours, warningHours: warningHours || targetHours * 0.8, criticalHours: criticalHours || targetHours * 1.5, updatedAt: new Date() }, $setOnInsert: { tenantId, processType, createdAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'create-improvement') {
    const impCol = db.collection('cvision_process_improvements');
    const doc = {
      tenantId, improvementId: uuidv4(), title: body.title || '', description: body.description || '',
      processType: body.processType || '', estimatedSaving: body.estimatedSaving || '',
      priority: body.priority || 'MEDIUM', status: 'PROPOSED', owner: body.owner || userId,
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await impCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.process.write' });
