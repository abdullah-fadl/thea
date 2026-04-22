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
  const db = await getCVisionDb(tenantId);
  const polCol = db.collection('cvision_policies');
  const ackCol = db.collection('cvision_policy_acknowledgments');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const status = searchParams.get('status') || 'PUBLISHED';
    const data = await polCol.find({ tenantId, status }).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'get') {
    const id = searchParams.get('id');
    const doc = await polCol.findOne({ tenantId, policyId: id });
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    const acked = await ackCol.findOne({ tenantId, policyId: id, employeeId: userId });
    return NextResponse.json({ ok: true, data: { ...doc, acknowledged: !!acked } });
  }
  if (action === 'my-pending') {
    const published = await polCol.find({ tenantId, status: 'PUBLISHED', requiresAcknowledgment: true }).limit(200).toArray();
    const myAcks = await ackCol.find({ tenantId, employeeId: userId }).limit(500).toArray();
    const ackedIds = new Set(myAcks.map((a: any) => a.policyId));
    const pending = published.filter((p: any) => !ackedIds.has(p.policyId));
    return NextResponse.json({ ok: true, data: pending });
  }
  if (action === 'ack-report') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const acks = await ackCol.find({ tenantId, policyId: id }).limit(5000).toArray();
    const empCol = db.collection('cvision_employees');
    const allEmps = await empCol.find({ tenantId, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null, isArchived: { $ne: true } }).project({ employeeId: 1, nameEn: 1, nameAr: 1 }).limit(5000).toArray();
    const ackedIds = new Set(acks.map((a: any) => a.employeeId));
    const acknowledged = allEmps.filter((e: any) => ackedIds.has(e.employeeId));
    const notAcknowledged = allEmps.filter((e: any) => !ackedIds.has(e.employeeId));
    return NextResponse.json({ ok: true, data: { total: allEmps.length, acknowledged: acknowledged.length, notAcknowledged: notAcknowledged.length, acknowledgedList: acknowledged, notAcknowledgedList: notAcknowledged } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.policies.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const polCol = db.collection('cvision_policies');
  const ackCol = db.collection('cvision_policy_acknowledgments');
  const body = await request.json();
  const action = body.action;

  if (action === 'acknowledge') {
    const { id } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const exists = await ackCol.findOne({ tenantId, policyId: id, employeeId: userId });
    if (exists) return NextResponse.json({ ok: true, message: 'Already acknowledged' });
    await ackCol.insertOne({ tenantId, policyId: id, employeeId: userId, acknowledgedAt: new Date() });
    return NextResponse.json({ ok: true });
  }

  if (!hasPerm(ctx, CVISION_PERMISSIONS.POLICIES_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires POLICIES_WRITE');

  if (action === 'create') {
    const doc = { tenantId, policyId: uuidv4(), title: body.title || '', titleAr: body.titleAr || '', category: body.category || 'GENERAL', content: body.content || '', contentAr: body.contentAr || '', version: 1, status: 'DRAFT', requiresAcknowledgment: body.requiresAcknowledgment ?? true, acknowledgmentDeadline: body.acknowledgmentDeadline || null, effectiveDate: body.effectiveDate || new Date(), createdBy: userId, publishedAt: null, createdAt: new Date(), updatedAt: new Date() };
    await polCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }
  if (action === 'update') {
    const { policyId, ...updates } = body; delete updates.action; delete updates.tenantId;
    if (!policyId) return NextResponse.json({ ok: false, error: 'policyId required' }, { status: 400 });
    await polCol.updateOne({ tenantId, policyId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'publish') {
    if (!body.policyId) return NextResponse.json({ ok: false, error: 'policyId required' }, { status: 400 });
    await polCol.updateOne({ tenantId, policyId: body.policyId }, { $set: { status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.policies.write' });
