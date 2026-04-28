/**
 * Phase 7.3 — Backfill OntologyMapping rows for FormularyDrug → RxNorm.
 *
 * Reads every FormularyDrug row (or those for one --tenant) and runs
 * mapFormularyDrugToRxNorm() against each. Drugs without an rxNorm code are
 * skipped. Concepts not yet in the ontology graph are lazily upserted as
 * stub rows by lib/ontology/lazyUpsert.ts.
 *
 * Usage:
 *   npx tsx scripts/backfill-formulary-drug-ontology.ts [--tenant <uuid>] [--dry-run]
 *
 * Environment:
 *   Reads MIGRATION_URL / DIRECT_URL / DATABASE_URL from .env.local.
 *   Forces THEA_FF_ONTOLOGY_ENABLED=true for this process so the wiring
 *   helpers work even if the environment flag is OFF in production. Operators
 *   should still verify the flag is enabled in deployment before running.
 *
 * Behavior:
 *   - Cursor-paginated SELECT id ORDER BY id, batch 100.
 *   - No external API calls (purely DB), so no rate-limit sleep needed
 *     between batches beyond DB courtesy (50 ms).
 *   - Idempotent: a re-run produces zero new mappings if everything is wired.
 *   - Writes a JSON-line summary at the end.
 *
 * Report shape (final stdout line):
 *   { rows_total, rows_skipped, rows_mapped, rows_concepts_created, errors, elapsed_ms }
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

process.env.THEA_FF_ONTOLOGY_ENABLED = 'true';

const connectionString =
  process.env.MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌  DATABASE_URL / DIRECT_URL / MIGRATION_URL is not set in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const tenantArg = argValue(args, '--tenant');
const isDryRun = args.includes('--dry-run');
const BATCH_SIZE = 100;
const BATCH_SLEEP_MS = 50;

const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma: any = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

interface RowId { id: string }

async function main(): Promise<void> {
  // Late import — after the flag is set above so module-load checks see it on.
  const { mapFormularyDrugToRxNorm } = await import('../lib/ontology/wiring/formularyDrug');
  const t0 = Date.now();

  console.log('\n📦  FormularyDrug → RxNorm Ontology Backfill');
  console.log(`    connection : ${redactUrl(connectionString!)}`);
  if (tenantArg) console.log(`    tenantId   : ${tenantArg}`);
  if (isDryRun) console.log('    mode       : DRY RUN (no writes)');
  console.log('');

  const totalRows: number = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM formulary_drugs${tenantArg ? ' WHERE "tenantId" = $1::uuid' : ''}`,
    ...(tenantArg ? [tenantArg] : []),
  ).then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  const eligibleRows: number = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM formulary_drugs WHERE "rxNorm" IS NOT NULL AND "rxNorm" <> ''${tenantArg ? ' AND "tenantId" = $1::uuid' : ''}`,
    ...(tenantArg ? [tenantArg] : []),
  ).then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  console.log(`  Total drugs       : ${totalRows}`);
  console.log(`  With rxNorm code  : ${eligibleRows}`);
  console.log(`  To wire           : ${eligibleRows}`);
  console.log('');

  if (isDryRun) {
    console.log('  DRY RUN — nothing written.\n');
    process.stdout.write(JSON.stringify({
      event: 'summary',
      rows_total: totalRows,
      rows_skipped: totalRows - eligibleRows,
      rows_mapped: 0,
      rows_concepts_created: 0,
      errors: 0,
      dry_run: true,
      elapsed_ms: Date.now() - t0,
    }) + '\n');
    await prisma.$disconnect();
    return;
  }

  // Snapshot ontology_concepts count to compute lazy-creates.
  const initialConcepts: number = await prisma
    .$queryRawUnsafe(`SELECT COUNT(*) AS count FROM ontology_concepts`)
    .then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  let cursor: string | null = null;
  let processed = 0;
  let mapped = 0;
  let skipped = 0;
  let errors = 0;

  while (true) {
    const params: unknown[] = tenantArg ? [tenantArg] : [];
    const cursorClause = cursor
      ? ` AND id > $${params.length + 1}::uuid`
      : '';
    if (cursor) params.push(cursor);

    const batch: RowId[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM formulary_drugs WHERE "rxNorm" IS NOT NULL AND "rxNorm" <> ''${
        tenantArg ? ' AND "tenantId" = $1::uuid' : ''
      }${cursorClause} ORDER BY id LIMIT ${BATCH_SIZE}`,
      ...params,
    );

    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        const result = await mapFormularyDrugToRxNorm(row.id);
        if (result.skipped) skipped++;
        else mapped++;
        processed++;
        if (processed % 25 === 0) {
          process.stdout.write(`\r  Progress: ${processed}/${eligibleRows} (mapped=${mapped} skipped=${skipped} errors=${errors})`);
        }
      } catch (err) {
        errors++;
        console.error(`\n  ⚠️  Error on id=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    cursor = batch[batch.length - 1].id;
    if (batch.length < BATCH_SIZE) break;
    await sleep(BATCH_SLEEP_MS);
  }

  const finalConcepts: number = await prisma
    .$queryRawUnsafe(`SELECT COUNT(*) AS count FROM ontology_concepts`)
    .then((r: { count: bigint }[]) => Number(r[0]?.count ?? 0));

  process.stdout.write('\n\n');
  process.stdout.write(JSON.stringify({
    event: 'summary',
    rows_total: totalRows,
    rows_skipped: skipped + (totalRows - eligibleRows),
    rows_mapped: mapped,
    rows_concepts_created: Math.max(0, finalConcepts - initialConcepts),
    errors,
    elapsed_ms: Date.now() - t0,
  }) + '\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

function argValue(a: string[], flag: string): string | undefined {
  const i = a.indexOf(flag);
  return i !== -1 ? a[i + 1] : undefined;
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
