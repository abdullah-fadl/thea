/**
 * Phase 8.6 — Readiness probe.
 *
 * GET /api/health/ready
 *   - No auth required (load balancers / orchestrators must hit it).
 *   - Pings the database with a short timeout.
 *   - 200 + { ready: true, dbLatencyMs } when reachable.
 *   - 503 + { ready: false, error }   when not.
 *
 * Distinct from /api/health (liveness — process is alive) because a node can
 * be alive but unable to serve real traffic if its DB is gone. K8s readiness
 * probes / ALB target-group health checks should hit /ready, not /.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { obs } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DB_PING_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('db_ping_timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function GET() {
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_PING_TIMEOUT_MS);
    const dbLatencyMs = Date.now() - start;
    return NextResponse.json(
      { ready: true, dbLatencyMs, timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'db_unreachable';
    obs.warn('health.ready.db_check_failed', {
      category: 'system',
      error: err,
      latencyMs: Date.now() - start,
    });
    return NextResponse.json(
      { ready: false, error: message, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
