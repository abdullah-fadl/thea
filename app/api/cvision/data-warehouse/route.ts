import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { runETL, DW_TABLES } from '@/lib/cvision/data-warehouse/etl';
import { generateCSVExport } from '@/lib/cvision/data-warehouse/bi-connector';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_READ');
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'tables';

  if (action === 'tables') {
    const tables = [];
    for (const t of DW_TABLES) {
      const count = await db.collection(t.name).countDocuments({ tenantId }).catch(() => 0);
      tables.push({ ...t, rowCount: count });
    }
    return NextResponse.json({ ok: true, data: tables });
  }

  if (action === 'status') {
    const lastRun = await db.collection('cvision_etl_runs').findOne({ tenantId }, { sort: { startedAt: -1 } });
    return NextResponse.json({ ok: true, data: lastRun });
  }

  if (action === 'query') {
    const table = searchParams.get('table');
    const groupBy = searchParams.get('groupBy');
    const metric = searchParams.get('metric') || 'count';
    if (!table) return NextResponse.json({ ok: false, error: 'table required' }, { status: 400 });

    const ALLOWED_COLLECTIONS = new Set(DW_TABLES.map(t => t.name));
    const resolved = DW_TABLES.find(t => t.name === table || t.label.toLowerCase() === table);
    const colName = resolved?.name;
    if (!colName || !ALLOWED_COLLECTIONS.has(colName)) {
      return NextResponse.json({ ok: false, error: `Invalid table: ${table}. Allowed: ${DW_TABLES.map(t => t.name).join(', ')}` }, { status: 400 });
    }
    const col = db.collection(colName);
    if (groupBy) {
      const pipeline = [{ $match: { tenantId } }, { $group: { _id: `$${groupBy}`, value: metric === 'count' ? { $sum: 1 } : { [`$${metric}`]: `$${searchParams.get('field') || 'salary'}` } } }, { $sort: { value: -1 as const } }];
      const data = await col.aggregate(pipeline).toArray();
      return NextResponse.json({ ok: true, data });
    }
    const data = await col.find({ tenantId }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'export') {
    const table = searchParams.get('table');
    if (!table) return NextResponse.json({ ok: false, error: 'table required' }, { status: 400 });
    const ALLOWED_EXPORT = new Set(DW_TABLES.map(t => t.name));
    const resolvedExport = DW_TABLES.find(t => t.name === table || t.label.toLowerCase() === table);
    const exportColName = resolvedExport?.name;
    if (!exportColName || !ALLOWED_EXPORT.has(exportColName)) {
      return NextResponse.json({ ok: false, error: `Invalid table: ${table}. Allowed: ${DW_TABLES.map(t => t.name).join(', ')}` }, { status: 400 });
    }
    const csv = await generateCSVExport(db, tenantId, exportColName);
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${exportColName}-${Date.now()}.csv"` } });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.REPORTS_EXPORT)) return deny('INSUFFICIENT_PERMISSION', 'Requires REPORTS_EXPORT');
  const db = await getCVisionDb(tenantId);
  const body = await request.json();

  if (body.action === 'run-etl') {
    const startedAt = new Date();
    const results = await runETL(db, tenantId);
    const completedAt = new Date();
    const rowCounts: Record<string, number> = {};
    results.forEach(r => { rowCounts[r.table] = r.rowCount; });
    await db.collection('cvision_etl_runs').insertOne({ tenantId, startedAt, completedAt, status: 'SUCCESS', tablesUpdated: results.length, rowCounts, durationMs: completedAt.getTime() - startedAt.getTime(), runBy: ctx.userId });
    return NextResponse.json({ ok: true, data: { results, durationMs: completedAt.getTime() - startedAt.getTime() } });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });
