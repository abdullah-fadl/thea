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
  const recCol = db.collection('cvision_recognitions');
  const progCol = db.collection('cvision_reward_programs');
  const ptsCol = db.collection('cvision_reward_points');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'leaderboard';

  if (action === 'leaderboard') {
    const pipeline = [
      { $match: { tenantId, status: 'APPROVED' } },
      { $group: { _id: '$nomineeId', name: { $first: '$nomineeName' }, totalPoints: { $sum: '$points' }, count: { $sum: 1 } } },
      { $sort: { totalPoints: -1 as const } },
      { $limit: 20 },
    ];
    const data = await recCol.aggregate(pipeline).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'my-recognitions') {
    const empId = ctx.employeeId || userId;
    const received = await recCol.find({ tenantId, nomineeId: empId, status: 'APPROVED' }).sort({ createdAt: -1 }).limit(20).toArray();
    const given = await recCol.find({ tenantId, nominatorId: empId }).sort({ createdAt: -1 }).limit(20).toArray();
    return NextResponse.json({ ok: true, data: { received, given } });
  }

  if (action === 'programs') {
    const data = await progCol.find({ tenantId, isActive: true }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'points-balance') {
    const empId = ctx.employeeId || userId;
    const pts = await ptsCol.findOne({ tenantId, employeeId: empId });
    return NextResponse.json({ ok: true, data: pts || { balance: 0, history: [] } });
  }

  if (action === 'recent') {
    const data = await recCol.find({ tenantId, status: 'APPROVED' }).sort({ createdAt: -1 }).limit(20).toArray();
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const recCol = db.collection('cvision_recognitions');
  const progCol = db.collection('cvision_reward_programs');
  const ptsCol = db.collection('cvision_reward_points');
  const body = await request.json();
  const action = body.action;

  if (action === 'nominate') {
    if (!body.nomineeId) return NextResponse.json({ ok: false, error: 'nomineeId required' }, { status: 400 });
    const doc = {
      tenantId, recognitionId: uuidv4(), type: body.type || 'PEER_RECOGNITION',
      nomineeId: body.nomineeId, nomineeName: body.nomineeName || '',
      nominatorId: ctx.employeeId || userId, nominatorName: body.nominatorName || '',
      category: body.category || 'GOING_EXTRA_MILE', programId: body.programId || null,
      message: body.message || '', messageAr: body.messageAr || '',
      points: body.points || 10, status: 'PENDING',
      approvedBy: null, createdAt: new Date(),
    };
    await recCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'approve-nomination') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REWARDS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires REWARDS_WRITE');
    const { recognitionId } = body;
    if (!recognitionId) return NextResponse.json({ ok: false, error: 'recognitionId required' }, { status: 400 });
    const rec = await recCol.findOne({ tenantId, recognitionId }) as any;
    if (!rec) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await recCol.updateOne({ tenantId, recognitionId }, { $set: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() } });
    // Add points
    await ptsCol.updateOne(
      { tenantId, employeeId: rec.nomineeId },
      { $inc: { balance: rec.points || 10 }, $push: { history: { date: new Date(), amount: rec.points || 10, type: 'EARNED', source: rec.recognitionId, description: rec.message } } as any, $setOnInsert: { tenantId, employeeId: rec.nomineeId } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'create-program') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REWARDS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires REWARDS_WRITE');
    const doc = {
      tenantId, programId: uuidv4(), name: body.name || '', nameAr: body.nameAr || '',
      type: body.type || 'RECOGNITION', frequency: body.frequency || 'ONGOING',
      criteria: body.criteria || '', pointsValue: body.pointsValue || 10,
      budget: body.budget || 0, isActive: true,
      createdBy: userId, createdAt: new Date(),
    };
    await progCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'give-points') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REWARDS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires REWARDS_WRITE');
    const { employeeId, amount, description } = body;
    if (!employeeId || !amount) return NextResponse.json({ ok: false, error: 'employeeId and amount required' }, { status: 400 });
    await ptsCol.updateOne(
      { tenantId, employeeId },
      { $inc: { balance: amount }, $push: { history: { date: new Date(), amount, type: 'EARNED', source: 'MANUAL', description: description || '' } } as any, $setOnInsert: { tenantId, employeeId } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
