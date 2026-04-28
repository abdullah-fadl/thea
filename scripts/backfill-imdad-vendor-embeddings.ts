/**
 * Backfill embeddings for ImdadVendor rows that have "embeddingVec" = NULL.
 *
 * Usage:
 *   npx tsx scripts/backfill-imdad-vendor-embeddings.ts [--tenant <uuid>] [--dry-run]
 *
 * Options:
 *   --tenant   Limit backfill to a single tenantId UUID.
 *   --dry-run  Print counts + cost estimate without calling OpenAI or writing.
 *
 * Environment:
 *   Reads MIGRATION_URL, DIRECT_URL, or DATABASE_URL from .env.local.
 *   Requires THEA_FF_EMBEDDINGS_ENABLED=true and OPENAI_API_KEY set.
 *
 * Behaviour:
 *   Cursor-paginated by createdAt; batch size 25 per OpenAI call; 200 ms sleep
 *   between batches. Idempotent — rows where "embeddingVec" IS NOT NULL are
 *   skipped. Safe to interrupt and resume.
 *
 * Cost estimate at $0.13 / 1M tokens (text-embedding-3-large @ 1536 dims):
 *   ~5,000 vendors × ~20 tokens/vendor → ~100k tokens → ~$0.013 total.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import dotenv from 'dotenv';
import { embedImdadVendor } from '../lib/embeddings/writers/imdadVendor';

// ─── Boot ─────────────────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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
const BATCH_SIZE = 25;
const BATCH_SLEEP_MS = 200;

// ─── Main ─────────────────────────────────────────────────────────────────────

const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: any = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

type RowId = { id: string };

async function main(): Promise<void> {
  const startedAt = Date.now();

  console.log('\n📦  ImdadVendor Embedding Backfill (Phase 7.2)');
  console.log(`    connection : ${redactUrl(connectionString!)}`);
  if (tenantArg) console.log(`    tenantId   : ${tenantArg}`);
  if (isDryRun)  console.log('    mode       : DRY RUN (no writes)');
  console.log('');

  const totalCount: number = await prisma
    .$queryRawUnsafe(
      `SELECT COUNT(*) AS count FROM "imdad_vendors" WHERE "isDeleted" = false${tenantArg ? ' AND "tenantId" = $1::uuid' : ''}`,
      ...(tenantArg ? [tenantArg] : []),
    )
    .then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  const embeddedCount: number = await prisma
    .$queryRawUnsafe(
      `SELECT COUNT(*) AS count FROM "imdad_vendors" WHERE "embeddingVec" IS NOT NULL AND "isDeleted" = false${tenantArg ? ' AND "tenantId" = $1::uuid' : ''}`,
      ...(tenantArg ? [tenantArg] : []),
    )
    .then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  const pendingCount = totalCount - embeddedCount;
  console.log(`  Total rows     : ${totalCount}`);
  console.log(`  Already done   : ${embeddedCount}`);
  console.log(`  To embed       : ${pendingCount}`);
  console.log('');

  if (isDryRun) {
    const estimatedTokens = pendingCount * 20; // ~20 tokens / vendor avg
    const estimatedCost = (estimatedTokens / 1_000_000) * 0.13;
    console.log(`  Estimated tokens : ~${estimatedTokens}`);
    console.log(`  Estimated cost   : ~$${estimatedCost.toFixed(4)} (@ $0.13/1M tokens)`);
    console.log('\n  DRY RUN — nothing written.\n');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let apiCalls = 0;
  let totalTokens = 0;

  while (true) {
    const batch: RowId[] = await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "imdad_vendors"
       WHERE "embeddingVec" IS NULL AND "isDeleted" = false${tenantArg ? ' AND "tenantId" = $1::uuid' : ''}
       ORDER BY "createdAt"
       LIMIT ${BATCH_SIZE}`,
      ...(tenantArg ? [tenantArg] : []),
    );

    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        const outcome = await embedImdadVendor(row.id, { prismaClient: prisma });
        if (outcome.skipped) {
          skipped++;
        } else {
          totalTokens += (outcome as { totalTokens: number }).totalTokens;
          apiCalls++;
          processed++;
          if (processed % 25 === 0) {
            process.stdout.write(`\r  Progress: ${processed}/${pendingCount} (${errors} errors, ${skipped} skipped)`);
          }
        }
      } catch (err) {
        errors++;
        console.error(`\n  ⚠️  Error on id=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await sleep(BATCH_SLEEP_MS);
  }

  process.stdout.write('\n');
  const elapsedMs = Date.now() - startedAt;
  const cost = (totalTokens / 1_000_000) * 0.13;

  console.log('');
  console.log('  ─────────────────────────────────');
  console.log(`  rows_total      : ${totalCount}`);
  console.log(`  rows_skipped    : ${embeddedCount + skipped}`);
  console.log(`  rows_embedded   : ${processed}`);
  console.log(`  api_calls       : ${apiCalls}`);
  console.log(`  total_tokens    : ${totalTokens}`);
  console.log(`  estimated_cost  : $${cost.toFixed(6)} (@ $0.13/1M tokens)`);
  console.log(`  elapsed_ms      : ${elapsedMs}`);
  console.log(`  errors          : ${errors}`);
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
