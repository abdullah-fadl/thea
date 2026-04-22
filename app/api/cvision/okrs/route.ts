import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as engine from '@/lib/cvision/okrs/okrs-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await engine.ensureSeedData(db, tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list-okrs';
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  if (action === 'list-okrs') {
    const okrs = await engine.listOKRs(db, tenantId, {
      level: searchParams.get('level') || undefined,
      period: searchParams.get('period') || undefined,
      year, status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ ok: true, okrs });
  }
  if (action === 'detail') {
    const okrId = searchParams.get('okrId') || '';
    const okr = await engine.getOKRDetail(db, tenantId, okrId);
    return NextResponse.json({ ok: true, okr });
  }
  if (action === 'my-okrs') {
    const employeeId = searchParams.get('employeeId') || '';
    const okrs = await engine.getMyOKRs(db, tenantId, employeeId);
    return NextResponse.json({ ok: true, okrs });
  }
  if (action === 'team-okrs') {
    const departmentId = searchParams.get('departmentId') || '';
    const okrs = await engine.getTeamOKRs(db, tenantId, departmentId);
    return NextResponse.json({ ok: true, okrs });
  }
  if (action === 'company-okrs') {
    const okrs = await engine.getCompanyOKRs(db, tenantId, year);
    return NextResponse.json({ ok: true, okrs });
  }
  if (action === 'alignment-tree') {
    const tree = await engine.getAlignmentTree(db, tenantId, year);
    return NextResponse.json({ ok: true, tree });
  }
  if (action === 'progress-dashboard') {
    const dashboard = await engine.getProgressDashboard(db, tenantId, year);
    return NextResponse.json({ ok: true, dashboard });
  }
  if (action === 'list-kpis') {
    const category = searchParams.get('category') || undefined;
    const kpis = await engine.listKPIs(db, tenantId, category);
    return NextResponse.json({ ok: true, kpis });
  }
  if (action === 'kpi-detail') {
    const kpiId = searchParams.get('kpiId') || '';
    const kpi = await engine.getKPIDetail(db, tenantId, kpiId);
    return NextResponse.json({ ok: true, kpi });
  }
  if (action === 'kpi-dashboard') {
    const kpis = await engine.getKPIDashboard(db, tenantId);
    return NextResponse.json({ ok: true, kpis });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.performance.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const okrId = await engine.createOKR(db, tenantId, body, userId || 'unknown');
    return NextResponse.json({ ok: true, okrId });
  }
  if (action === 'update') {
    await engine.updateOKR(db, tenantId, body.okrId, body.updates);
    return NextResponse.json({ ok: true });
  }
  if (action === 'check-in') {
    await engine.checkInKR(db, tenantId, body.okrId, body.krId, body.value, body.notes || '', userId || 'unknown');
    return NextResponse.json({ ok: true });
  }
  if (action === 'complete') {
    await engine.updateOKR(db, tenantId, body.okrId, { status: 'COMPLETED', overallStatus: 'COMPLETED' });
    return NextResponse.json({ ok: true });
  }
  if (action === 'archive') {
    await engine.updateOKR(db, tenantId, body.okrId, { status: 'CANCELLED' });
    return NextResponse.json({ ok: true });
  }
  if (action === 'create-kpi') {
    const kpiId = await engine.createKPI(db, tenantId, body);
    return NextResponse.json({ ok: true, kpiId });
  }
  if (action === 'record-value') {
    await engine.recordKPIValue(db, tenantId, body.kpiId, body.period, body.value);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.performance.write' });
