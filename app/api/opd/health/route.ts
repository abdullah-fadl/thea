import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/core/errors';
import { runHealthChecks } from '@/lib/monitoring/health';
import { getMetrics, getMetricsSummary } from '@/lib/monitoring/metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * OPD Health — delegates to global health system.
 * Kept for backward-compatibility with existing Docker health checks.
 */
export const GET = withErrorHandler(async (req) => {
  const url = new URL(req.url);
  const detailed = url.searchParams.get('detailed') === 'true';
  const showMetrics = url.searchParams.get('metrics') === 'true';

  const report = await runHealthChecks();

  const body: any = {
    status: report.status,
    uptime: report.uptime,
    timestamp: report.timestamp,
    version: report.version,
  };

  if (detailed) {
    body.checks = report.checks;
  }

  if (showMetrics) {
    body.metrics = getMetricsSummary();
    body.routeMetrics = getMetrics();
  }

  return NextResponse.json(body, { status: report.status === 'unhealthy' ? 503 : 200 });
});
