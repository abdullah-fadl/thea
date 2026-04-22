import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { ensureSeedData, REPORT_TEMPLATES, runReport } from '@/lib/cvision/reports/reports-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLL = 'cvision_saved_reports';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await ensureSeedData(db, tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'templates';

  if (action === 'templates') {
    const category = searchParams.get('category');
    let templates = [...REPORT_TEMPLATES];
    if (category) templates = templates.filter(t => t.category === category);
    return NextResponse.json({ ok: true, templates });
  }

  if (action === 'saved-reports') {
    const category = searchParams.get('category');
    const filter: any = { tenantId };
    if (category) filter.category = category;
    const reports = await db.collection(COLL).find(filter).sort({ updatedAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, reports });
  }

  if (action === 'run-report') {
    const reportId = searchParams.get('reportId');
    if (!reportId) return NextResponse.json({ ok: false, error: 'reportId required' }, { status: 400 });
    const report = await db.collection(COLL).findOne({ tenantId, reportId });
    if (!report) return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 });
    const data = await runReport(db, tenantId, report.query);
    await db.collection(COLL).updateOne({ tenantId, reportId }, { $set: { lastRunAt: new Date() } });
    return NextResponse.json({ ok: true, data, report });
  }

  if (action === 'schedule-list') {
    const scheduled = await db.collection(COLL).find({ tenantId, scheduled: true }).sort({ updatedAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, scheduled });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.reports.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  if (action === 'save-report') {
    const { name, description, category, query, chartType, scheduled, schedule, visibility } = body;
    const now = new Date();
    const count = await db.collection(COLL).countDocuments({ tenantId });
    const reportId = `RPT-${String(count + 1).padStart(3, '0')}`;
    await db.collection(COLL).insertOne({
      tenantId, reportId, name, description, category: category || 'CUSTOM',
      query, chartType: chartType || 'TABLE',
      scheduled: scheduled || false, schedule,
      visibility: visibility || 'PRIVATE', createdBy: userId,
      createdAt: now, updatedAt: now,
    });
    return NextResponse.json({ ok: true, reportId });
  }

  if (action === 'run-custom') {
    const { query } = body;
    const data = await runReport(db, tenantId, query);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'schedule') {
    const { reportId, schedule } = body;
    await db.collection(COLL).updateOne(
      { tenantId, reportId },
      { $set: { scheduled: true, schedule, updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'unschedule') {
    const { reportId } = body;
    await db.collection(COLL).updateOne(
      { tenantId, reportId },
      { $set: { scheduled: false, updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'share') {
    const { reportId, visibility } = body;
    await db.collection(COLL).updateOne(
      { tenantId, reportId },
      { $set: { visibility, updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'duplicate') {
    const { reportId } = body;
    const original = await db.collection(COLL).findOne({ tenantId, reportId });
    if (!original) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    const count = await db.collection(COLL).countDocuments({ tenantId });
    const newId = `RPT-${String(count + 1).padStart(3, '0')}`;
    const { _id, ...rest } = original;
    await db.collection(COLL).insertOne({
      ...rest, reportId: newId, name: `${original.name} (Copy)`,
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true, reportId: newId });
  }

  if (action === 'delete') {
    const { reportId } = body;
    await db.collection(COLL).deleteOne({ tenantId, reportId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.reports.read' });
