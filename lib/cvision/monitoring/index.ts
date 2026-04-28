import { logger } from '@/lib/monitoring/logger';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

/**
 * Application monitoring, structured logging, performance tracking,
 * and business alerts — no heavy external dependencies.
 *
 * Re-exports the centralized logger from @/lib/monitoring/logger.
 */

export { logger } from '@/lib/monitoring/logger';

/* ── Performance Tracker ───────────────────────────────────────────── */

const recentMetrics: { path: string; duration: number; status: number; ts: number }[] = [];
const MAX_METRICS = 5000;

export function trackRequest(path: string, duration: number, status: number) {
  if (duration > 2000) {
    logger.warn('Slow request', { path, duration, status });
  }
  recentMetrics.push({ path, duration, status, ts: Date.now() });
  if (recentMetrics.length > MAX_METRICS) recentMetrics.splice(0, recentMetrics.length - MAX_METRICS);
}

export function getAPIMetrics(lastMinutes = 60) {
  const cutoff = Date.now() - lastMinutes * 60 * 1000;
  const recent = recentMetrics.filter(m => m.ts >= cutoff);

  if (recent.length === 0) {
    return { total: 0, avgLatency: 0, p95Latency: 0, p99Latency: 0, errorRate: 0 };
  }

  const latencies = recent.map(m => m.duration).sort((a, b) => a - b);
  const errors = recent.filter(m => m.status >= 500).length;

  return {
    total: recent.length,
    avgLatency: Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length),
    p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99Latency: latencies[Math.floor(latencies.length * 0.99)] || 0,
    errorRate: Math.round((errors / recent.length) * 10000) / 100,
  };
}

/* ── Health Check ──────────────────────────────────────────────────── */

export async function getHealthStatus(db?: Db) {
  const services: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // MongoDB
  if (db) {
    try {
      const start = Date.now();
      await db.command({ ping: 1 });
      services.database = { status: 'ok', latencyMs: Date.now() - start };
    } catch (err: any) {
      services.database = { status: 'error', error: err.message };
    }
  } else {
    services.database = { status: 'unknown', error: 'No DB reference' };
  }

  // Redis (try to import cache module)
  try {
    const { cacheGet, cacheSet } = await import('@/lib/cvision/cache/redis');
    const start = Date.now();
    await cacheSet('_health_check', 'ok', 10);
    const val = await cacheGet('_health_check');
    services.cache = val ? { status: 'ok', latencyMs: Date.now() - start } : { status: 'degraded' };
  } catch {
    services.cache = { status: 'unavailable' };
  }

  const allHealthy = Object.values(services).every(s => s.status === 'ok');

  return {
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.APP_VERSION || '1.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    services,
    metrics: getAPIMetrics(5),
  };
}

/* ── Business Alerts ───────────────────────────────────────────────── */

interface BusinessAlert {
  name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  check: (db: Db, tenantId: string) => Promise<{ alert: boolean; message?: string }>;
}

const BUSINESS_ALERTS: BusinessAlert[] = [
  {
    name: 'Payroll Not Run',
    severity: 'HIGH',
    check: async (db, tenantId) => {
      const today = new Date();
      if (today.getDate() < 25) return { alert: false };
      const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const payroll = await db.collection('cvision_payroll').findOne({ tenantId, period, status: 'PAID' });
      if (!payroll) return { alert: true, message: `Payroll for ${period} has not been run yet` };
      return { alert: false };
    },
  },
  {
    name: 'GOSI Filing Overdue',
    severity: 'CRITICAL',
    check: async (_db, _tenantId) => {
      const today = new Date();
      if (today.getDate() > 15) return { alert: true, message: 'GOSI monthly filing is overdue (deadline: 15th)' };
      return { alert: false };
    },
  },
  {
    name: 'High Employee Turnover',
    severity: 'MEDIUM',
    check: async (db, tenantId) => {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const resignations = await db.collection('cvision_employees').countDocuments({
        tenantId, status: 'RESIGNED', updatedAt: { $gte: cutoff },
      });
      const total = await db.collection('cvision_employees').countDocuments({ tenantId, status: 'ACTIVE' });
      if (total === 0) return { alert: false };
      const rate = (resignations / total) * 100;
      if (rate > 5) return { alert: true, message: `Turnover rate is ${rate.toFixed(1)}% in last 90 days` };
      return { alert: false };
    },
  },
  {
    name: 'Expiring Iqamas',
    severity: 'HIGH',
    check: async (db, tenantId) => {
      const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const count = await db.collection('cvision_employees').countDocuments({
        tenantId, status: 'ACTIVE', iqamaExpiry: { $lte: soon, $exists: true },
      });
      if (count > 0) return { alert: true, message: `${count} employee(s) have Iqamas expiring within 30 days` };
      return { alert: false };
    },
  },
  {
    name: 'Pending Approvals Backlog',
    severity: 'MEDIUM',
    check: async (db, tenantId) => {
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const stale = await db.collection('cvision_workflow_instances').countDocuments({
        tenantId, status: 'IN_PROGRESS', startedAt: { $lte: cutoff },
      });
      if (stale > 10) return { alert: true, message: `${stale} approval(s) pending > 72 hours` };
      return { alert: false };
    },
  },
];

export async function runBusinessAlerts(db: Db, tenantId: string) {
  const results: { name: string; severity: string; alert: boolean; message?: string }[] = [];
  for (const alertDef of BUSINESS_ALERTS) {
    try {
      const result = await alertDef.check(db, tenantId);
      results.push({ name: alertDef.name, severity: alertDef.severity, ...result });
    } catch (err: any) {
      results.push({ name: alertDef.name, severity: alertDef.severity, alert: false, message: `Check failed: ${err.message}` });
    }
  }
  return results;
}

/* ── System Metrics (store in MongoDB) ─────────────────────────────── */

export async function storeMetricSnapshot(db: Db) {
  const metrics = getAPIMetrics(5);
  await db.collection('cvision_system_metrics').insertOne({
    timestamp: new Date(),
    type: 'API_SNAPSHOT',
    value: metrics.avgLatency,
    metadata: metrics,
  });
}
