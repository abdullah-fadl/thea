import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { getWidgetData, getDefaultDashboard } from '@/lib/cvision/dashboard-engine';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctx = await requireCtx(request);
  if (ctx instanceof NextResponse) return ctx;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    let dashboards = await db.collection('cvision_dashboards').find({ tenantId, $or: [{ ownerId: ctx.userId }, { isShared: true }] }).sort({ updatedAt: -1 }).limit(100).toArray();
    if (dashboards.length === 0) {
      const def = getDefaultDashboard(tenantId);
      await db.collection('cvision_dashboards').insertOne(def);
      dashboards.push(def as Record<string, unknown>);
    } else {
      // Auto-upgrade default dashboard if its widgets use stale filters (e.g. lowercase 'active')
      const defaultDash = dashboards.find((d: any) => d.dashboardId === 'default-hr-overview');
      if (defaultDash) {
        const w1 = (defaultDash as any).widgets?.find((w: Record<string, unknown>) => w.widgetId === 'w1');
        const needsUpgrade = w1?.filters?.some((f: any) => f.field === 'status' && f.operator === 'eq' && f.value === 'active');
        if (needsUpgrade) {
          const freshDash = getDefaultDashboard(tenantId);
          await db.collection('cvision_dashboards').updateOne(
            { tenantId, dashboardId: 'default-hr-overview' },
            { $set: { widgets: freshDash.widgets, updatedAt: new Date() } },
          );
          const idx = dashboards.findIndex((d: any) => d.dashboardId === 'default-hr-overview');
          if (idx >= 0) (dashboards[idx] as Record<string, unknown>).widgets = freshDash.widgets;
        }
      }
    }
    return NextResponse.json({ ok: true, data: dashboards });
  }

  if (action === 'get') {
    const id = searchParams.get('id');
    const dash = await db.collection('cvision_dashboards').findOne({ tenantId, dashboardId: id });
    if (!dash) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: dash });
  }

  if (action === 'widget-data') {
    const widgetId = searchParams.get('widgetId');
    const dashboardId = searchParams.get('dashboardId');
    const dash = await db.collection('cvision_dashboards').findOne({ tenantId, dashboardId }) as Record<string, unknown> | null;
    if (!dash) return NextResponse.json({ ok: false, error: 'Dashboard not found' }, { status: 404 });
    const widget = ((dash.widgets || []) as Record<string, unknown>[]).find((w: Record<string, unknown>) => w.widgetId === widgetId);
    if (!widget) return NextResponse.json({ ok: false, error: 'Widget not found' }, { status: 404 });
    const data = await getWidgetData(db, tenantId, widget as any);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctx = await requireCtx(request);
  if (ctx instanceof NextResponse) return ctx;
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const doc = { tenantId, dashboardId: uuid(), name: body.name || 'New Dashboard', nameAr: body.nameAr || '', ownerId: ctx.userId, isShared: body.isShared || false, widgets: body.widgets || [], createdAt: new Date(), updatedAt: new Date() };
    await db.collection('cvision_dashboards').insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'update') {
    const update: any = { updatedAt: new Date() };
    if (body.name) update.name = body.name;
    if (body.nameAr) update.nameAr = body.nameAr;
    if (body.widgets) update.widgets = body.widgets;
    if (body.isShared !== undefined) update.isShared = body.isShared;
    await db.collection('cvision_dashboards').updateOne({ tenantId, dashboardId: body.dashboardId }, { $set: update });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    await db.collection('cvision_dashboards').deleteOne({ tenantId, dashboardId: body.dashboardId, ownerId: ctx.userId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.write' });
