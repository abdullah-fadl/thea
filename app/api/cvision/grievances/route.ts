import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_grievances');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.GRIEVANCES_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires GRIEVANCES_READ');
    const status = searchParams.get('status');
    const filter: any = { tenantId };
    if (status) filter.status = status;
    const rows = await col.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    // Add grievanceId alias and category alias for backward compatibility
    const data = rows.map((r: any) => ({ ...r, grievanceId: r.id, category: r.type, resolutionDate: r.resolvedAt }));
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'my-grievances') {
    const empId = ctx.employeeId || userId;
    const rows = await col.find({ tenantId, employeeId: empId }).sort({ createdAt: -1 }).limit(100).toArray();
    const data = rows.map((r: any) => ({ ...r, grievanceId: r.id, category: r.type, resolutionDate: r.resolvedAt }));
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'report') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.GRIEVANCES_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires GRIEVANCES_READ');
    const all = await col.find({ tenantId }).limit(1000).toArray();
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    all.forEach((g: any) => { byCategory[g.type] = (byCategory[g.type] || 0) + 1; byStatus[g.status] = (byStatus[g.status] || 0) + 1; bySeverity[g.severity] = (bySeverity[g.severity] || 0) + 1; });
    const resolved = all.filter((g: any) => g.resolvedAt);
    const avgResolution = resolved.length > 0 ? Math.round(resolved.reduce((s, g: any) => s + (new Date(g.resolvedAt).getTime() - new Date(g.createdAt).getTime()), 0) / resolved.length / (24 * 60 * 60 * 1000)) : 0;
    return NextResponse.json({ ok: true, data: { total: all.length, byCategory, byStatus, bySeverity, avgResolutionDays: avgResolution } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.grievances.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_grievances');
  const body = await request.json();
  const action = body.action;

  if (action === 'submit') {
    const isAnonymous = body.anonymous ?? false;
    const category = body.category || 'OTHER';
    const autoHigh = ['HARASSMENT', 'DISCRIMINATION'].includes(category);
    const severity = autoHigh ? 'HIGH' : (body.severity || 'MEDIUM');
    const grievanceUuid = uuidv4();
    // PostgreSQL schema: id (PK), tenantId, employeeId, type, description, severity,
    // againstEmployeeId, status, resolution, resolvedBy, resolvedAt, isConfidential,
    // createdAt, updatedAt, createdBy, updatedBy
    const doc = {
      id: grievanceUuid,
      tenantId,
      employeeId: isAnonymous ? '' : (ctx.employeeId || userId),
      type: category,
      description: body.description || body.subject || '',
      severity,
      againstEmployeeId: body.againstEmployeeId || null,
      status: 'SUBMITTED',
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
      isConfidential: autoHigh || body.isConfidential || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: { grievanceId: grievanceUuid, id: grievanceUuid, status: 'SUBMITTED' } });
  }

  if (action === 'assign') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.GRIEVANCES_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires GRIEVANCES_WRITE');
    const { grievanceId, assignedTo, assignedToName } = body;
    const gId = grievanceId || body.id;
    if (!gId) return NextResponse.json({ ok: false, error: 'grievanceId required' }, { status: 400 });
    await col.updateOne({ tenantId, id: gId }, {
      $set: { status: 'UNDER_REVIEW', updatedAt: new Date(), updatedBy: userId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-status') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.GRIEVANCES_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires GRIEVANCES_WRITE');
    const { grievanceId, status, notes } = body;
    const gId = grievanceId || body.id;
    if (!gId || !status) return NextResponse.json({ ok: false, error: 'grievanceId and status required' }, { status: 400 });
    await col.updateOne({ tenantId, id: gId }, {
      $set: { status, updatedAt: new Date(), updatedBy: userId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'add-note') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.GRIEVANCES_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires GRIEVANCES_WRITE');
    const { grievanceId, notes } = body;
    const gId = grievanceId || body.id;
    if (!gId) return NextResponse.json({ ok: false, error: 'grievanceId required' }, { status: 400 });
    // Note: 'description' is the only text column. We append to it for investigation notes.
    await col.updateOne({ tenantId, id: gId }, {
      $set: { updatedAt: new Date(), updatedBy: userId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'resolve') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.GRIEVANCES_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires GRIEVANCES_WRITE');
    const { grievanceId, resolution } = body;
    const gId = grievanceId || body.id;
    if (!gId) return NextResponse.json({ ok: false, error: 'grievanceId required' }, { status: 400 });
    await col.updateOne({ tenantId, id: gId }, {
      $set: { status: 'RESOLVED', resolution: resolution || '', resolvedBy: userId, resolvedAt: new Date(), updatedAt: new Date(), updatedBy: userId },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.grievances.write' });
