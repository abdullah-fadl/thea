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
  const sCol = db.collection('cvision_surveys');
  const rCol = db.collection('cvision_survey_responses');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await sCol.find({ tenantId }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'results') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const survey = await sCol.findOne({ tenantId, surveyId: id }) as Record<string, unknown> | null;
    if (!survey) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    const responses = await rCol.find({ tenantId, surveyId: id }).limit(5000).toArray();
    const questions = (survey as any).questions || [];
    const analysis = questions.map((q: any) => {
      const answers = responses.map((r: any) => (r.answers || []).find((a: any) => a.questionId === q.questionId)?.value).filter(Boolean);
      if (q.type === 'RATING_1_5' || q.type === 'RATING_1_10' || q.type === 'NPS') {
        const nums = answers.map(Number).filter((n: number) => !isNaN(n));
        const avg = nums.length > 0 ? (nums.reduce((s: number, n: number) => s + n, 0) / nums.length).toFixed(1) : 0;
        let enps = null;
        if (q.type === 'NPS') {
          const promoters = nums.filter((n: number) => n >= 9).length;
          const detractors = nums.filter((n: number) => n <= 6).length;
          enps = nums.length > 0 ? Math.round(((promoters - detractors) / nums.length) * 100) : 0;
        }
        return { ...q, average: parseFloat(String(avg)), responses: nums.length, distribution: [1,2,3,4,5,6,7,8,9,10].map(v => nums.filter((n: number) => n === v).length), enps };
      }
      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
        const dist: Record<string, number> = {};
        answers.forEach((a: any) => { const vals = Array.isArray(a) ? a : [a]; vals.forEach((v: string) => { dist[v] = (dist[v] || 0) + 1; }); });
        return { ...q, distribution: dist, responses: answers.length };
      }
      return { ...q, textResponses: answers.slice(0, 50), responses: answers.length };
    });
    const empCol = db.collection('cvision_employees');
    const totalTargets = (survey as any).targetAudience === 'ALL' ? await empCol.countDocuments({ tenantId, status: { $in: ['ACTIVE', 'active'] } }) : ((survey as any).targetIds || []).length || 1;
    return NextResponse.json({ ok: true, data: { survey, responseCount: responses.length, responseRate: Math.round((responses.length / totalTargets) * 100), analysis } });
  }

  if (action === 'my-pending') {
    const empId = ctx.employeeId || userId;
    const active = await sCol.find({ tenantId, status: 'ACTIVE' }).limit(100).toArray();
    const myResponses = await rCol.find({ tenantId, respondentId: empId }).project({ surveyId: 1 }).limit(500).toArray();
    const answeredIds = new Set(myResponses.map((r: any) => r.surveyId));
    const pending = active.filter((s: any) => !answeredIds.has(s.surveyId));
    return NextResponse.json({ ok: true, data: pending });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.surveys.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const sCol = db.collection('cvision_surveys');
  const rCol = db.collection('cvision_survey_responses');
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.SURVEYS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SURVEYS_WRITE');
    const questions = (body.questions || []).map((q: any) => ({ questionId: uuidv4(), text: q.text || '', textAr: q.textAr || '', type: q.type || 'RATING_1_5', options: q.options || [], required: q.required ?? true }));
    const doc = {
      tenantId, surveyId: uuidv4(), title: body.title || '', titleAr: body.titleAr || '',
      description: body.description || '', type: body.type || 'ENGAGEMENT',
      anonymous: body.anonymous ?? false, status: 'DRAFT',
      targetAudience: body.targetAudience || 'ALL', targetIds: body.targetIds || [],
      startDate: body.startDate || null, endDate: body.endDate || null,
      questions, responseCount: 0, responseRate: 0,
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await sCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'publish') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.SURVEYS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SURVEYS_WRITE');
    const { surveyId } = body;
    await sCol.updateOne({ tenantId, surveyId }, { $set: { status: 'ACTIVE', publishedAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'close') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.SURVEYS_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SURVEYS_WRITE');
    const { surveyId } = body;
    await sCol.updateOne({ tenantId, surveyId }, { $set: { status: 'CLOSED', updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'submit-response') {
    const { surveyId, answers } = body;
    if (!surveyId || !answers) return NextResponse.json({ ok: false, error: 'surveyId and answers required' }, { status: 400 });
    const survey = await sCol.findOne({ tenantId, surveyId }) as Record<string, unknown> | null;
    if (!survey || survey.status !== 'ACTIVE') return NextResponse.json({ ok: false, error: 'Survey not active' }, { status: 400 });
    const respondentId = survey.anonymous ? null : (ctx.employeeId || userId);
    if (respondentId) {
      const existing = await rCol.findOne({ tenantId, surveyId, respondentId });
      if (existing) return NextResponse.json({ ok: false, error: 'Already responded' }, { status: 400 });
    }
    await rCol.insertOne({ tenantId, surveyId, respondentId, answers, submittedAt: new Date() });
    await sCol.updateOne({ tenantId, surveyId }, { $inc: { responseCount: 1 } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.surveys.write' });
