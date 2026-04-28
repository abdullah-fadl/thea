import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getOperationalSummary, getFinancialSummary, getMetricTrend, DateRange } from '@/lib/analytics/engine';

export const dynamic = 'force-dynamic';

function parseDateRange(params: URLSearchParams): DateRange {
  const now = new Date();
  const daysBack = parseInt(params.get('days') || '30', 10);
  return {
    start: params.get('start') ? new Date(params.get('start')!) : new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000),
    end: params.get('end') ? new Date(params.get('end')!) : now,
  };
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = new URL(req.url).searchParams;
    const range = parseDateRange(params);
    const view = params.get('view') || 'operational';

    if (view === 'financial') {
      const summary = await getFinancialSummary(tenantId, range);
      return NextResponse.json(summary);
    }

    if (view === 'trend') {
      const metric = params.get('metric') || 'encounters';
      const granularity = (params.get('granularity') || 'day') as 'hour' | 'day' | 'week' | 'month';
      const trend = await getMetricTrend(tenantId, metric, range, granularity);
      return NextResponse.json({ metric, granularity, data: trend });
    }

    const summary = await getOperationalSummary(tenantId, range);
    return NextResponse.json(summary);
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);
