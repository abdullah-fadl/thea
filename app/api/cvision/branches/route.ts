import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const branches = await db.collection('cvision_branches').find({ tenantId }).sort({ name: 1 }).limit(500).toArray();
    return NextResponse.json({ ok: true, data: branches });
  }

  if (action === 'get') {
    const id = searchParams.get('id');
    const branch = await db.collection('cvision_branches').findOne({ tenantId, branchId: id });
    if (!branch) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: branch });
  }

  if (action === 'stats') {
    const id = searchParams.get('id');
    const empCol = db.collection('cvision_employees');
    const headcount = await empCol.countDocuments({ tenantId, branchId: id, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null });
    const depts = await empCol.distinct('departmentName', { tenantId, branchId: id, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null });

    const pipeline = [
      { $match: { tenantId, branchId: id, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null } },
      { $group: { _id: '$departmentName', count: { $sum: 1 } } },
      { $sort: { count: -1 as const } },
    ];
    const deptBreakdown = await empCol.aggregate(pipeline).toArray();

    return NextResponse.json({ ok: true, data: { branchId: id, headcount, departmentCount: depts.length, departments: deptBreakdown } });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.branches.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ORG_STRUCTURE_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires ORG_STRUCTURE_WRITE');
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, branchId: uuid(),
      name: body.name, nameAr: body.nameAr || '', code: body.code || '',
      type: body.type || 'BRANCH',
      address: body.address || { street: '', city: '', region: '', postalCode: '', country: 'SA' },
      phone: body.phone || '', email: body.email || '',
      managerName: body.managerName || '', managerId: body.managerId || '',
      isActive: true,
      workingHours: body.workingHours || { start: '08:00', end: '17:00' },
      workingDays: body.workingDays || ['SUN', 'MON', 'TUE', 'WED', 'THU'],
      timezone: body.timezone || 'Asia/Riyadh',
      molLicenseNumber: body.molLicenseNumber || '',
      createdAt: new Date(), updatedAt: new Date(),
    };
    await db.collection('cvision_branches').insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update') {
    const update: any = { updatedAt: new Date() };
    const fields = ['name', 'nameAr', 'code', 'type', 'address', 'phone', 'email', 'managerName', 'managerId', 'workingHours', 'workingDays', 'timezone', 'molLicenseNumber'];
    for (const f of fields) { if (body[f] !== undefined) update[f] = body[f]; }
    await db.collection('cvision_branches').updateOne({ tenantId, branchId: body.branchId }, { $set: update });
    return NextResponse.json({ ok: true });
  }

  if (action === 'deactivate') {
    await db.collection('cvision_branches').updateOne({ tenantId, branchId: body.branchId }, { $set: { isActive: false, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.branches.write' });
