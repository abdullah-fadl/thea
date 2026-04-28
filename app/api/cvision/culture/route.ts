import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

const OCAI_DIMENSIONS = [
  { dim: 'dominant', text: 'The organization is a very personal place. It is like an extended family.', textAr: 'المنظمة مكان شخصي جداً. هي كالعائلة الممتدة.', type: 'clan' },
  { dim: 'dominant', text: 'The organization is a very dynamic and entrepreneurial place.', textAr: 'المنظمة مكان ديناميكي وريادي.', type: 'adhocracy' },
  { dim: 'dominant', text: 'The organization is very results-oriented. People are competitive.', textAr: 'المنظمة موجهة بالنتائج. الناس تنافسية.', type: 'market' },
  { dim: 'dominant', text: 'The organization is a very controlled and structured place.', textAr: 'المنظمة مكان منظم ومُهيكل جداً.', type: 'hierarchy' },
  { dim: 'leadership', text: 'Leadership is considered to exemplify mentoring and facilitating.', textAr: 'القيادة تُعتبر مثالاً في التوجيه والتيسير.', type: 'clan' },
  { dim: 'leadership', text: 'Leadership is considered to exemplify innovation and risk taking.', textAr: 'القيادة تُعتبر مثالاً في الابتكار والمخاطرة.', type: 'adhocracy' },
  { dim: 'leadership', text: 'Leadership is considered to exemplify a results focus.', textAr: 'القيادة تُعتبر مثالاً في التركيز على النتائج.', type: 'market' },
  { dim: 'leadership', text: 'Leadership is considered to exemplify coordinating and organizing.', textAr: 'القيادة تُعتبر مثالاً في التنسيق والتنظيم.', type: 'hierarchy' },
  { dim: 'management', text: 'Management style is characterized by teamwork and participation.', textAr: 'أسلوب الإدارة يتميز بالعمل الجماعي والمشاركة.', type: 'clan' },
  { dim: 'management', text: 'Management style is characterized by individual initiative and freedom.', textAr: 'أسلوب الإدارة يتميز بالمبادرة الفردية والحرية.', type: 'adhocracy' },
  { dim: 'management', text: 'Management style is characterized by competitiveness and achievement.', textAr: 'أسلوب الإدارة يتميز بالتنافسية والإنجاز.', type: 'market' },
  { dim: 'management', text: 'Management style is characterized by security and predictability.', textAr: 'أسلوب الإدارة يتميز بالأمان وإمكانية التنبؤ.', type: 'hierarchy' },
  { dim: 'glue', text: 'The glue is loyalty and mutual trust. Commitment is high.', textAr: 'الرابط هو الولاء والثقة المتبادلة. الالتزام عالٍ.', type: 'clan' },
  { dim: 'glue', text: 'The glue is commitment to innovation and development.', textAr: 'الرابط هو الالتزام بالابتكار والتطوير.', type: 'adhocracy' },
  { dim: 'glue', text: 'The glue is emphasis on achievement and goal accomplishment.', textAr: 'الرابط هو التركيز على الإنجاز وتحقيق الأهداف.', type: 'market' },
  { dim: 'glue', text: 'The glue is formal rules and policies. Smooth operations are important.', textAr: 'الرابط هو القواعد الرسمية والسياسات. العمليات السلسة مهمة.', type: 'hierarchy' },
  { dim: 'emphasis', text: 'The organization emphasizes human development, trust, and participation.', textAr: 'المنظمة تؤكد على تطوير الإنسان والثقة والمشاركة.', type: 'clan' },
  { dim: 'emphasis', text: 'The organization emphasizes acquiring new resources and creating challenges.', textAr: 'المنظمة تؤكد على اكتساب موارد جديدة وخلق تحديات.', type: 'adhocracy' },
  { dim: 'emphasis', text: 'The organization emphasizes competitive actions and achievement.', textAr: 'المنظمة تؤكد على الإجراءات التنافسية والإنجاز.', type: 'market' },
  { dim: 'emphasis', text: 'The organization emphasizes permanence and stability. Efficiency is important.', textAr: 'المنظمة تؤكد على الاستمرارية والاستقرار. الكفاءة مهمة.', type: 'hierarchy' },
  { dim: 'success', text: 'Success is defined as development of human resources and teamwork.', textAr: 'النجاح يُعرَّف بتطوير الموارد البشرية والعمل الجماعي.', type: 'clan' },
  { dim: 'success', text: 'Success is defined as having unique or newest products/services.', textAr: 'النجاح يُعرَّف بامتلاك منتجات/خدمات فريدة أو أحدث.', type: 'adhocracy' },
  { dim: 'success', text: 'Success is defined as winning in the marketplace.', textAr: 'النجاح يُعرَّف بالفوز في السوق.', type: 'market' },
  { dim: 'success', text: 'Success is defined as efficiency. Dependable delivery is key.', textAr: 'النجاح يُعرَّف بالكفاءة. التسليم الموثوق هو المفتاح.', type: 'hierarchy' },
];

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CULTURE_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires CULTURE_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_culture_assessments');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'latest';

  if (action === 'latest') {
    const data = await col.findOne({ tenantId, status: 'COMPLETED' }, { sort: { createdAt: -1 } });
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'history') {
    const data = await col.find({ tenantId }).sort({ createdAt: -1 }).limit(10).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'values') {
    const latest = await col.findOne({ tenantId }, { sort: { createdAt: -1 } }) as Record<string, unknown> | null;
    return NextResponse.json({ ok: true, data: latest?.declaredValues || [] });
  }
  if (action === 'initiatives') {
    const latest = await col.findOne({ tenantId, status: 'COMPLETED' }, { sort: { createdAt: -1 } }) as Record<string, unknown> | null;
    return NextResponse.json({ ok: true, data: (latest as any)?.transformationPlan?.initiatives || [] });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.culture.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CULTURE_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires CULTURE_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_culture_assessments');
  const body = await request.json();
  const action = body.action;

  if (action === 'start') {
    const now = new Date();
    const period = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;

    // Create OCAI survey
    let surveyId: string | null = null;
    try {
      const surveyCol = db.collection('cvision_surveys');
      const sId = uuidv4();
      const questions = OCAI_DIMENSIONS.map(q => ({
        questionId: uuidv4(), text: q.text, textAr: q.textAr,
        type: 'RATING_1_5' as const, options: [], required: true,
        metadata: { dimension: q.dim, cultureType: q.type },
      }));
      await surveyCol.insertOne({
        tenantId, surveyId: sId, title: `Culture Assessment (OCAI) ${period}`,
        titleAr: `تقييم الثقافة التنظيمية ${period}`,
        description: 'Organizational Culture Assessment Instrument', type: 'ORG_HEALTH',
        anonymous: true, status: 'ACTIVE', targetAudience: 'ALL', targetIds: [],
        startDate: now, endDate: null, questions, responseCount: 0, responseRate: 0,
        createdBy: userId, createdAt: now, updatedAt: now,
      });
      surveyId = sId;
    } catch { /* optional */ }

    const doc = {
      tenantId, assessmentId: uuidv4(), period,
      declaredValues: body.declaredValues || [],
      cultureDimensions: { clan: 0, adhocracy: 0, market: 0, hierarchy: 0 },
      currentProfile: { clan: 25, adhocracy: 25, market: 25, hierarchy: 25 },
      desiredProfile: body.desiredProfile || { clan: 25, adhocracy: 25, market: 25, hierarchy: 25 },
      cultureGap: 0, valuesAlignment: [], subCultures: [],
      transformationPlan: { targetCulture: '', initiatives: [], timeline: '', kpis: [] },
      overallScore: 0, status: 'IN_PROGRESS', surveyId,
      conductedBy: userId, createdAt: now, updatedAt: now,
    };
    await col.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'complete') {
    const { assessmentId, cultureDimensions, desiredProfile } = body;
    if (!assessmentId) return NextResponse.json({ ok: false, error: 'assessmentId required' }, { status: 400 });
    const current = cultureDimensions || { clan: 25, adhocracy: 25, market: 25, hierarchy: 25 };
    const desired = desiredProfile || { clan: 25, adhocracy: 25, market: 25, hierarchy: 25 };
    const gap = Math.round((Math.abs(current.clan - desired.clan) + Math.abs(current.adhocracy - desired.adhocracy) + Math.abs(current.market - desired.market) + Math.abs(current.hierarchy - desired.hierarchy)) / 4);
    const dominant = Object.entries(current).reduce((a, b) => (b[1] as number) > (a[1] as number) ? b : a);
    await col.updateOne({ tenantId, assessmentId }, { $set: {
      cultureDimensions: current, currentProfile: current, desiredProfile: desired,
      cultureGap: gap, overallScore: 100 - gap, status: 'COMPLETED',
      updatedAt: new Date(),
    }});
    return NextResponse.json({ ok: true, data: { cultureDimensions: current, cultureGap: gap, dominantType: dominant[0] } });
  }

  if (action === 'set-values') {
    const { values } = body;
    if (!values) return NextResponse.json({ ok: false, error: 'values required' }, { status: 400 });
    await col.updateOne({ tenantId, status: { $ne: 'COMPLETED' } }, { $set: { declaredValues: values, updatedAt: new Date() } }, { upsert: false });
    return NextResponse.json({ ok: true });
  }

  if (action === 'create-initiative') {
    const { assessmentId, initiative } = body;
    if (!assessmentId || !initiative) return NextResponse.json({ ok: false, error: 'assessmentId and initiative required' }, { status: 400 });
    await col.updateOne({ tenantId, assessmentId }, {
      $push: { 'transformationPlan.initiatives': { initiativeId: uuidv4(), ...initiative, status: 'ACTIVE', progress: 0 } } as Record<string, unknown>,
      $set: { updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.culture.write' });
