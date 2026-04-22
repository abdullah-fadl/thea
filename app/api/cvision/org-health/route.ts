import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { calculateAutoMetrics } from '@/lib/cvision/od/health-metrics';
import { calculateOverallScore, getHealthLevel, identifyPriorityAreas, OHI_SURVEY_QUESTIONS } from '@/lib/cvision/od/health-scoring';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

function emptyDimension() {
  return { score: 0, subMetrics: {}, dataPoints: {}, findings: [] as string[], recommendations: [] as string[] };
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ORG_HEALTH_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires ORG_HEALTH_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_org_health_assessments');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'latest';

  if (action === 'latest') {
    const data = await col.findOne({ tenantId, status: 'COMPLETED' }, { sort: { assessmentDate: -1 } });
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'history') {
    const data = await col.find({ tenantId }).sort({ assessmentDate: -1 }).limit(20).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'detail') {
    const id = searchParams.get('id');
    const data = await col.findOne({ tenantId, assessmentId: id });
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'auto-metrics') {
    const metrics = await calculateAutoMetrics(tenantId);
    return NextResponse.json({ ok: true, data: metrics });
  }
  if (action === 'comparison') {
    const id1 = searchParams.get('id1'); const id2 = searchParams.get('id2');
    const [a1, a2] = await Promise.all([col.findOne({ tenantId, assessmentId: id1 }), col.findOne({ tenantId, assessmentId: id2 })]);
    return NextResponse.json({ ok: true, data: { period1: a1, period2: a2 } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.org_health.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ORG_HEALTH_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires ORG_HEALTH_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_org_health_assessments');
  const body = await request.json();
  const action = body.action;

  if (action === 'start') {
    const now = new Date();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    const period = `${now.getFullYear()}-Q${quarter}`;
    const metrics = await calculateAutoMetrics(tenantId);

    // Create OHI survey
    let surveyId: string | null = null;
    try {
      const surveyDb = db.collection('cvision_surveys');
      const sId = uuidv4();
      const questions = OHI_SURVEY_QUESTIONS.map(q => ({
        questionId: uuidv4(), text: q.text, textAr: q.textAr, type: 'RATING_1_5' as const,
        options: [], required: true, dimension: q.dim,
      }));
      await surveyDb.insertOne({
        tenantId, surveyId: sId, title: `Org Health Assessment ${period}`,
        titleAr: `تقييم صحة المنظمة ${period}`, description: 'Organization Health Index survey',
        type: 'ORG_HEALTH', anonymous: true, status: 'ACTIVE',
        targetAudience: 'ALL', targetIds: [], startDate: now, endDate: null,
        questions, responseCount: 0, responseRate: 0,
        createdBy: userId, createdAt: now, updatedAt: now,
      });
      surveyId = sId;
    } catch { /* survey creation optional */ }

    const doc = {
      tenantId, assessmentId: `OHA-${now.getFullYear()}-Q${quarter}`, period, year: now.getFullYear(), quarter,
      assessmentDate: now,
      dimensions: {
        strategy: { ...emptyDimension(), dataPoints: { okrCompletionRate: 0 } },
        structure: { ...emptyDimension(), dataPoints: { avgSpanOfControl: metrics.avgSpanOfControl, layersToTop: metrics.layersToTop, departmentsCount: metrics.departmentsCount } },
        culture: { ...emptyDimension(), dataPoints: { eNPS: metrics.eNPS, voluntaryTurnoverRate: metrics.voluntaryTurnoverRate, averageTenure: metrics.averageTenure, grievancesCount: metrics.grievancesCount, recognitionsGiven: metrics.recognitionsGiven } },
        processes: { ...emptyDimension(), dataPoints: { avgApprovalTime: metrics.avgApprovalTime, slaBreachRate: metrics.slaBreachRate } },
        people: { ...emptyDimension(), dataPoints: { skillGapPercentage: metrics.skillGapPercentage, successionCoverage: metrics.successionCoverage, trainingHoursPerEmployee: metrics.trainingHoursPerEmployee } },
        rewards: { ...emptyDimension(), dataPoints: { compaRatioAvg: metrics.compaRatioAvg, disciplinaryActionsCount: metrics.disciplinaryActionsCount } },
        communication: { ...emptyDimension(), dataPoints: { surveyResponseRate: metrics.surveyResponseRate, grievanceResolutionTime: metrics.grievanceResolutionTime } },
        innovation: { ...emptyDimension(), dataPoints: {} },
        governance: { ...emptyDimension(), dataPoints: { policyAcknowledgmentRate: metrics.policyAcknowledgmentRate, overdueLegalDeadlines: metrics.overdueLegalDeadlines } },
      },
      overallScore: 0, healthLevel: 'DEVELOPING', priorityAreas: [], previousScore: null, trend: 'STABLE',
      dataSources: { surveyBased: !!surveyId, dataDriven: true, surveyId, responseCount: 0, responseRate: 0 },
      conductedBy: userId, status: 'IN_PROGRESS', createdAt: now, updatedAt: now,
    };

    const prev = await col.findOne({ tenantId, status: 'COMPLETED' }, { sort: { assessmentDate: -1 } }) as Record<string, unknown> | null;
    if (prev) doc.previousScore = prev.overallScore;

    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'save-draft') {
    const { assessmentId, dimensions } = body;
    if (!assessmentId) return NextResponse.json({ ok: false, error: 'assessmentId required' }, { status: 400 });
    const update: any = { updatedAt: new Date() };
    if (dimensions) update.dimensions = dimensions;
    await col.updateOne({ tenantId, assessmentId }, { $set: update });
    return NextResponse.json({ ok: true });
  }

  if (action === 'complete') {
    const { assessmentId } = body;
    if (!assessmentId) return NextResponse.json({ ok: false, error: 'assessmentId required' }, { status: 400 });
    const doc = await col.findOne({ tenantId, assessmentId }) as Record<string, unknown> | null;
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const overall = calculateOverallScore(doc.dimensions as any);
    const level = getHealthLevel(overall);
    const priorities = identifyPriorityAreas(doc.dimensions as any);
    let trend: string = 'STABLE';
    if (doc.previousScore) trend = overall > (doc.previousScore as number) + 0.2 ? 'IMPROVING' : overall < (doc.previousScore as number) - 0.2 ? 'DECLINING' : 'STABLE';

    await col.updateOne({ tenantId, assessmentId }, { $set: { overallScore: overall, healthLevel: level, priorityAreas: priorities, trend, status: 'COMPLETED', updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { overallScore: overall, healthLevel: level, priorityAreas: priorities, trend } });
  }

  if (action === 'add-findings') {
    const { assessmentId, dimension, findings, recommendations } = body;
    if (!assessmentId || !dimension) return NextResponse.json({ ok: false, error: 'assessmentId and dimension required' }, { status: 400 });
    const update: any = { updatedAt: new Date() };
    if (findings) update[`dimensions.${dimension}.findings`] = findings;
    if (recommendations) update[`dimensions.${dimension}.recommendations`] = recommendations;
    await col.updateOne({ tenantId, assessmentId }, { $set: update });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.org_health.write' });
