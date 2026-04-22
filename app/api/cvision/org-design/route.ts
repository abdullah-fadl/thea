import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { compareStructures } from '@/lib/cvision/od/org-design-analyzer';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ORG_DESIGN_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires ORG_DESIGN_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_org_designs');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'scenarios';

  if (action === 'current') {
    const deptCol = db.collection('cvision_departments');
    const posCol = db.collection('cvision_positions');
    const depts = await deptCol.find({ tenantId }).limit(500).toArray();
    const positions = await posCol.find({ tenantId }).limit(5000).toArray();
    const structure = depts.map((d: any) => ({
      deptId: d.departmentId || d.deptId || d._id.toString(),
      name: d.name || d.nameEn || '', nameAr: d.nameAr || '',
      parentDeptId: d.parentDeptId || d.parentId || null,
      headId: d.headId || null, headName: d.headName || null,
      positions: positions.filter((p: any) => (p.departmentId || p.deptId) === (d.departmentId || d.deptId)).map((p: any) => ({
        positionId: p.positionId || p._id.toString(), title: p.title || p.nameEn || '', titleAr: p.titleAr || p.nameAr || '', gradeId: p.gradeId || '',
      })),
    }));
    return NextResponse.json({ ok: true, data: structure });
  }
  if (action === 'scenarios') {
    const data = await col.find({ tenantId }).sort({ createdAt: -1 }).limit(20).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'get') {
    const id = searchParams.get('id');
    const data = await col.findOne({ tenantId, scenarioId: id });
    return NextResponse.json({ ok: true, data });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.org_design.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ORG_DESIGN_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires ORG_DESIGN_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_org_designs');
  const body = await request.json();
  const action = body.action;

  if (action === 'create-scenario') {
    const doc = {
      tenantId, scenarioId: uuidv4(), name: body.name || '', nameAr: body.nameAr || '',
      description: body.description || '',
      type: body.type || 'CUSTOM', status: 'DRAFT',
      proposedStructure: { departments: body.departments || [] },
      analysis: null, changes: body.changes || [],
      createdBy: userId, approvedBy: null, appliedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update-scenario') {
    const { scenarioId, ...updates } = body;
    delete updates.action; delete updates.tenantId;
    if (!scenarioId) return NextResponse.json({ ok: false, error: 'scenarioId required' }, { status: 400 });
    await col.updateOne({ tenantId, scenarioId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'analyze') {
    const { scenarioId } = body;
    if (!scenarioId) return NextResponse.json({ ok: false, error: 'scenarioId required' }, { status: 400 });
    const scenario = await col.findOne({ tenantId, scenarioId }) as Record<string, unknown> | null;
    if (!scenario) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // Get current structure
    const deptCol = db.collection('cvision_departments');
    const posCol = db.collection('cvision_positions');
    const depts = await deptCol.find({ tenantId }).limit(500).toArray();
    const positions = await posCol.find({ tenantId }).limit(5000).toArray();
    const currentStructure = depts.map((d: any) => ({
      deptId: d.departmentId || d.deptId || d._id.toString(),
      name: d.name || d.nameEn || '', nameAr: d.nameAr || '',
      parentDeptId: d.parentDeptId || null, headId: d.headId || null, headName: d.headName || null,
      positions: positions.filter((p: any) => (p.departmentId || p.deptId) === (d.departmentId || d.deptId)).map((p: any) => ({
        positionId: p.positionId || p._id.toString(), title: p.title || p.nameEn || '', titleAr: p.titleAr || p.nameAr || '', gradeId: p.gradeId || '',
      })),
    }));

    const analysis = compareStructures(currentStructure, (scenario as any).proposedStructure?.departments || []);
    await col.updateOne({ tenantId, scenarioId }, { $set: { analysis, updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: analysis });
  }

  if (action === 'approve-scenario') {
    const { scenarioId } = body;
    await col.updateOne({ tenantId, scenarioId }, { $set: { status: 'APPROVED', approvedBy: userId, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'apply') {
    const { scenarioId } = body;
    await col.updateOne({ tenantId, scenarioId }, { $set: { status: 'APPLIED', appliedAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { note: 'Scenario marked as applied. Actual org chart updates require manual implementation.' } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.org_design.write' });
