/**
 * CLI Restore Script for Thea EHR
 *
 * Restores a tenant backup created by scripts/backup.ts.
 *
 * Usage:
 *   npx tsx scripts/restore.ts --file=./backups/thea-backup-tenant-2026-03-10.json.gz [--dry-run]
 *
 * Safety:
 *   - Validates backup metadata before restoring
 *   - Supports --dry-run to preview without writing
 *   - Logs all operations
 */

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const dryRun = args.includes('--dry-run');

const filePath = fileArg?.split('=')[1];

if (!filePath) {
  console.error('Usage: npx tsx scripts/restore.ts --file=<backup.json.gz> [--dry-run]');
  process.exit(1);
}

async function main() {
  console.log(`[restore] Reading backup: ${filePath}`);
  if (dryRun) console.log('[restore] DRY RUN — no data will be written');

  // Read and decompress
  const compressed = readFileSync(filePath!);
  const jsonBuffer = gunzipSync(compressed);
  const payload = JSON.parse(jsonBuffer.toString('utf-8'));

  // Validate metadata
  const meta = payload._meta;
  if (!meta?.tenantId || !meta?.exportedAt || !meta?.version) {
    console.error('[restore] Invalid backup file — missing _meta');
    process.exit(1);
  }

  console.log(`[restore] Tenant: ${meta.tenantId}`);
  console.log(`[restore] Exported at: ${meta.exportedAt}`);
  console.log(`[restore] Version: ${meta.version}`);
  console.log(`[restore] Total records: ${meta.totalRecords || 'N/A'}`);
  console.log('[restore] Table counts:');
  for (const [table, count] of Object.entries(meta.counts || {})) {
    console.log(`         ${table}: ${count}`);
  }

  if (dryRun) {
    console.log('\n[restore] DRY RUN complete — no changes made');
    return;
  }

  // Dynamic import to trigger Prisma client
  const { prisma } = await import('../lib/db/prisma');

  const tenantId = meta.tenantId;

  // Restore in dependency order (patients first, then encounters, etc.)
  const restoreOrder = [
    'users',
    'departments',
    'patients',
    'encounterCores',
    'opdEncounters',
    'opdBookings',
    'opdOrders',
    'opdVisitNotes',
    'opdCensus',
    'erEncounters',
    'ipdEpisodes',
    'ordersHub',
    'orderResults',
    'billingChargeCatalog',
    'billingPayments',
    'schedulingResources',
    'schedulingTemplates',
    'clinicalNotes',
    'physicalExams',
    'labResults',
    'clinicalInfraProviders',
    'clinicalInfraBeds',
  ];

  let totalRestored = 0;
  for (const table of restoreOrder) {
    const rows = payload[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    console.log(`[restore] Restoring ${table}: ${rows.length} records...`);
    try {
      // Use createMany with skipDuplicates to avoid conflicts
      const modelName = table.charAt(0).toLowerCase() + table.slice(1);
      const model = (prisma as Record<string, unknown>)[modelName] as Record<string, Function> | undefined;
      if (!model?.createMany) {
        console.warn(`[restore] Skipping ${table} — no Prisma model found`);
        continue;
      }
      await model.createMany({
        data: rows,
        skipDuplicates: true,
      });
      totalRestored += rows.length;
      console.log(`[restore] ✅ ${table}: ${rows.length} records restored`);
    } catch (err: unknown) {
      console.error(`[restore] ⚠️ ${table} failed: ${(err as Error).message}`);
    }
  }

  console.log(`\n[restore] ✅ Restore completed — ${totalRestored} records written`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[restore] Failed:', err);
    process.exit(1);
  });
