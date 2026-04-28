import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as engine from '@/lib/cvision/od/process-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await engine.ensureSeedData(db, tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';

  if (action === 'dashboard') {
    const data = await engine.getDashboard(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'detail') {
    const analysisId = searchParams.get('analysisId');
    if (!analysisId) return NextResponse.json({ ok: false, error: 'analysisId required' }, { status: 400 });
    const data = await engine.getDetail(db, tenantId, analysisId);
    if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'bottlenecks') {
    const data = await engine.getBottlenecks(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'improvements') {
    const data = await engine.getImprovements(db, tenantId);
    const matrix = engine.categorizeImprovements(data);
    return NextResponse.json({ ok: true, data, matrix });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await engine.ensureSeedData(db, tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'propose-improvement') {
    if (!body.analysisId) return NextResponse.json({ ok: false, error: 'analysisId required' }, { status: 400 });
    const data = await engine.proposeImprovement(db, tenantId, body.analysisId, body.improvement || body);
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'implement') {
    if (!body.analysisId || !body.actionId) return NextResponse.json({ ok: false, error: 'analysisId and actionId required' }, { status: 400 });
    await engine.updateImprovement(db, tenantId, body.analysisId, body.actionId, { status: 'COMPLETED', completedDate: new Date(), measuredImpact: body.measuredImpact });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
