import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

const SAUDI_HOLIDAYS_2026 = [
  { title: 'Founding Day', titleAr: 'يوم التأسيس', type: 'HOLIDAY', date: '2026-02-22', endDate: '2026-02-22', allDay: true, color: '#16a34a' },
  { title: 'Eid Al-Fitr', titleAr: 'عيد الفطر', type: 'HOLIDAY', date: '2026-03-30', endDate: '2026-04-03', allDay: true, color: '#16a34a' },
  { title: 'Eid Al-Adha', titleAr: 'عيد الأضحى', type: 'HOLIDAY', date: '2026-06-07', endDate: '2026-06-11', allDay: true, color: '#16a34a' },
  { title: 'National Day', titleAr: 'اليوم الوطني', type: 'HOLIDAY', date: '2026-09-23', endDate: '2026-09-23', allDay: true, color: '#16a34a' },
];

async function ensureHolidays(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_calendar_events');
  const count = await col.countDocuments({ tenantId, type: 'HOLIDAY' });
  if (count === 0) {
    await col.insertMany(SAUDI_HOLIDAYS_2026.map(h => ({ ...h, tenantId, eventId: uuidv4(), isRecurring: false, visibility: 'ALL', description: '', createdBy: 'system', createdAt: new Date() })));
  }
  return col;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const col = await ensureHolidays(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'month';

  if (action === 'month') {
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);
    const data = await col.find({ tenantId, $or: [{ date: { $gte: start.toISOString().split('T')[0], $lte: end.toISOString().split('T')[0] } }, { date: { $gte: start.toISOString().split('T')[0], $lte: end.toISOString().split('T')[0] } }] }).sort({ date: 1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'year') {
    const year = searchParams.get('year') || String(new Date().getFullYear());
    const data = await col.find({ tenantId, date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }).sort({ date: 1 }).limit(500).toArray();
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.attendance.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CONFIG_WRITE) && !hasPerm(ctx, 'HR_ADMIN')) return deny('INSUFFICIENT_PERMISSION', 'Requires CONFIG_WRITE');
  const col = await ensureHolidays(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = { tenantId, eventId: uuidv4(), title: body.title || '', titleAr: body.titleAr || '', type: body.type || 'COMPANY_EVENT', date: body.date, endDate: body.endDate || body.date, isRecurring: body.isRecurring || false, recurrence: body.recurrence || null, allDay: body.allDay ?? true, color: body.color || '#3b82f6', description: body.description || '', visibility: body.visibility || 'ALL', createdBy: userId, createdAt: new Date() };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }
  if (action === 'update') {
    const { eventId, ...updates } = body; delete updates.action; delete updates.tenantId;
    if (!eventId) return NextResponse.json({ ok: false, error: 'eventId required' }, { status: 400 });
    await col.updateOne({ tenantId, eventId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (action === 'delete') {
    if (!body.eventId) return NextResponse.json({ ok: false, error: 'eventId required' }, { status: 400 });
    await col.deleteOne({ tenantId, eventId: body.eventId });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.attendance.write' });
