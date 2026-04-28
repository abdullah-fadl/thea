/**
 * Backfill embeddings for CoreDepartment rows that have embedding = NULL.
 *
 * Usage:
 *   npx tsx scripts/backfill-core-department-embeddings.ts [--tenant <uuid>] [--dry-run]
 *
 * Options:
 *   --tenant   Limit backfill to a single tenantId UUID.
 *   --dry-run  Print counts without calling OpenAI or writing vectors.
 *
 * Environment:
 *   Reads MIGRATION_URL, DIRECT_URL, or DATABASE_URL from .env.local.
 *   Requires THEA_FF_EMBEDDINGS_ENABLED=true and OPENAI_API_KEY set.
 *
 * Behaviour:
 *   Processes rows in batches of 50, with a 100 ms sleep between batches.
 *   Idempotent — rows that already have an embedding are skipped.
 *   Reports: total rows, already embedded, newly embedded, errors, tokens used.
 *
 * Cost estimate at $0.13 / 1M tokens:
 *   ~1000 departments × ~10 tokens/dept → ~0.001 USD (< $0.01)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import dotenv from 'dotenv';
import { embedCoreDepartment } from '../lib/embeddings/writers/coreDepartment';

// ─── Boot ─────────────────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Force the flag on for this script's process (still requires OPENAI_API_KEY)
process.env.THEA_FF_EMBEDDINGS_ENABLED = 'true';

const connectionString =
  process.env.MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌  DATABASE_URL / DIRECT_URL / MIGRATION_URL is not set in .env.local');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌  OPENAI_API_KEY is not set in .env.local');
  process.exit(1);
}

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const tenantArg = argValue(args, '--tenant');
const isDryRun = args.includes('--dry-run');
const BATCH_SIZE = 50;
const BATCH_SLEEP_MS = 100;

// ─── Main ─────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: any = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

type RowId = { id: string };

async function main(): Promise<void> {
  console.log('\n📦  CoreDepartment Embedding Backfill');
  console.log(`    connection : ${redactUrl(connectionString!)}`);
  if (tenantArg) console.log(`    tenantId   : ${tenantArg}`);
  if (isDryRun)  console.log('    mode       : DRY RUN (no writes)');
  console.log('');

  // Count totals
  const totalCount: number = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM core_departments${tenantArg ? ' WHERE tenant_id = $1::uuid' : ''}`,
    ...(tenantArg ? [tenantArg] : []),
  ).then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  const embeddedCount: number = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM core_departments WHERE embedding IS NOT NULL${tenantArg ? ' AND tenant_id = $1::uuid' : ''}`,
    ...(tenantArg ? [tenantArg] : []),
  ).then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  const pendingCount = totalCount - embeddedCount;
  console.log(`  Total rows     : ${totalCount}`);
  console.log(`  Already done   : ${embeddedCount}`);
  console.log(`  To embed       : ${pendingCount}`);
  console.log('');

  if (isDryRun) {
    const estimatedTokens = pendingCount * 10;
    const estimatedCost = (estimatedTokens / 1_000_000) * 0.13;
    console.log(`  Estimated tokens : ~${estimatedTokens}`);
    console.log(`  Estimated cost   : ~$${estimatedCost.toFixed(6)} (@ $0.13/1M tokens)`);
    console.log('\n  DRY RUN — nothing written.\n');
    await prisma.$disconnect();
    return;
  }

  let offset = 0;
  let processed = 0;
  let errors = 0;
  let totalTokens = 0;

  while (offset < pendingCount) {
    const batch: RowId[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM core_departments WHERE embedding IS NULL${tenantArg ? ' AND tenant_id = $1::uuid' : ''} ORDER BY created_at LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
      ...(tenantArg ? [tenantArg] : []),
    );

    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        const outcome = await embedCoreDepartment(row.id, { prismaClient: prisma });
        if (!outcome.skipped) {
          totalTokens += (outcome as { totalTokens: number }).totalTokens;
          processed++;
          if (processed % 10 === 0) {
            process.stdout.write(`\r  Progress: ${processed}/${pendingCount} (${errors} errors)`);
          }
        }
      } catch (err) {
        errors++;
        console.error(`\n  ⚠️  Error on id=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    offset += batch.length;
    if (offset < pendingCount) {
      await sleep(BATCH_SLEEP_MS);
    }
  }

  process.stdout.write('\n');
  console.log('');
  console.log('  ─────────────────────────────────');
  console.log(`  Embedded       : ${processed}`);
  console.log(`  Errors         : ${errors}`);
  console.log(`  Tokens used    : ${totalTokens}`);
  const cost = (totalTokens / 1_000_000) * 0.13;
  console.log(`  Est. cost      : $${cost.toFixed(6)} (@ $0.13/1M tokens)`);
  console.log('  ─────────────────────────────────\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return url.slice(0, 30) + '…';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
