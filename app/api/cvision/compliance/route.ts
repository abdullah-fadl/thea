import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

const DEFAULT_ITEMS = [
  { title: 'GOSI Monthly Payment', titleAr: 'دفعة التأمينات الشهرية', authority: 'GOSI', frequency: 'MONTHLY', reminderDays: [7, 1] },
  { title: 'Saudization Quarterly Review', titleAr: 'مراجعة التوطين الفصلية', authority: 'MOL', frequency: 'QUARTERLY', reminderDays: [30, 7] },
  { title: 'Commercial Registration Renewal', titleAr: 'تجديد السجل التجاري', authority: 'MOC', frequency: 'ANNUAL', reminderDays: [90, 30, 7] },
  { title: 'CCHI Insurance Renewal', titleAr: 'تجديد التأمين الطبي', authority: 'CCHI', frequency: 'ANNUAL', reminderDays: [60, 30, 7] },
  { title: 'MOL License Renewal', titleAr: 'تجديد رخصة العمل', authority: 'MOL', frequency: 'ANNUAL', reminderDays: [90, 30, 7] },
  { title: 'Zakat & Tax Filing', titleAr: 'تقديم الزكاة والضريبة', authority: 'ZAKAT', frequency: 'ANNUAL', reminderDays: [90, 30, 7, 1] },
];

async function ensureDefaults(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_compliance_calendar');
  const count = await col.countDocuments({ tenantId });
  if (count === 0) {
    const now = new Date();
    await col.insertMany(DEFAULT_ITEMS.map(item => {
      const nextDue = new Date(now);
      if (item.frequency === 'MONTHLY') nextDue.setMonth(nextDue.getMonth() + 1, 1);
      else if (item.frequency === 'QUARTERLY') nextDue.setMonth(nextDue.getMonth() + 3, 1);
      else nextDue.setFullYear(nextDue.getFullYear() + 1);
      return { ...item, tenantId, itemId: uuidv4(), dueDate: nextDue, nextDueDate: nextDue, status: 'UPCOMING', assignedTo: null, completedAt: null, notes: '', createdAt: new Date() };
    }));
  }
  return col;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.COMPLIANCE_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires COMPLIANCE_READ');
  const col = await ensureDefaults(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await col.find({ tenantId }).sort({ dueDate: 1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'upcoming') {
    const days = parseInt(searchParams.get('days') || '30', 10);
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const data = await col.find({ tenantId, status: { $ne: 'COMPLETED' }, dueDate: { $lte: cutoff } }).sort({ dueDate: 1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'overdue') {
    const data = await col.find({ tenantId, status: { $ne: 'COMPLETED' }, dueDate: { $lt: new Date() } }).sort({ dueDate: 1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.compliance.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.COMPLIANCE_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires COMPLIANCE_WRITE');
  const col = await ensureDefaults(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = {
      tenantId, itemId: uuidv4(), title: body.title || '', titleAr: body.titleAr || '',
      authority: body.authority || 'CUSTOM', frequency: body.frequency || 'ANNUAL',
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(), nextDueDate: body.dueDate ? new Date(body.dueDate) : new Date(),
      status: 'UPCOMING', assignedTo: body.assignedTo || null, completedAt: null,
      notes: body.notes || '', reminderDays: body.reminderDays || [30, 7, 1],
      createdAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'complete') {
    const { itemId } = body;
    if (!itemId) return NextResponse.json({ ok: false, error: 'itemId required' }, { status: 400 });
    const item = await col.findOne({ tenantId, itemId }) as Record<string, unknown>;
    if (!item) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    let nextDue = new Date(item.dueDate as any);
    if (item.frequency === 'MONTHLY') nextDue.setMonth(nextDue.getMonth() + 1);
    else if (item.frequency === 'QUARTERLY') nextDue.setMonth(nextDue.getMonth() + 3);
    else if (item.frequency === 'ANNUAL') nextDue.setFullYear(nextDue.getFullYear() + 1);
    await col.updateOne({ tenantId, itemId }, { $set: { status: 'COMPLETED', completedAt: new Date(), completedBy: userId } });
    if (item.frequency !== 'ONE_TIME') {
      await col.insertOne({ ...item, _id: undefined, itemId: uuidv4(), dueDate: nextDue, nextDueDate: nextDue, status: 'UPCOMING', completedAt: null, createdAt: new Date() });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.compliance.write' });
