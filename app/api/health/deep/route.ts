/**
 * Phase 8.6 — Deep health probe.
 *
 * GET /api/health/deep
 *   - Requires authentication (any logged-in tenant user).
 *   - Returns a deeper snapshot useful for an ops dashboard:
 *       dbLatencyMs            — fresh DB ping
 *       migrations.applied     — count of finished _prisma_migrations rows
 *       migrations.latest      — most recent migration name
 *       flags.total            — total feature flags declared
 *       flags.enabled          — count currently enabled in the env
 *       registries.events      — registered event schemas
 *       registries.agents      — registered AI agents
 *       registries.outcomes    — registered outcome metrics
 *
 * Why auth-required: this leaks shape information (flag count, registered
 * agent / outcome counts) that we don't want on a public endpoint. Anyone
 * with a valid session can call it — the data is operational, not sensitive.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { FLAGS } from '@/lib/core/flags';
import { listRegisteredEvents } from '@/lib/events/registry';
import { listAgents } from '@/lib/agents/framework/registry';
import { listOutcomes } from '@/lib/outcomes/registry';
import { obs } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DB_PING_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('db_ping_timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

interface MigrationRow {
  migration_name: string;
}

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const t0 = Date.now();
    let dbLatencyMs: number | null = null;
    let migrationsApplied = 0;
    let latestMigration: string | null = null;
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, DB_PING_TIMEOUT_MS);
      dbLatencyMs = Date.now() - t0;

      // _prisma_migrations may not exist in non-Prisma test fixtures.
      try {
        const rows = await prisma.$queryRaw<MigrationRow[]>`
          SELECT migration_name
            FROM _prisma_migrations
           WHERE finished_at IS NOT NULL
           ORDER BY finished_at DESC
        `;
        migrationsApplied = rows.length;
        latestMigration = rows[0]?.migration_name ?? null;
      } catch {
        migrationsApplied = 0;
        latestMigration = null;
      }
    } catch (err) {
      obs.warn('health.deep.db_check_failed', {
        category: 'system',
        tenantId,
        userId,
        error: err,
      });
    }

    const flagKeys = Object.keys(FLAGS) as Array<keyof typeof FLAGS>;
    const flagsEnabled = flagKeys.filter(
      (k) => process.env[FLAGS[k]] === 'true',
    ).length;

    let eventsRegistered = 0;
    let agentsRegistered = 0;
    let outcomesRegistered = 0;
    try { eventsRegistered = listRegisteredEvents().length; } catch { /* registry not loaded */ }
    try { agentsRegistered = listAgents().length; } catch { /* registry not loaded */ }
    try { outcomesRegistered = listOutcomes().length; } catch { /* registry not loaded */ }

    return NextResponse.json(
      {
        status: dbLatencyMs == null ? 'degraded' : 'ok',
        timestamp: new Date().toISOString(),
        dbLatencyMs,
        migrations: {
          applied: migrationsApplied,
          latest: latestMigration,
        },
        flags: {
          total: flagKeys.length,
          enabled: flagsEnabled,
        },
        registries: {
          events: eventsRegistered,
          agents: agentsRegistered,
          outcomes: outcomesRegistered,
        },
      },
      { status: dbLatencyMs == null ? 503 : 200 },
    );
  },
  { tenantScoped: true, platformKey: 'thea_health' },
);
