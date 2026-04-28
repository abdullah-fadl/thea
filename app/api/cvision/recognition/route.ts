import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  ensureSeedData, getPointsForType, requiresApproval, getLeaderboard,
  getRecognitionAnalytics, awardPoints, redeemPoints,
  REDEMPTION_CATALOG, TYPE_LABELS, CATEGORY_LABELS, POINT_VALUES,
} from '@/lib/cvision/recognition/recognition-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await ensureSeedData(db, tenantId);

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'feed';

  /* ── Recognition Feed / Wall ────────────────────────────────────── */
  if (action === 'feed') {
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
    const skip = Number(searchParams.get('skip')) || 0;
    const type = searchParams.get('type');
    const category = searchParams.get('category');

    const filter: any = { tenantId };
    if (type) filter.title = type;
    if (category) filter.category = category;

    const [recognitions, total] = await Promise.all([
      db.collection('cvision_recognitions').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('cvision_recognitions').countDocuments(filter),
    ]);

    return NextResponse.json({ success: true, recognitions, total, hasMore: skip + limit < total });
  }

  /* ── My Recognitions ────────────────────────────────────────────── */
  if (action === 'my-recognitions') {
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });

    const [received, given] = await Promise.all([
      db.collection('cvision_recognitions').find({ tenantId, recipientEmployeeId: employeeId }).sort({ createdAt: -1 }).limit(100).toArray(),
      db.collection('cvision_recognitions').find({ tenantId, nominatorEmployeeId: employeeId }).sort({ createdAt: -1 }).limit(100).toArray(),
    ]);

    return NextResponse.json({ success: true, received, given });
  }

  /* ── Leaderboard ────────────────────────────────────────────────── */
  if (action === 'leaderboard') {
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 50);
    const leaderboard = await getLeaderboard(db, tenantId, limit);
    return NextResponse.json({ success: true, leaderboard });
  }

  /* ── Points Balance ─────────────────────────────────────────────── */
  if (action === 'points-balance') {
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });

    const points = await db.collection('cvision_reward_points').findOne({ tenantId, employeeId });
    return NextResponse.json({
      success: true,
      balance: {
        totalEarned: points?.totalEarned || 0,
        totalRedeemed: points?.totalRedeemed || 0,
        currentBalance: points?.currentBalance || 0,
        history: (points?.history || []).slice(0, 50),
      },
    });
  }

  /* ── Redemption Catalog ─────────────────────────────────────────── */
  if (action === 'redemption-catalog') {
    return NextResponse.json({ success: true, catalog: REDEMPTION_CATALOG });
  }

  /* ── Analytics ──────────────────────────────────────────────────── */
  if (action === 'analytics') {
    const analytics = await getRecognitionAnalytics(db, tenantId);
    return NextResponse.json({ success: true, analytics });
  }

  /* ── Nominees ───────────────────────────────────────────────────── */
  if (action === 'nominees') {
    const period = searchParams.get('period') || 'EMPLOYEE_OF_MONTH';
    const now = new Date();
    let dateFrom: Date;
    if (period === 'EMPLOYEE_OF_YEAR') {
      dateFrom = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'EMPLOYEE_OF_QUARTER') {
      const q = Math.floor(now.getMonth() / 3) * 3;
      dateFrom = new Date(now.getFullYear(), q, 1);
    } else {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const nominations = await db.collection('cvision_recognitions')
      .find({ tenantId, type: period, createdAt: { $gte: dateFrom } })
      .sort({ points: -1 })
      .toArray();

    return NextResponse.json({ success: true, nominees: nominations });
  }

  /* ── Point Values (config) ──────────────────────────────────────── */
  if (action === 'point-values') {
    return NextResponse.json({ success: true, pointValues: POINT_VALUES, typeLabels: TYPE_LABELS, categoryLabels: CATEGORY_LABELS });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.rewards.read' });

/* ═══════════════════════════════════════════════════════════════════ */
/* POST                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  await ensureSeedData(db, tenantId);
  const body = await request.json();
  const { action } = body;

  const user = await db.collection('cvision_employees').findOne({
    tenantId, id: userId,
  }) || await db.collection('cvision_employees').findOne({
    tenantId, _id: userId as unknown,
  });

  /* ── Give Kudos ─────────────────────────────────────────────────── */
  if (action === 'give-kudos') {
    const { recipientId, message, category, isPublic } = body;
    if (!recipientId || !message) return NextResponse.json({ success: false, error: 'recipientId and message required' }, { status: 400 });

    const recipient = await db.collection('cvision_employees').findOne({ tenantId, id: recipientId });
    if (!recipient) return NextResponse.json({ success: false, error: 'Recipient not found' }, { status: 404 });

    const count = await db.collection('cvision_recognitions').countDocuments({ tenantId });
    const recognitionId = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const points = getPointsForType('KUDOS');
    const rec = {
      tenantId,
      recipientEmployeeId: recipientId,
      nominatorEmployeeId: user?.id || userId,
      title: 'KUDOS',
      category: category || 'TEAMWORK',
      description: message,
      points,
      status: 'active',
      createdAt: new Date(), updatedAt: new Date(),
    };

    await db.collection('cvision_recognitions').insertOne(rec);
    await awardPoints(db, tenantId, recipientId, points, 'recognition', `Kudos`);

    return NextResponse.json({ success: true, pointsAwarded: points });
  }

  /* ── Nominate ───────────────────────────────────────────────────── */
  if (action === 'nominate') {
    const { recipientId, type, message, category } = body;
    if (!recipientId || !type || !message) return NextResponse.json({ success: false, error: 'recipientId, type, and message required' }, { status: 400 });

    const recipient = await db.collection('cvision_employees').findOne({ tenantId, id: recipientId });
    if (!recipient) return NextResponse.json({ success: false, error: 'Recipient not found' }, { status: 404 });

    const count = await db.collection('cvision_recognitions').countDocuments({ tenantId });
    const recognitionId = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const points = getPointsForType(type);

    const rec = {
      tenantId,
      recipientEmployeeId: recipientId,
      nominatorEmployeeId: user?.id || userId,
      title: type,
      category: category || 'PERFORMANCE',
      description: message,
      points,
      status: 'pending',
      createdAt: new Date(), updatedAt: new Date(),
    };

    await db.collection('cvision_recognitions').insertOne(rec);
    return NextResponse.json({ success: true, status: 'pending' });
  }

  /* ── Award (formal by HR) ───────────────────────────────────────── */
  if (action === 'award') {
    const { recipientId, type, message, category, award: awardInfo } = body;
    if (!recipientId || !type || !message) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

    const recipient = await db.collection('cvision_employees').findOne({ tenantId, id: recipientId });
    if (!recipient) return NextResponse.json({ success: false, error: 'Recipient not found' }, { status: 404 });

    const count = await db.collection('cvision_recognitions').countDocuments({ tenantId });
    const recognitionId = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const points = getPointsForType(type);
    const needsApproval = requiresApproval(type, awardInfo);

    const status = needsApproval ? 'pending' : 'active';
    const rec = {
      tenantId,
      recipientEmployeeId: recipientId,
      nominatorEmployeeId: user?.id || userId,
      title: type,
      category: category || 'PERFORMANCE',
      description: message,
      points,
      status,
      createdAt: new Date(), updatedAt: new Date(),
    };

    await db.collection('cvision_recognitions').insertOne(rec);

    if (!needsApproval) {
      await awardPoints(db, tenantId, recipientId, points, 'recognition', `${TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type} Award`);
    }

    return NextResponse.json({ success: true, status, pointsAwarded: points });
  }

  /* ── Approve Award ──────────────────────────────────────────────── */
  if (action === 'approve-award') {
    const { recognitionId } = body;
    if (!recognitionId) return NextResponse.json({ success: false, error: 'recognitionId required' }, { status: 400 });

    const rec = await db.collection('cvision_recognitions').findOne({ tenantId, recognitionId });
    if (!rec) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (rec.status !== 'PENDING_APPROVAL') return NextResponse.json({ success: false, error: 'Not pending approval' }, { status: 400 });

    await db.collection('cvision_recognitions').updateOne(
      { tenantId, recognitionId },
      { $set: { status: 'ACTIVE', isPublic: true, approvedBy: user?.id || userId, approvedAt: new Date(), updatedAt: new Date() } },
    );

    await awardPoints(db, tenantId, rec.recipientId, rec.pointsAwarded, recognitionId,
      `${TYPE_LABELS[rec.type as keyof typeof TYPE_LABELS] || rec.type} Award (approved)`);

    return NextResponse.json({ success: true });
  }

  /* ── Reject Award ───────────────────────────────────────────────── */
  if (action === 'reject-award') {
    const { recognitionId, reason } = body;
    if (!recognitionId) return NextResponse.json({ success: false, error: 'recognitionId required' }, { status: 400 });

    await db.collection('cvision_recognitions').updateOne(
      { tenantId, recognitionId },
      { $set: { status: 'REJECTED', rejectedBy: user?.id || userId, rejectedAt: new Date(), rejectionReason: reason || '', updatedAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  }

  /* ── Redeem Points ──────────────────────────────────────────────── */
  if (action === 'redeem-points') {
    const { employeeId, rewardId } = body;
    if (!employeeId || !rewardId) return NextResponse.json({ success: false, error: 'employeeId and rewardId required' }, { status: 400 });

    const reward = REDEMPTION_CATALOG.find(r => r.id === rewardId);
    if (!reward) return NextResponse.json({ success: false, error: 'Reward not found in catalog' }, { status: 404 });

    const result = await redeemPoints(db, tenantId, employeeId, reward.points, rewardId, `Redeemed: ${reward.name}`);
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, redeemed: reward.name, pointsSpent: reward.points });
  }

  /* ── Like ────────────────────────────────────────────────────────── */
  if (action === 'like') {
    const { recognitionId } = body;
    if (!recognitionId) return NextResponse.json({ success: false, error: 'recognitionId required' }, { status: 400 });

    const empId = user?.id || userId;
    const rec = await db.collection('cvision_recognitions').findOne({ tenantId, recognitionId });
    if (!rec) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    if ((rec.likes || []).includes(empId)) {
      await db.collection('cvision_recognitions').updateOne(
        { tenantId, recognitionId },
        { $pull: { likes: empId } },
      );
      return NextResponse.json({ success: true, action: 'unliked' });
    } else {
      await db.collection('cvision_recognitions').updateOne(
        { tenantId, recognitionId },
        { $addToSet: { likes: empId } },
      );
      return NextResponse.json({ success: true, action: 'liked' });
    }
  }

  /* ── Comment ─────────────────────────────────────────────────────── */
  if (action === 'comment') {
    const { recognitionId, text } = body;
    if (!recognitionId || !text) return NextResponse.json({ success: false, error: 'recognitionId and text required' }, { status: 400 });

    const comment = {
      employeeId: user?.id || userId,
      employeeName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || userId,
      text,
      createdAt: new Date(),
    };

    await db.collection('cvision_recognitions').updateOne(
      { tenantId, recognitionId },
      { $push: { comments: comment } as Record<string, unknown>, $set: { updatedAt: new Date() } },
    );

    return NextResponse.json({ success: true, comment });
  }

  /* ── Select Winner ──────────────────────────────────────────────── */
  if (action === 'select-winner') {
    const { recognitionId } = body;
    if (!recognitionId) return NextResponse.json({ success: false, error: 'recognitionId required' }, { status: 400 });

    const rec = await db.collection('cvision_recognitions').findOne({ tenantId, recognitionId });
    if (!rec) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    await db.collection('cvision_recognitions').updateOne(
      { tenantId, recognitionId },
      { $set: { status: 'ACTIVE', isPublic: true, approvedBy: user?.id || userId, approvedAt: new Date(), updatedAt: new Date() } },
    );

    await awardPoints(db, tenantId, rec.recipientId, rec.pointsAwarded, recognitionId,
      `${TYPE_LABELS[rec.type as keyof typeof TYPE_LABELS] || rec.type} Winner`);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.rewards.write' });
