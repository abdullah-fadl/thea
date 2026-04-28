/**
 * lib/core/audit/shadowRead.ts
 *
 * Phase 3.4 — AuditLog shadow-read infrastructure.
 *
 * When FF_AUDITLOG_UNIFIED_READ_SHADOW is ON, after a CVision audit-log read
 * callers fire compareCvisionAuditLogToCore() to compare the legacy row against
 * the matching core audit_logs row, then log the result.
 *
 * Rules (non-negotiable):
 * - Never returns shadow data to the caller.
 * - Never throws — all errors are caught and logged.
 * - Never fails the request — fire-and-forget.
 * - When flag is OFF: returns 'skipped' immediately, zero DB calls.
 */

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';

export type ShadowResult = 'match' | 'diff_fields' | 'missing_in_core' | 'skipped';

export interface CvisionAuditLogReadRow {
  id: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorUserId: string;
  success: boolean;
}

const COMPARE_FIELDS = [
  'action',
  'resourceType',
  'resourceId',
  'actorUserId',
  'success',
] as const;

/**
 * Compare a CVision audit-log row against the core AuditLog table.
 * Look up core row via legacyCvisionAuditLogId.
 * Returns 'skipped' when flag is OFF (no DB call made).
 *
 * Fire-and-forget usage:
 *   void compareCvisionAuditLogToCore(row).catch(() => {});
 *
 * Log shape:
 *   { category: 'db.shadow_read.auditlog', outcome, legacyId, tenantId, [diff_fields?] }
 */
export async function compareCvisionAuditLogToCore(
  legacyRow: CvisionAuditLogReadRow,
): Promise<ShadowResult> {
  if (!isEnabled('FF_AUDITLOG_UNIFIED_READ_SHADOW')) return 'skipped';

  try {
    const coreRow = await prisma.auditLog.findFirst({
      where: { legacyCvisionAuditLogId: legacyRow.id },
      select: {
        action:       true,
        resourceType: true,
        resourceId:   true,
        actorUserId:  true,
        success:      true,
      },
    });

    if (!coreRow) {
      logger.info('[shadow_read.auditlog] missing_in_core', {
        category: 'db.shadow_read.auditlog',
        outcome:  'missing_in_core',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
      });
      return 'missing_in_core';
    }

    const diffFields: string[] = [];
    for (const field of COMPARE_FIELDS) {
      const legacyVal = (legacyRow as Record<string, unknown>)[field] ?? null;
      const coreVal   = (coreRow   as Record<string, unknown>)[field] ?? null;
      if (legacyVal !== coreVal) diffFields.push(field);
    }

    if (diffFields.length === 0) {
      logger.info('[shadow_read.auditlog] match', {
        category: 'db.shadow_read.auditlog',
        outcome:  'match',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
      });
      return 'match';
    }

    logger.warn('[shadow_read.auditlog] diff_fields', {
      category:    'db.shadow_read.auditlog',
      outcome:     'diff_fields',
      legacyId:    legacyRow.id,
      tenantId:    legacyRow.tenantId,
      diff_fields: diffFields,
    });
    return 'diff_fields';
  } catch (err: unknown) {
    logger.error('[shadow_read.auditlog] error during shadow compare', {
      category: 'db.shadow_read.auditlog',
      legacyId: legacyRow.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return 'skipped';
  }
}
