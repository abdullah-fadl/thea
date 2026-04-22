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
  if (!hasPerm(ctx, CVISION_PERMISSIONS.SAFETY_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires SAFETY_READ');
  const db = await getCVisionDb(tenantId);
  const incCol = db.collection('cvision_safety_incidents');
  const insCol = db.collection('cvision_safety_inspections');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'incidents';

  if (action === 'incidents') {
    const data = await incCol.find({ tenantId }).sort({ date: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'inspections') {
    const data = await insCol.find({ tenantId }).sort({ scheduledDate: -1 }).limit(50).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'dashboard') {
    const incidents = await incCol.find({ tenantId }).limit(1000).toArray();
    const inspections = await insCol.find({ tenantId }).limit(1000).toArray();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    incidents.forEach((i: any) => { byType[i.type] = (byType[i.type] || 0) + 1; bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1; });
    const thisYear = incidents.filter((i: any) => new Date(i.date).getFullYear() === new Date().getFullYear());
    const inspPassed = inspections.filter((i: any) => i.overallResult === 'PASS').length;
    return NextResponse.json({ ok: true, data: { totalIncidents: incidents.length, thisYear: thisYear.length, byType, bySeverity, totalInspections: inspections.length, inspectionPassRate: inspections.length > 0 ? Math.round((inspPassed / inspections.length) * 100) : 0 } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.safety.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.SAFETY_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SAFETY_WRITE');
  const db = await getCVisionDb(tenantId);
  const incCol = db.collection('cvision_safety_incidents');
  const insCol = db.collection('cvision_safety_inspections');
  const body = await request.json();
  const action = body.action;

  if (action === 'report-incident') {
    const doc = {
      tenantId, incidentId: uuidv4(), date: body.date || new Date(), time: body.time || '',
      location: body.location || '', type: body.type || 'OTHER',
      severity: body.severity || 'MINOR', description: body.description || '',
      involvedEmployees: body.involvedEmployees || [],
      rootCause: body.rootCause || null, correctiveActions: body.correctiveActions || [],
      status: 'REPORTED', reportedBy: userId, investigation: null,
      createdAt: new Date(),
    };
    await incCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'create-inspection') {
    const doc = {
      tenantId, inspectionId: uuidv4(), area: body.area || '',
      scheduledDate: body.scheduledDate || new Date(), inspectorId: body.inspectorId || userId,
      checklist: (body.checklist || []).map((item: any) => ({ item: item.item || item, status: 'NA', notes: '' })),
      status: 'SCHEDULED', overallResult: null, findings: [],
      createdAt: new Date(),
    };
    await insCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'complete-inspection') {
    const { inspectionId, checklist, findings } = body;
    if (!inspectionId) return NextResponse.json({ ok: false, error: 'inspectionId required' }, { status: 400 });
    const failCount = (checklist || []).filter((c: any) => c.status === 'FAIL').length;
    const result = failCount > 0 ? 'FAIL' : 'PASS';
    await insCol.updateOne({ tenantId, inspectionId }, { $set: { checklist: checklist || [], overallResult: result, findings: findings || [], status: 'COMPLETED', completedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { result } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.safety.write' });
