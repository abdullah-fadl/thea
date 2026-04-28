/**
 * Audit Data Retention Policy
 *
 * Enforces data retention by removing audit log entries older than the
 * configured retention period. Healthcare regulations (HIPAA, JCI, CBAHI)
 * typically require 7-year minimum retention.
 *
 * Usage:
 *   const result = await enforceAuditRetention(tenantId, { retentionDays: 2555 });
 *   console.log(`Deleted ${result.deleted} audit records before ${result.cutoffDate}`);
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Default: 7 years = 2555 days
// ---------------------------------------------------------------------------

const DEFAULT_RETENTION_DAYS = 2555;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetentionOptions {
  /** Number of days to retain. Default: 2555 (≈7 years). */
  retentionDays?: number;
  /** If true, returns count without deleting. Default: false. */
  dryRun?: boolean;
  /** Maximum records to delete in one batch. Default: 10000. */
  batchSize?: number;
}

export interface RetentionResult {
  deleted: number;
  cutoffDate: Date;
  dryRun: boolean;
  durationMs: number;
}

export interface RetentionStats {
  totalRecords: number;
  oldestRecord: Date | null;
  newestRecord: Date | null;
  recordsToDelete: number;
  retentionDays: number;
  cutoffDate: Date;
}

// ---------------------------------------------------------------------------
// Enforce retention
// ---------------------------------------------------------------------------

/**
 * Delete audit log entries older than the retention period.
 * Uses batched deletes to avoid long-running transactions.
 */
export async function enforceAuditRetention(
  tenantId: string,
  options?: RetentionOptions,
): Promise<RetentionResult> {
  const retentionDays = options?.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const dryRun = options?.dryRun ?? false;
  const batchSize = options?.batchSize ?? 10000;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const startTime = Date.now();

  if (dryRun) {
    const count = await prisma.auditLog.count({
      where: {
        tenantId,
        timestamp: { lt: cutoffDate },
      },
    });
    return {
      deleted: count,
      cutoffDate,
      dryRun: true,
      durationMs: Date.now() - startTime,
    };
  }

  // Batched deletion to avoid locking the table for too long
  let totalDeleted = 0;
  let deletedInBatch = 0;

  do {
    // Find IDs to delete in this batch
    const toDelete = await prisma.auditLog.findMany({
      where: {
        tenantId,
        timestamp: { lt: cutoffDate },
      },
      select: { id: true },
      take: batchSize,
    });

    if (toDelete.length === 0) break;

    const result = await prisma.auditLog.deleteMany({
      where: {
        id: { in: toDelete.map((r) => r.id) },
      },
    });

    deletedInBatch = result.count;
    totalDeleted += deletedInBatch;
  } while (deletedInBatch >= batchSize);

  logger.info('Audit retention enforced', {
    category: 'admin',
    tenantId,
    deleted: totalDeleted,
    cutoffDate: cutoffDate.toISOString(),
    retentionDays,
  });

  return {
    deleted: totalDeleted,
    cutoffDate,
    dryRun: false,
    durationMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Retention stats
// ---------------------------------------------------------------------------

/**
 * Get retention statistics for a tenant's audit logs.
 */
export async function getRetentionStats(
  tenantId: string,
  retentionDays: number = DEFAULT_RETENTION_DAYS,
): Promise<RetentionStats> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const [totalRecords, recordsToDelete, oldest, newest] = await Promise.all([
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId, timestamp: { lt: cutoffDate } } }),
    prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    }),
    prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
  ]);

  return {
    totalRecords,
    oldestRecord: oldest?.timestamp ?? null,
    newestRecord: newest?.timestamp ?? null,
    recordsToDelete,
    retentionDays,
    cutoffDate,
  };
}
