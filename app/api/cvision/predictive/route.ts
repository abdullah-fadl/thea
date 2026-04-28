import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  salaryForecast,
  headcountForecast,
  absenceForecast,
  hiringTimeline,
  costForecast,
  getDashboard,
  runForecast,
} from '@/lib/cvision/predictive';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }: any) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';

  // ── Dashboard (all forecasts combined) ────────────────────────────────
  if (action === 'dashboard') {
    const data = await getDashboard(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Salary forecast ───────────────────────────────────────────────────
  if (action === 'salary-forecast') {
    const data = await salaryForecast(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Headcount forecast ────────────────────────────────────────────────
  if (action === 'headcount-forecast') {
    const data = await headcountForecast(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Absence forecast ──────────────────────────────────────────────────
  if (action === 'absence-forecast') {
    const data = await absenceForecast(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Hiring timeline ───────────────────────────────────────────────────
  if (action === 'hiring-timeline') {
    const level = searchParams.get('level') || undefined;
    const department = searchParams.get('department') || undefined;
    const data = await hiringTimeline(db, tenantId, { level, department });
    return NextResponse.json({ ok: true, data });
  }

  // ── Cost forecast ─────────────────────────────────────────────────────
  if (action === 'cost-forecast') {
    const data = await costForecast(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' });

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }: any) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  // ── Run a specific forecast model ─────────────────────────────────────
  if (action === 'run-forecast') {
    if (!body.model) {
      return NextResponse.json({ ok: false, error: 'model is required' }, { status: 400 });
    }
    const data = await runForecast(db, tenantId, body.model, body.params || {});
    return NextResponse.json({ ok: true, data });
  }

  // ── Update parameters (placeholder) ───────────────────────────────────
  if (action === 'update-parameters') {
    return NextResponse.json({ ok: true, data: { updated: true } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' });
