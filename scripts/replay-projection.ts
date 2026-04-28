/**
 * Replay / rebuild a projection from the event stream.
 *
 * Usage:
 *   npx tsx scripts/replay-projection.ts --name <projectionName> [--from <sequence>] [--tenant <tenantId>]
 *
 * Options:
 *   --name     (required) Name of the registered projection to rebuild.
 *   --from     Starting event sequence (bigint). Defaults to 0 (full rebuild).
 *   --tenant   Limit replay to a single tenantId UUID.
 *
 * Safe to interrupt — rebuild is idempotent.
 *
 * Environment:
 *   Reads MIGRATION_URL, DIRECT_URL, or DATABASE_URL from .env.local.
 *   Requires THEA_FF_EVENT_PROJECTIONS_ENABLED=true (or pass via env).
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import dotenv from 'dotenv';

// ─── Boot ────────────────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Ensure the flag is on for this script run
process.env.THEA_FF_EVENT_PROJECTIONS_ENABLED = 'true';

const connectionString =
  process.env.MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌  DATABASE_URL / DIRECT_URL is not set in .env.local');
  process.exit(1);
}

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const projectionName = getArg('--name');
const fromArg = getArg('--from');
const tenantArg = getArg('--tenant');

if (!projectionName) {
  console.error('❌  --name <projectionName> is required');
  console.error('    Usage: npx tsx scripts/replay-projection.ts --name tenantEventCount [--from 0] [--tenant <uuid>]');
  process.exit(1);
}

const fromSequence = fromArg !== undefined ? BigInt(fromArg) : undefined;

// ─── Prisma setup ─────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Import projections AFTER setting the flag so registerProjection() is active
  const { rebuildProjection, listProjections } =
    await import('../lib/events/projections/framework');
  // Trigger example registrations
  await import('../lib/events/projections/index');

  const registered = listProjections();
  if (!registered.includes(projectionName!)) {
    console.error(`❌  Projection "${projectionName}" is not registered.`);
    console.error(`   Registered: ${registered.join(', ') || '(none)'}`);
    process.exit(1);
  }

  console.log(`\n🔄  Rebuilding projection "${projectionName}" …`);
  if (tenantArg) console.log(`    tenantId  : ${tenantArg}`);
  if (fromSequence !== undefined) console.log(`    fromSeq   : ${fromSequence}`);

  const startTs = Date.now();
  let lastLogAt = 0;

  // Patch rebuildProjection to print progress every 1 000 events.
  // We wrap the real call and inject a progress-printing prisma proxy.
  const { rebuildProjection: rebuild } = await import('../lib/events/projections/framework');

  const progressProxy = new Proxy(prisma, {
    get(target, prop) {
      if (prop === 'eventRecord') {
        return new Proxy((target as never as Record<string, unknown>)[prop as string] as object, {
          get(tgt, method) {
            const original = (tgt as Record<string, unknown>)[method as string];
            if (method === 'findMany' && typeof original === 'function') {
              return async (...a: unknown[]) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rows = await (original as any).apply(tgt, a);
                const total = (rows as unknown[]).length;
                if (total > 0 && Date.now() - lastLogAt > 1_000) {
                  console.log(`    … processed batch (${total} events, ${Date.now() - startTs}ms elapsed)`);
                  lastLogAt = Date.now();
                }
                return rows;
              };
            }
            return typeof original === 'function'
              ? (...a: unknown[]) => (original as Function).apply(tgt, a)
              : original;
          },
        });
      }
      return (target as never as Record<string, unknown>)[prop as string];
    },
  });

  const report = await rebuild(
    projectionName!,
    { tenantId: tenantArg, fromSequence },
    progressProxy as unknown as typeof import('../lib/db/prisma').prisma,
  );

  console.log(`\n✅  Done.`);
  console.log(`    Events processed : ${report.eventsProcessed}`);
  console.log(`    Snapshots taken  : ${report.snapshotsTaken}`);
  console.log(`    Duration         : ${report.durationMs} ms`);
  console.log(`    From sequence    : ${report.fromSequence}`);
}

main()
  .catch((err) => {
    console.error('❌  Replay failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
