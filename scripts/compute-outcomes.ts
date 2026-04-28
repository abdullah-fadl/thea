/**
 * Outcome Metrics Scheduler — Phase 6.3
 *
 * Loops over all registered outcomes × active tenants × the last N periods
 * and calls computeOutcome() for each combination.  Idempotent: running
 * twice produces the same OutcomeMeasurement rows (upsert semantics).
 *
 * Designed to run as a cron job (e.g. nightly for 'day' granularity).
 * Safe to interrupt — each upsert is atomic; partial runs leave consistent data.
 *
 * Usage:
 *   npx tsx scripts/compute-outcomes.ts \
 *     [--granularity day|week|month]      (default: day) \
 *     [--periods 7]                       (default: 7 — last N complete periods) \
 *     [--outcome er.door_to_provider_minutes]  (filter to one key; default: all) \
 *     [--tenant <uuid>]                   (filter to one tenant; default: all active)
 *
 * Environment:
 *   Reads MIGRATION_URL, DIRECT_URL, or DATABASE_URL from .env.local.
 *   Requires THEA_FF_OUTCOME_METRICS_ENABLED=true (forced by this script).
 *
 * Output (JSON lines to stdout):
 *   { event: 'start', outcomes: N, tenants: N, periods: N, granularity }
 *   { event: 'computed', outcomeKey, tenantId, periodStart, value, sampleSize }
 *   { event: 'unchanged', outcomeKey, tenantId, periodStart }   // value identical
 *   { event: 'error', outcomeKey, tenantId, periodStart, error }
 *   { event: 'summary', outcomes_processed, measurements_written, measurements_unchanged, errors, elapsed_ms }
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import dotenv from 'dotenv';

// ─── Boot ────────────────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Force the flag ON for this script run
process.env.THEA_FF_OUTCOME_METRICS_ENABLED = 'true';

// Also enable the event bus flag so eventRecord queries work
process.env.THEA_FF_EVENT_BUS_ENABLED = 'true';

const connectionString =
  process.env.MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌  DATABASE_URL / DIRECT_URL is not set in .env.local');
  process.exit(1);
}

// Import AFTER setting env vars so flag checks at module load time fire correctly
const { listOutcomes } = await import('../lib/outcomes/index.js');
const { computeOutcome } = await import('../lib/outcomes/compute.js');

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const granularity = (getArg('--granularity') ?? 'day') as
  | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
const periodsBack  = parseInt(getArg('--periods') ?? '7', 10);
const outcomeFilter = getArg('--outcome');
const tenantFilter  = getArg('--tenant');

// ─── Period helpers ───────────────────────────────────────────────────────────

function periodBoundaries(
  gran: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year',
  periodsAgo: number,
): { start: Date; end: Date } {
  const now = new Date();
  // Truncate to start of current period, then step back
  const base = new Date(now);
  switch (gran) {
    case 'hour':
      base.setMinutes(0, 0, 0);
      return { start: new Date(base.getTime() - periodsAgo * 3600_000), end: new Date(base.getTime() - (periodsAgo - 1) * 3600_000) };
    case 'day':
      base.setHours(0, 0, 0, 0);
      return { start: new Date(base.getTime() - periodsAgo * 86_400_000), end: new Date(base.getTime() - (periodsAgo - 1) * 86_400_000) };
    case 'week': {
      const day = base.getDay(); // 0 = Sunday
      base.setHours(0, 0, 0, 0);
      base.setDate(base.getDate() - day);
      const weekMs = 7 * 86_400_000;
      return { start: new Date(base.getTime() - periodsAgo * weekMs), end: new Date(base.getTime() - (periodsAgo - 1) * weekMs) };
    }
    case 'month': {
      const startM = new Date(base.getFullYear(), base.getMonth() - periodsAgo, 1);
      const endM   = new Date(base.getFullYear(), base.getMonth() - periodsAgo + 1, 1);
      return { start: startM, end: endM };
    }
    case 'quarter': {
      const q = Math.floor(base.getMonth() / 3);
      const startQ = new Date(base.getFullYear(), (q - periodsAgo) * 3, 1);
      const endQ   = new Date(base.getFullYear(), (q - periodsAgo + 1) * 3, 1);
      return { start: startQ, end: endQ };
    }
    case 'year': {
      const y = base.getFullYear() - periodsAgo;
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const adapter = new PrismaPg({ connectionString: connectionString! });
  const prisma  = new PrismaClient({ adapter });

  const startedAt = Date.now();

  // Resolve outcomes to process
  const allOutcomes = listOutcomes().filter(o => o.status === 'active');
  const outcomes = outcomeFilter
    ? allOutcomes.filter(o => o.key === outcomeFilter)
    : allOutcomes;

  if (outcomes.length === 0) {
    console.log(JSON.stringify({ event: 'warning', message: 'No active outcomes registered' }));
    await prisma.$disconnect();
    return;
  }

  // Resolve tenants
  const allTenants = await (prisma as unknown as { tenant: { findMany: (a: unknown) => Promise<Array<{ id: string }>> } })
    .tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  const tenants = tenantFilter
    ? allTenants.filter(t => t.id === tenantFilter)
    : allTenants;

  // Build period list (1..periodsBack, most recent first)
  const periods = Array.from({ length: periodsBack }, (_, i) => i + 1).map(i =>
    periodBoundaries(granularity, i),
  );

  console.log(
    JSON.stringify({
      event: 'start',
      outcomes: outcomes.length,
      tenants: tenants.length,
      periods: periods.length,
      granularity,
    }),
  );

  let written = 0;
  let unchanged = 0;
  let errors = 0;

  for (const outcome of outcomes) {
    for (const tenant of tenants) {
      for (const period of periods) {
        try {
          const existing = await (prisma as unknown as {
            outcomeMeasurement: {
              findFirst: (a: unknown) => Promise<{ value: number } | null>;
            };
          }).outcomeMeasurement.findFirst({
            where: {
              outcomeKey: outcome.key,
              tenantId: tenant.id,
              periodStart: period.start,
              periodGranularity: granularity,
            },
            select: { value: true },
          });

          const result = await computeOutcome(
            {
              outcomeKey: outcome.key,
              tenantId: tenant.id,
              period: { start: period.start, end: period.end, granularity },
            },
            prisma,
          );

          const isUnchanged =
            existing !== null && Math.abs(existing.value - result.value) < Number.EPSILON;

          if (isUnchanged) {
            unchanged++;
            console.log(
              JSON.stringify({
                event: 'unchanged',
                outcomeKey: outcome.key,
                tenantId: tenant.id,
                periodStart: period.start.toISOString(),
              }),
            );
          } else {
            written++;
            console.log(
              JSON.stringify({
                event: 'computed',
                outcomeKey: outcome.key,
                tenantId: tenant.id,
                periodStart: period.start.toISOString(),
                value: result.value,
                sampleSize: result.sampleSize,
              }),
            );
          }
        } catch (err) {
          errors++;
          console.error(
            JSON.stringify({
              event: 'error',
              outcomeKey: outcome.key,
              tenantId: tenant.id,
              periodStart: period.start.toISOString(),
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
    }
  }

  console.log(
    JSON.stringify({
      event: 'summary',
      outcomes_processed: outcomes.length,
      measurements_written: written,
      measurements_unchanged: unchanged,
      errors,
      elapsed_ms: Date.now() - startedAt,
    }),
  );

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
