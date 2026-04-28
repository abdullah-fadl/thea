import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/core/errors';
import { runHealthChecks } from '@/lib/monitoring/health';
import { getMetrics, getMetricsSummary } from '@/lib/monitoring/metrics';
import { getErrorStats, getRecentErrors } from '@/lib/monitoring/errorReporter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Global Health Endpoint
 *
 * GET /api/health                        — basic status
 * GET /api/health?detailed=true          — full diagnostics (database, memory, pool)
 * GET /api/health?metrics=true           — request metrics per route
 * GET /api/health?errors=true            — recent errors + error stats
 * GET /api/health?dashboard=true         — full monitoring dashboard (all of the above)
 */
export const GET = withErrorHandler(async (req) => {
  const url = new URL(req.url);
  const detailed = url.searchParams.get('detailed') === 'true';
  const showMetrics = url.searchParams.get('metrics') === 'true';
  const showErrors = url.searchParams.get('errors') === 'true';
  const dashboard = url.searchParams.get('dashboard') === 'true';

  const report = await runHealthChecks();

  const body: any = {
    status: report.status,
    uptime: report.uptime,
    timestamp: report.timestamp,
    version: report.version,
  };

  if (detailed || dashboard) {
    body.checks = report.checks;
  }

  if (showMetrics || dashboard) {
    body.metrics = getMetricsSummary();
    body.routeMetrics = getMetrics();
  }

  if (showErrors || dashboard) {
    body.errorStats = getErrorStats();
    body.recentErrors = getRecentErrors(dashboard ? 10 : 20);
  }

  return NextResponse.json(body, {
    status: report.status === 'unhealthy' ? 503 : 200,
  });
});
