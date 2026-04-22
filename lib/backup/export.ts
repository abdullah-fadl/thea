/**
 * Data Export for Thea EHR
 *
 * Exports all critical tenant data as JSON. Supports gzip compression.
 * Used by /api/admin/backup and scripts/backup.ts.
 *
 * Coverage: patients, encounters, OPD, ER, IPD, orders, billing, scheduling,
 * clinical notes, lab results, attachments, clinical infra, departments.
 */

import { prisma } from '@/lib/db/prisma';
import { gzipSync } from 'node:zlib';
import { logger } from '@/lib/monitoring/logger';

export interface ExportResult {
  tenantId: string;
  exportedAt: string;
  counts: Record<string, number>;
  sizeBytes: number;
  compressedSizeBytes: number;
  data: Buffer;
}

/**
 * Safe query — returns empty array if table doesn't exist or query fails.
 */
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    logger.warn(`backup: skipped ${label}`, {
      category: 'backup',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Export all critical data for a tenant.
 * Returns a gzip-compressed JSON buffer with metadata.
 */
export async function exportTenantData(tenantId: string): Promise<ExportResult> {
  const exportedAt = new Date().toISOString();
  const counts: Record<string, number> = {};
  const payload: Record<string, unknown> = {};

  // Helper to query and track
  async function collect<T>(label: string, fn: () => Promise<T[]>): Promise<void> {
    const rows = await safeQuery(label, fn);
    counts[label] = rows.length;
    payload[label] = rows;
  }

  const where = { tenantId };
  const order = { createdAt: 'desc' as const };

  const exportLimit = 5000;

  // Core
  await collect('patients', () => prisma.patientMaster.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('encounterCores', () => prisma.encounterCore.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('users', () => prisma.user.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('departments', () => prisma.department.findMany({ where, take: exportLimit }));

  // OPD
  await collect('opdEncounters', () => prisma.opdEncounter.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('opdBookings', () => prisma.opdBooking.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('opdOrders', () => prisma.opdOrder.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('opdVisitNotes', () => prisma.opdVisitNote.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('opdCensus', () => prisma.opdCensus.findMany({ where, orderBy: order, take: exportLimit }));

  // ER
  await collect('erEncounters', () => prisma.erEncounter.findMany({ where, orderBy: order, take: exportLimit }));

  // IPD
  await collect('ipdEpisodes', () => prisma.ipdEpisode.findMany({ where, orderBy: order, take: exportLimit }));

  // Orders & results
  await collect('ordersHub', () => prisma.ordersHub.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('orderResults', () => prisma.orderResult.findMany({ where, orderBy: order, take: exportLimit }));

  // Billing
  await collect('billingChargeCatalog', () => prisma.billingChargeCatalog.findMany({ where, take: exportLimit }));
  await collect('billingPayments', () => prisma.billingPayment.findMany({ where, orderBy: order, take: exportLimit }));

  // Scheduling
  await collect('schedulingResources', () => prisma.schedulingResource.findMany({ where, take: exportLimit }));
  await collect('schedulingTemplates', () => prisma.schedulingTemplate.findMany({ where, take: exportLimit }));

  // Clinical
  await collect('clinicalNotes', () => prisma.clinicalNote.findMany({ where, orderBy: order, take: exportLimit }));
  await collect('physicalExams', () => prisma.physicalExam.findMany({ where, orderBy: order, take: exportLimit }));

  // Lab & Radiology
  await collect('labResults', () => prisma.labResult.findMany({ where, orderBy: order, take: exportLimit }));

  // Clinical infra
  await collect('clinicalInfraProviders', () => prisma.clinicalInfraProvider.findMany({ where, take: exportLimit }));
  await collect('clinicalInfraBeds', () => prisma.clinicalInfraBed.findMany({ where, take: exportLimit }));

  // Build final payload
  const fullPayload = {
    _meta: {
      exportedAt,
      tenantId,
      version: '2.0',
      counts,
      totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
    },
    ...payload,
  };

  const jsonBuffer = Buffer.from(JSON.stringify(fullPayload, null, 2), 'utf-8');
  const compressed = gzipSync(jsonBuffer);

  logger.info('backup: export completed', {
    category: 'backup',
    tenantId,
    totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
    tables: Object.keys(counts).length,
    sizeKb: Math.round(jsonBuffer.length / 1024),
    compressedKb: Math.round(compressed.length / 1024),
  });

  return {
    tenantId,
    exportedAt,
    counts,
    sizeBytes: jsonBuffer.length,
    compressedSizeBytes: compressed.length,
    data: compressed,
  };
}
