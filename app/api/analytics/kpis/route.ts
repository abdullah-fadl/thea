import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { computeKpis, storeKpiValue } from '@/lib/analytics/kpis';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = new URL(req.url).searchParams;

    const now = new Date();
    const daysBack = parseInt(params.get('days') || '30', 10);
    const range = {
      start: params.get('start') ? new Date(params.get('start')!) : new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000),
      end: params.get('end') ? new Date(params.get('end')!) : now,
    };

    const dashboard = await computeKpis(tenantId, range);
    return NextResponse.json(dashboard);
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();

    if (!body.kpiId || body.value === undefined) {
      return NextResponse.json({ error: 'kpiId and value are required' }, { status: 400 });
    }

    await storeKpiValue(
      tenantId,
      body.kpiId,
      body.value,
      new Date(body.periodStart || new Date()),
      new Date(body.periodEnd || new Date()),
    );

    return NextResponse.json({ success: true }, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);
