import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { REPORT_TEMPLATES, generateReport } from '@/lib/cvision/report-builder';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_READ');
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'templates') {
    return NextResponse.json({ ok: true, data: REPORT_TEMPLATES });
  }

  if (action === 'list') {
    const saved = await db.collection('cvision_saved_reports').find({ tenantId, $or: [{ createdBy: ctx.userId }, { isShared: true }] }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data: saved });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.reports.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'generate') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_READ');
    const tpl = REPORT_TEMPLATES.find(t => t.key === body.templateKey);
    const collection = body.collection || tpl?.collection;
    const fields = body.fields || tpl?.defaultFields || [];
    if (!collection) return NextResponse.json({ ok: false, error: 'No collection specified' }, { status: 400 });

    const result = await generateReport(db, tenantId, {
      collection, fields,
      filters: body.filters,
      groupBy: body.groupBy || tpl?.defaultGroupBy,
      sortBy: body.sortBy || tpl?.defaultSort,
      page: body.page, pageSize: body.pageSize,
      templateKey: body.templateKey,
    });

    return NextResponse.json({ ok: true, data: result });
  }

  if (action === 'save') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_READ');
    const doc = {
      tenantId, reportId: uuid(), name: body.name || 'Saved Report', nameAr: body.nameAr || '',
      templateKey: body.templateKey, collection: body.collection, fields: body.fields,
      filters: body.filters, groupBy: body.groupBy, sortBy: body.sortBy,
      isShared: body.isShared || false, createdBy: ctx.userId, createdAt: new Date(),
    };
    await db.collection('cvision_saved_reports').insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'export') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_EXPORT)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_EXPORT');
    const tpl = REPORT_TEMPLATES.find(t => t.key === body.templateKey);
    const collection = body.collection || tpl?.collection;
    const fields = body.fields || tpl?.defaultFields || [];
    if (!collection) return NextResponse.json({ ok: false, error: 'No collection specified' }, { status: 400 });

    const result = await generateReport(db, tenantId, { collection, fields, filters: body.filters, groupBy: body.groupBy, sortBy: body.sortBy, pageSize: 10000, templateKey: body.templateKey });

    if (body.format === 'csv') {
      const header = fields.join(',');
      const rows = (result.data || []).map((r: any) => fields.map((f: string) => `"${String(r[f] || '').replace(/"/g, '""')}"`).join(','));
      const csv = [header, ...rows].join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="report-${Date.now()}.csv"` } });
    }

    return NextResponse.json({ ok: true, data: result });
  }

  if (action === 'schedule') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_EXPORT)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_EXPORT');
    const doc = {
      tenantId, scheduleId: uuid(), reportId: body.reportId, templateKey: body.templateKey,
      parameters: body.parameters || {}, frequency: body.frequency || 'MONTHLY',
      nextRun: body.nextRun ? new Date(body.nextRun) : new Date(),
      recipients: body.recipients || [], format: body.format || 'csv',
      isActive: true, createdBy: ctx.userId, createdAt: new Date(),
    };
    await db.collection('cvision_report_schedules').insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.reports.read' });
