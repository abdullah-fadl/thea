/**
 * Health Check Utilities for Thea EHR
 *
 * Provides database, memory, and uptime checks exposed via /api/health.
 */

import { prisma } from '@/lib/db/prisma';

export interface HealthCheck {
  ok: boolean;
  ms?: number;
  error?: string;
  [key: string]: unknown;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    redis: HealthCheck;
  };
}

// ---------------------------------------------------------------------------
// Database health
// ---------------------------------------------------------------------------

export async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database check failed';
    return { ok: false, ms: Date.now() - start, error: message };
  }
}

// ---------------------------------------------------------------------------
// Memory health
// ---------------------------------------------------------------------------

export function checkMemory(): HealthCheck {
  try {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const usagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

    return {
      ok: usagePercent < 90,
      heapUsedMb,
      heapTotalMb,
      rssMb,
      usagePercent,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Memory check failed';
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Redis health
// ---------------------------------------------------------------------------

export async function checkRedis(): Promise<HealthCheck> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { ok: true, ms: 0, note: 'Redis not configured (using in-memory cache)' };
  }

  const start = Date.now();
  try {
    // Use the existing ioredis client from our redis utility
    const { getRedis } = await import('@/lib/security/redis');
    const client = getRedis();
    if (!client) {
      return { ok: false, ms: Date.now() - start, error: 'Redis client unavailable' };
    }
    await client.ping();
    return { ok: true, ms: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Redis check failed';
    return { ok: false, ms: Date.now() - start, error: message };
  }
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export async function runHealthChecks(): Promise<HealthReport> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const memory = checkMemory();

  const allOk = database.ok && memory.ok;
  const degraded = !allOk && database.ok; // Redis down = degraded, DB down = unhealthy

  return {
    status: allOk ? 'healthy' : degraded ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.NEXT_PUBLIC_BUILD_ID || process.env.BUILD_ID || 'dev',
    checks: { database, memory, redis },
  };
}
