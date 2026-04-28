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
  const tCol = db.collection('cvision_travel_requests');
  const eCol = db.collection('cvision_expenses');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'my-requests';

  if (action === 'my-requests') {
    const empId = ctx.employeeId || userId;
    const data = await tCol.find({ tenantId, employeeId: empId }).sort({ createdAt: -1 }).limit(50).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'pending-approval') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAVEL_APPROVE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAVEL_APPROVE');
    const data = await tCol.find({ tenantId, status: 'SUBMITTED' }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'report') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAVEL_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAVEL_READ');
    const period = searchParams.get('period');
    const filter: any = { tenantId };
    if (period) { const [y, m] = period.split('-'); filter.createdAt = { $gte: new Date(parseInt(y), parseInt(m) - 1, 1) }; }
    const expenses = await eCol.find(filter).limit(1000).toArray();
    const totalSpend = expenses.reduce((s, e) => s + ((e as Record<string, unknown>).amount as number || 0), 0);
    const byCategory: Record<string, number> = {};
    expenses.forEach((e: any) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    const trips = await tCol.find({ tenantId, status: { $in: ['APPROVED', 'COMPLETED'] } }).limit(1000).toArray();
    return NextResponse.json({ ok: true, data: { totalTrips: trips.length, totalExpenses: expenses.length, totalSpend, byCategory } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.travel.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const tCol = db.collection('cvision_travel_requests');
  const eCol = db.collection('cvision_expenses');
  const body = await request.json();
  const action = body.action;

  if (action === 'create-request') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAVEL_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAVEL_WRITE');
    const doc = {
      tenantId, travelId: uuidv4(), employeeId: ctx.employeeId || userId,
      employeeName: body.employeeName || '', destination: body.destination || '',
      purpose: body.purpose || '', startDate: body.startDate, endDate: body.endDate,
      travelType: body.travelType || 'DOMESTIC', estimatedCost: body.estimatedCost || 0,
      status: 'DRAFT', approvedBy: null, approvedAt: null,
      flights: body.flights || [], hotel: body.hotel || null,
      perDiem: body.perDiem || 0, notes: body.notes || '',
      createdAt: new Date(), updatedAt: new Date(),
    };
    await tCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'add-expense') {
    const doc = {
      tenantId, travelId: body.travelId || null, expenseId: uuidv4(),
      employeeId: ctx.employeeId || userId, category: body.category || 'OTHER',
      amount: body.amount || 0, currency: body.currency || 'SAR',
      description: body.description || '', receipt: body.receipt || '',
      status: 'DRAFT', submittedAt: null, approvedBy: null,
      createdAt: new Date(),
    };
    await eCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'submit-expenses') {
    const { travelId } = body;
    if (!travelId) return NextResponse.json({ ok: false, error: 'travelId required' }, { status: 400 });
    await eCol.updateMany({ tenantId, travelId, status: 'DRAFT' }, { $set: { status: 'SUBMITTED', submittedAt: new Date() } });
    await tCol.updateOne({ tenantId, travelId }, { $set: { status: 'SUBMITTED', updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve' || action === 'reject') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAVEL_APPROVE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAVEL_APPROVE');
    const { travelId } = body;
    if (!travelId) return NextResponse.json({ ok: false, error: 'travelId required' }, { status: 400 });
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
    await tCol.updateOne({ tenantId, travelId }, { $set: { status, approvedBy: userId, approvedAt: new Date(), updatedAt: new Date() } });
    if (action === 'approve') {
      await eCol.updateMany({ tenantId, travelId, status: 'SUBMITTED' }, { $set: { status: 'APPROVED', approvedBy: userId } });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.travel.write' });
