/**
 * Basic In-Memory Metrics for Thea EHR
 *
 * Tracks request count, error count, and response time per route.
 * Exposed via /api/health?metrics=true.
 *
 * Note: Data is lost on restart — this is intentional for a lightweight solution.
 * For persistent metrics, integrate with Prometheus / Datadog.
 */

export interface RouteMetric {
  count: number;
  errors: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  lastAt: string;
}

const routeMetrics = new Map<string, RouteMetric>();

/**
 * Record a request metric.
 */
export function recordRequest(route: string, durationMs: number, isError: boolean): void {
  const existing = routeMetrics.get(route);
  if (existing) {
    existing.count += 1;
    if (isError) existing.errors += 1;
    existing.totalMs += durationMs;
    existing.avgMs = Math.round(existing.totalMs / existing.count);
    existing.maxMs = Math.max(existing.maxMs, durationMs);
    existing.lastAt = new Date().toISOString();
  } else {
    routeMetrics.set(route, {
      count: 1,
      errors: isError ? 1 : 0,
      totalMs: durationMs,
      avgMs: durationMs,
      maxMs: durationMs,
      lastAt: new Date().toISOString(),
    });
  }
}

/**
 * Get all metrics — sorted by request count descending.
 */
export function getMetrics(): Record<string, RouteMetric> {
  const sorted = [...routeMetrics.entries()].sort((a, b) => b[1].count - a[1].count);
  return Object.fromEntries(sorted);
}

/**
 * Get summary metrics.
 */
export function getMetricsSummary(): {
  totalRequests: number;
  totalErrors: number;
  topRoutes: { route: string; count: number }[];
} {
  let totalRequests = 0;
  let totalErrors = 0;

  for (const m of routeMetrics.values()) {
    totalRequests += m.count;
    totalErrors += m.errors;
  }

  const topRoutes = [...routeMetrics.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([route, m]) => ({ route, count: m.count }));

  return { totalRequests, totalErrors, topRoutes };
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetMetrics(): void {
  routeMetrics.clear();
}
