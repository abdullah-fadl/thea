/**
 * CLI Backup Script for Thea EHR
 *
 * Usage:
 *   npx tsx scripts/backup.ts --tenant=<tenantId> [--output=./backups/]
 *
 * Can be scheduled via cron:
 *   0 2 * * * cd /app && npx tsx scripts/backup.ts --tenant=my-tenant --output=/backups/
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Parse CLI arguments
const args = process.argv.slice(2);
const tenantArg = args.find((a) => a.startsWith('--tenant='));
const outputArg = args.find((a) => a.startsWith('--output='));

const tenantId = tenantArg?.split('=')[1];
const outputDir = outputArg?.split('=')[1] || './backups';

if (!tenantId) {
  console.error('Usage: npx tsx scripts/backup.ts --tenant=<tenantId> [--output=./backups/]');
  process.exit(1);
}

async function main() {
  console.log(`[backup] Starting backup for tenant: ${tenantId}`);
  console.log(`[backup] Output directory: ${outputDir}`);

  // Dynamic import to trigger Prisma client initialisation
  const { exportTenantData } = await import('../lib/backup/export');

  const start = Date.now();
  const result = await exportTenantData(tenantId!);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const filename = `thea-backup-${tenantId}-${result.exportedAt.slice(0, 10)}.json.gz`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, result.data);

  const durationSec = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[backup] ✅ Export completed in ${durationSec}s`);
  console.log(`[backup] File: ${filepath}`);
  console.log(`[backup] Size: ${(result.sizeBytes / 1024).toFixed(1)} KB → ${(result.compressedSizeBytes / 1024).toFixed(1)} KB (gzip)`);
  console.log(`[backup] Records:`);
  for (const [table, count] of Object.entries(result.counts)) {
    console.log(`         ${table}: ${count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backup] ❌ Export failed:', err);
    process.exit(1);
  });
