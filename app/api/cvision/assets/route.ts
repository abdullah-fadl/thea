import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

function generateAssetId(): string { return `AST-${String(Date.now()).slice(-6)}`; }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ASSETS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires ASSETS_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_assets');
  const assignCol = db.collection('cvision_asset_assignments');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const filter: any = { tenantId };
    if (type) filter.category = type;
    if (status) filter.status = status;
    const data = await col.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'employee-assets') {
    const empId = searchParams.get('id');
    if (!empId) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const assignments = await assignCol.find({ tenantId, employeeId: empId, returnedAt: null }).limit(100).toArray();
    const assetIds = assignments.map((a: any) => a.assetId);
    const assets = assetIds.length > 0 ? await col.find({ tenantId, assetId: { $in: assetIds } }).toArray() : [];
    return NextResponse.json({ ok: true, data: assets });
  }
  if (action === 'report') {
    const all = await col.find({ tenantId }).limit(1000).toArray();
    const total = all.length;
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalValue = 0;
    all.forEach((a: any) => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; byCategory[a.category] = (byCategory[a.category] || 0) + 1; totalValue += a.purchaseCost || 0; });
    return NextResponse.json({ ok: true, data: { total, byStatus, byCategory, totalValue } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.assets.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ASSETS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires ASSETS_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_assets');
  const assignCol = db.collection('cvision_asset_assignments');
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, assetId: generateAssetId(), name: body.name || '', nameAr: body.nameAr || '',
      category: body.category || 'OTHER', brand: body.brand || '', model: body.model || '',
      serialNumber: body.serialNumber || '', purchaseDate: body.purchaseDate || null,
      purchaseCost: body.purchaseCost || 0, condition: body.condition || 'NEW',
      status: 'AVAILABLE', currentAssignee: null, location: body.location || '',
      notes: body.notes || '', warranty: body.warranty || null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'assign') {
    const { assetId, employeeId, employeeName } = body;
    if (!assetId || !employeeId) return NextResponse.json({ ok: false, error: 'assetId and employeeId required' }, { status: 400 });
    const asset = await col.findOne({ tenantId, assetId }) as Record<string, unknown> | null;
    if (!asset) return NextResponse.json({ ok: false, error: 'Asset not found' }, { status: 404 });
    if (asset.status === 'ASSIGNED') return NextResponse.json({ ok: false, error: 'Asset already assigned' }, { status: 400 });
    await assignCol.insertOne({ tenantId, assetId, employeeId, employeeName: employeeName || '', assignedAt: new Date(), returnedAt: null, condition_at_assign: asset.condition, assignedBy: userId, notes: body.notes || '' });
    await col.updateOne({ tenantId, assetId }, { $set: { status: 'ASSIGNED', currentAssignee: employeeId, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'return') {
    const { assetId, condition } = body;
    if (!assetId) return NextResponse.json({ ok: false, error: 'assetId required' }, { status: 400 });
    await assignCol.updateOne({ tenantId, assetId, returnedAt: null }, { $set: { returnedAt: new Date(), condition_at_return: condition || 'GOOD' } });
    await col.updateOne({ tenantId, assetId }, { $set: { status: 'AVAILABLE', currentAssignee: null, condition: condition || 'GOOD', updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'report-damage') {
    const { assetId, description } = body;
    if (!assetId) return NextResponse.json({ ok: false, error: 'assetId required' }, { status: 400 });
    await col.updateOne({ tenantId, assetId }, { $set: { condition: 'DAMAGED', status: 'MAINTENANCE', notes: description || '', updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'dispose') {
    const { assetId } = body;
    if (!assetId) return NextResponse.json({ ok: false, error: 'assetId required' }, { status: 400 });
    await col.updateOne({ tenantId, assetId }, { $set: { status: 'DISPOSED', condition: 'DISPOSED', updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.assets.write' });
