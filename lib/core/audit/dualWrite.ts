/**
 * lib/core/audit/dualWrite.ts
 *
 * Phase 3.4 — AuditLog dual-write infrastructure.
 *
 * When FF_AUDITLOG_DUAL_WRITE is ON, every CVision audit-log write additionally
 * mirrors the row into core audit_logs via Prisma.
 *
 * Rules (non-negotiable):
 * - Call AFTER the legacy insert succeeds.
 * - NOT in a transaction — core write failure must NOT roll back the legacy write.
 * - On failure: log and swallow; legacy write remains source of truth.
 * - When flag is OFF: no-op, returns undefined immediately (zero DB calls).
 */

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';

export interface CvisionAuditLogRow {
  id: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorUserId: string;
  actorRole?: string | null;
  actorEmail?: string | null;
  success: boolean;
  errorMessage?: string | null;
  changes?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Mirror a CvisionAuditLog row into the core AuditLog table.
 * Call after the CVision legacy write succeeds.
 * Returns the created AuditLog row id, or undefined when flag is OFF or on error.
 *
 * CVision-specific fields are mapped as follows:
 *   - changes         → metadata.changes
 *   - createdAt       → timestamp
 *   - actorRole null  → 'cvision' (core field is non-nullable)
 */
export async function mirrorCvisionAuditLogToCore(
  row: CvisionAuditLogRow,
): Promise<{ id: string } | undefined> {
  if (!isEnabled('FF_AUDITLOG_DUAL_WRITE')) return undefined;

  try {
    const coreMetadata: Record<string, unknown> = {
      ...(row.metadata ?? {}),
      ...(row.changes ? { changes: row.changes } : {}),
      _source: 'cvision_audit_log',
    };

    const coreRow = await prisma.auditLog.create({
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
      select: { id: true },
    });

    return coreRow;
  } catch (err: unknown) {
    logger.error('[dual_write.auditlog] Failed to mirror CvisionAuditLog to core', {
      category: 'db.dual_write.auditlog',
      legacyId: row.id,
      tenantId: row.tenantId,
      action:   row.action,
      error:    err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
