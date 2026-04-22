import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[(ctx.roles as string[])?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const okrCol = db.collection('cvision_okrs');
  const kpiCol = db.collection('cvision_kpis');
  const cycleCol = db.collection('cvision_review_cycles');
      const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'my-okrs';

  if (action === 'my-okrs') {
    const empId = ctx.employeeId || userId;
    const data = await okrCol.find({ tenantId, employeeId: empId }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'team-okrs') {
    const empId = ctx.employeeId || userId;
    const empCol = db.collection('cvision_employees');
    const reports = await empCol.find({ tenantId, managerId: empId, deletedAt: null, isArchived: { $ne: true } }).project({ id: 1 }).limit(200).toArray();
    const ids = reports.map((r: any) => r.id).filter(Boolean);
    ids.push(empId);
    const data = await okrCol.find({ tenantId, employeeId: { $in: ids } }).sort({ createdAt: -1 }).limit(500).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'company-okrs') {
    const data = await okrCol.find({ tenantId, employeeId: null }).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'kpi-dashboard') {
    const data = await kpiCol.find({ tenantId }).sort({ name: 1 }).limit(500).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'review-status') {
    const cycleId = searchParams.get('cycleId');
    // Helper to unpack metadata from description JSON
    const unpackCycle = (raw: any) => {
      if (!raw) return raw;
      let meta: any = {};
      try { meta = typeof raw.description === 'string' ? JSON.parse(raw.description as string) : ((raw.description as Record<string, unknown>) || {}); } catch { meta = {}; }
      return { ...raw, cycleId: raw.id, reviews: (meta.reviews || raw.reviews || []) as Record<string, unknown>[], selfReviewWeight: (meta.selfReviewWeight as number) || 30, managerReviewWeight: (meta.managerReviewWeight as number) || 60, peerReviewWeight: (meta.peerReviewWeight as number) || 10, period: (meta.period as string) || '' };
    };
    if (cycleId) {
      // Look up by PG 'id' column
      const rawCycle = await cycleCol.findOne({ tenantId, id: cycleId }) as Record<string, unknown> | null;
      const cycle = unpackCycle(rawCycle);
      if (cycle?.reviews?.length > 0) {
        const empCol = db.collection('cvision_employees');
        const revEmpIds = (cycle.reviews as Record<string, unknown>[]).map((r) => r.employeeId).filter(Boolean);
        const emps = await empCol.find({ tenantId, id: { $in: revEmpIds }, deletedAt: null }).project({ id: 1, firstName: 1, lastName: 1 }).toArray();
        const nm = new Map(emps.map((e: any) => [e.id, `${e.firstName || ''} ${e.lastName || ''}`.trim()]));
        cycle.reviews = (cycle.reviews as Record<string, unknown>[]).map((r) => ({ ...r, employeeName: nm.get(r.employeeId as string) || r.employeeId }));
      }
      return NextResponse.json({ ok: true, data: cycle });
    }
    const rawData = await cycleCol.find({ tenantId }).sort({ createdAt: -1 }).limit(100).toArray();
    const data = rawData.map(unpackCycle);
    // Enrich review employee names for all cycles
    const empCol = db.collection('cvision_employees');
    const allRevIds = [...new Set(data.flatMap((c: Record<string, unknown>) => ((c.reviews || []) as Record<string, unknown>[]).map((r) => r.employeeId)).filter(Boolean))];
    if (allRevIds.length > 0) {
      const emps = await empCol.find({ tenantId, id: { $in: allRevIds }, deletedAt: null }).project({ id: 1, firstName: 1, lastName: 1 }).toArray();
      const nm = new Map(emps.map((e: any) => [e.id, `${e.firstName || ''} ${e.lastName || ''}`.trim()]));
      for (const c of data) { if (c.reviews) c.reviews = (c.reviews as Record<string, unknown>[]).map((r) => ({ ...r, employeeName: nm.get(r.employeeId as string) || r.employeeId })); }
    }
    return NextResponse.json({ ok: true, data });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.performance.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const okrCol = db.collection('cvision_okrs');
  const kpiCol = db.collection('cvision_kpis');
  const cycleCol = db.collection('cvision_review_cycles');
  const body = await request.json();
  const action = body.action;

  if (action === 'create-objective') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.PERFORMANCE_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires PERFORMANCE_WRITE');
    const keyResults = (body.keyResults || []).map((kr: any) => ({
      krId: uuidv4(), description: kr.description || '', metricType: kr.metricType || 'PERCENTAGE',
      target: kr.target || 100, current: 0, progress: 0, status: 'ON_TRACK',
    }));
    const doc = {
      tenantId, id: uuidv4(), title: body.title || '',
      description: body.titleAr || body.description || '',
      employeeId: body.level === 'COMPANY' ? null : (body.ownerId || ctx.employeeId || userId),
      departmentId: body.departmentId || null,
      parentOkrId: body.parentObjectiveId || null,
      period: body.period || `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
      keyResults: JSON.stringify(keyResults), progress: 0, status: 'active',
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await okrCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update-progress') {
    const { objectiveId, krId, current } = body;
    if (!objectiveId || !krId) return NextResponse.json({ ok: false, error: 'objectiveId and krId required' }, { status: 400 });
    // OKRs are created with `id` as the primary key, not `objectiveId`
    const okr = await okrCol.findOne({ tenantId, id: objectiveId }) as Record<string, unknown> | null;
    if (!okr) return NextResponse.json({ ok: false, error: 'OKR not found' }, { status: 404 });
    const krs = (okr.keyResults as Record<string, unknown>[]).map((kr: Record<string, unknown>) => {
      if (kr.krId === krId) {
        const progress = Number(kr.target) > 0 ? Math.min(Math.round((current / Number(kr.target)) * 100), 100) : 0;
        const status = progress >= 100 ? 'COMPLETED' : progress >= 70 ? 'ON_TRACK' : progress >= 40 ? 'AT_RISK' : 'BEHIND';
        return { ...kr, current, progress, status };
      }
      return kr;
    });
    const overall = krs.length > 0 ? Math.round(krs.reduce((s: number, k: any) => s + (k.progress as number), 0) / krs.length) : 0;
    const overallStatus = overall >= 100 ? 'COMPLETED' : overall >= 70 ? 'ON_TRACK' : overall >= 40 ? 'AT_RISK' : 'BEHIND';
    await okrCol.updateOne({ tenantId, id: objectiveId }, { $set: { keyResults: krs, overallProgress: overall, status: overallStatus, updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { overallProgress: overall, status: overallStatus } });
  }

  if (action === 'create-kpi') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.PERFORMANCE_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires PERFORMANCE_WRITE');
    const doc = {
      tenantId, id: uuidv4(), name: body.name || '',
      description: body.nameAr || body.description || '',
      category: body.category || 'GENERAL', unit: body.unit || '%',
      target: body.target || 0, frequency: body.frequency || 'MONTHLY',
      departmentId: body.departmentId || null,
      isActive: true, createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await kpiCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'record-kpi') {
    const { kpiId, period, actual } = body;
    if (!kpiId) return NextResponse.json({ ok: false, error: 'kpiId required' }, { status: 400 });
    const kpi = await kpiCol.findOne({ tenantId, kpiId }) as Record<string, unknown> | null;
    if (!kpi) return NextResponse.json({ ok: false, error: 'KPI not found' }, { status: 404 });
    const achievement = Number(kpi.target) > 0 ? Math.round((actual / Number(kpi.target)) * 100) : 0;
    await kpiCol.updateOne({ tenantId, kpiId }, { $push: { records: { period: period || new Date().toISOString().slice(0, 7), actual, target: kpi.target, achievement } } as Record<string, unknown>, $set: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { achievement } });
  }

  if (action === 'create-review-cycle') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.PERFORMANCE_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires PERFORMANCE_WRITE');
    const cycleId = uuidv4();
    // PG columns: id, tenantId, name, description, startDate, endDate, status, isActive, createdAt, updatedAt, createdBy, updatedBy
    // Extra fields (period, weights, reviews) are not PG columns — they will be
    // stripped on insert by PrismaShim. We use 'id' as the cycle identifier and
    // 'description' to store serialized metadata.
    const now = new Date();
    const metaPayload = {
      period: body.period || '',
      selfReviewWeight: body.selfReviewWeight || 30,
      managerReviewWeight: body.managerReviewWeight || 60,
      peerReviewWeight: body.peerReviewWeight || 10,
      reviews: [],
    };
    const doc = {
      id: cycleId,
      tenantId,
      name: body.name || '',
      description: JSON.stringify(metaPayload),
      startDate: now,
      endDate: new Date(now.getFullYear(), 11, 31),
      status: 'SETUP',
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    await cycleCol.insertOne(doc);
    // Return a response that includes cycleId so callers can reference the cycle
    return NextResponse.json({ ok: true, data: { ...doc, cycleId, ...metaPayload } });
  }

  if (action === 'submit-review' || action === 'submit-self-review') {
    const { cycleId, employeeId, score, feedback } = body;
    if (!cycleId || !employeeId) return NextResponse.json({ ok: false, error: 'cycleId and employeeId required' }, { status: 400 });

    // ── Identity / authorization checks ──
    if (action === 'submit-self-review') {
      // Self-review: caller must be the employee themselves
      const callerEmpId = ctx.employeeId || userId;
      if (callerEmpId !== employeeId) {
        return NextResponse.json({ ok: false, error: 'You can only submit a self-review for yourself' }, { status: 403 });
      }
    } else {
      // Manager review: caller must be the employee's manager or have admin role
      const isAdmin = ctx.isOwner || ((ctx.roles as string[]) || []).some((r: string) => ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'].includes(r.toLowerCase()));
      if (!isAdmin) {
        const empCol = db.collection('cvision_employees');
        const targetEmp = await empCol.findOne({ tenantId, id: employeeId, deletedAt: null });
        const callerEmpId = ctx.employeeId || userId;
        if (!targetEmp || targetEmp.managerId !== callerEmpId) {
          return NextResponse.json({ ok: false, error: 'Only the employee\'s manager or an admin can submit a manager review' }, { status: 403 });
        }
      }
    }

    const field = action === 'submit-self-review' ? 'selfReview' : 'managerReview';
    // Look up by PG 'id' column (cycleId was used as the value for 'id' on creation)
    const cycle = await cycleCol.findOne({ tenantId, id: cycleId }) as Record<string, unknown> | null;
    if (!cycle) return NextResponse.json({ ok: false, error: 'Cycle not found' }, { status: 404 });
    // Reviews are stored in 'description' JSON since PG has no 'reviews' column
    let meta: any = {};
    try { meta = typeof cycle.description === 'string' ? JSON.parse(cycle.description as string) : ((cycle.description as Record<string, unknown>) || {}); } catch { meta = {}; }
    const reviews = (meta.reviews || cycle.reviews || []) as Record<string, unknown>[];
    const selfReviewWeight = (meta.selfReviewWeight as number) || (cycle.selfReviewWeight as number) || 30;
    const managerReviewWeight = (meta.managerReviewWeight as number) || (cycle.managerReviewWeight as number) || 60;
    const idx = reviews.findIndex((r: any) => r.employeeId === employeeId);
    const reviewData = { score, feedback, submittedBy: userId, submittedAt: new Date() };
    if (idx >= 0) {
      reviews[idx][field] = reviewData;
      if (reviews[idx].selfReview && reviews[idx].managerReview) {
        const sw = selfReviewWeight / 100; const mw = managerReviewWeight / 100;
        reviews[idx].overallScore = Math.round((reviews[idx].selfReview as any).score * sw + (reviews[idx].managerReview as any).score * mw);
        reviews[idx].status = 'REVIEWED';
      } else { reviews[idx].status = 'SUBMITTED'; }
    } else {
      reviews.push({ employeeId, [field]: reviewData, overallScore: null, status: 'SUBMITTED' });
    }
    meta.reviews = reviews;
    await cycleCol.updateOne({ tenantId, id: cycleId }, { $set: { description: JSON.stringify(meta), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.performance.write' });
