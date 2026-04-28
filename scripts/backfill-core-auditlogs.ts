/**
 * scripts/backfill-core-auditlogs.ts
 *
 * Phase 3.4 — Idempotent backfill of core audit_logs from cvision_audit_logs.
 *
 * Usage:
 *   npx tsx scripts/backfill-core-auditlogs.ts
 *
 * Requires DATABASE_URL / DIRECT_URL in .env.local (or environment).
 *
 * Rules:
 * - Safe to re-run: skips rows already mirrored (legacyCvisionAuditLogId check).
 * - Never modifies or deletes any legacy cvision_audit_logs rows.
 * - Cursor-based pagination; batch size 1000; progress logged every 10 batches.
 * - Safe to interrupt; resume next run from where it left off.
 *
 * Report shape:
 *   { rows_new, rows_skipped, batches, elapsed_ms }
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BATCH_SIZE    = 1000;
const LOG_EVERY_N   = 10;

function buildPrisma(): PrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set');
  }
  const adapter = new PrismaPg({ connectionString, max: 3 });
  return new PrismaClient({ adapter });
}

interface Report {
  rows_new:     number;
  rows_skipped: number;
  batches:      number;
  elapsed_ms:   number;
}

async function main(): Promise<void> {
  const prisma  = buildPrisma();
  const startAt = Date.now();

  const report: Report = {
    rows_new:     0,
    rows_skipped: 0,
    batches:      0,
    elapsed_ms:   0,
  };

  console.log('[backfill-auditlogs] Starting idempotent backfill: cvision_audit_logs → audit_logs');

  try {
    let cursor: string | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await prisma.cvisionAuditLog.findMany({
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id:           true,
          tenantId:     true,
          action:       true,
          resourceType: true,
          resourceId:   true,
          actorUserId:  true,
          actorRole:    true,
          actorEmail:   true,
          success:      true,
          errorMessage: true,
          changes:      true,
          ip:           true,
          userAgent:    true,
          metadata:     true,
          createdAt:    true,
        },
      });

      if (batch.length === 0) break;

      report.batches++;
      cursor = batch[batch.length - 1].id;

      for (const row of batch) {
        // Idempotency: skip if already mirrored
        const existing = await prisma.auditLog.findFirst({
          where: { legacyCvisionAuditLogId: row.id },
          select: { id: true },
        });

        if (existing) {
          report.rows_skipped++;
          continue;
        }

        const coreMetadata: Record<string, unknown> = {
          ...(row.metadata as Record<string, unknown> | null ?? {}),
          ...(row.changes  ? { changes: row.changes as Record<string, unknown> } : {}),
          _source: 'cvision_audit_log',
        };

        await prisma.auditLog.create({
          data: {
            tenantId:                row.tenantId,
            actorUserId:             row.actorUserId,
            actorRole:               row.actorRole ?? 'cvision',
            actorEmail:              row.actorEmail ?? null,
            action:                  row.action,
            resourceType:            row.resourceType,
            resourceId:              row.resourceId,
            ip:                      row.ip ?? null,
            userAgent:               row.userAgent ?? null,
            success:                 row.success,
            errorMessage:            row.errorMessage ?? null,
            metadata:                coreMetadata,
            legacyCvisionAuditLogId: row.id,
            timestamp:               row.createdAt,
          },
        });

        report.rows_new++;
      }

      if (report.batches % LOG_EVERY_N === 0) {
        const elapsed = Date.now() - startAt;
        console.log(
          `[backfill-auditlogs] batch=${report.batches} ` +
          `rows_new=${report.rows_new} rows_skipped=${report.rows_skipped} ` +
          `elapsed_ms=${elapsed}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  report.elapsed_ms = Date.now() - startAt;

  console.log('\n[backfill-auditlogs] ── Final Report ────────────────────────────');
  console.log(`  rows_new:     ${report.rows_new}`);
  console.log(`  rows_skipped: ${report.rows_skipped}`);
  console.log(`  batches:      ${report.batches}`);
  console.log(`  elapsed_ms:   ${report.elapsed_ms}`);
  console.log('[backfill-auditlogs] ────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('[backfill-auditlogs] Fatal error:', err);
  process.exit(1);
});
