/**
 * lib/core/departments/shadowRead.ts
 *
 * Phase 3.1 — Department shadow-read infrastructure.
 *
 * When FF_DEPARTMENT_UNIFIED_READ_SHADOW is ON, after a legacy department read
 * the caller fires compareLegacyToCore() to compare the legacy row against the
 * matching core_departments row, then logs the result.
 *
 * Rules (non-negotiable):
 * - Never returns shadow data to the caller.
 * - Never throws — all errors are caught and logged.
 * - Never fails the request — fire-and-forget.
 * - When flag is OFF: no-op, resolves immediately.
 */

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';

export interface LegacyHealthDepartmentRow {
  id:      string;  // UUID — used as legacyHealthDepartmentId
  tenantId: string; // UUID
  code:    string;
  name:    string;
  nameAr?: string | null;
  type?:   string | null;
}

export interface LegacyCvisionDepartmentRow {
  id:      string;  // used as legacyCvisionDepartmentId
  tenantId: string;
  code:    string;
  name:    string;
  nameAr?: string | null;
}

// Fields compared between legacy and core rows
const HEALTH_COMPARE_FIELDS = ['code', 'name', 'nameAr'] as const;
const CVISION_COMPARE_FIELDS = ['code', 'name', 'nameAr'] as const;

type ShadowResult =
  | { outcome: 'match' }
  | { outcome: 'diff_fields'; diff_fields: string[] }
  | { outcome: 'missing_in_core' }
  | { outcome: 'skipped' }; // flag is OFF

/**
 * Compare a Health (clinical) legacy department row against core_departments.
 * Call AFTER the legacy read returns, before the response is sent.
 * Fire-and-forget: `void compareLegacyHealthToCore(...).catch(() => {})`.
 */
export async function compareLegacyHealthToCore(
  legacyRow: LegacyHealthDepartmentRow,
): Promise<ShadowResult> {
  if (!isEnabled('FF_DEPARTMENT_UNIFIED_READ_SHADOW')) return { outcome: 'skipped' };

  try {
    const coreRow = await prisma.coreDepartment.findFirst({
      where: { legacyHealthDepartmentId: legacyRow.id },
      select: { code: true, name: true, nameAr: true },
    });

    if (!coreRow) {
      logger.info('[shadow_read.department] missing_in_core', {
        category:  'db.shadow_read.department',
        source:    'health',
        legacyId:  legacyRow.id,
        tenantId:  legacyRow.tenantId,
        code:      legacyRow.code,
      });
      return { outcome: 'missing_in_core' };
    }

    const diffFields: string[] = [];
    for (const field of HEALTH_COMPARE_FIELDS) {
      const legacyVal = legacyRow[field] ?? null;
      const coreVal   = (coreRow as Record<string, unknown>)[field] ?? null;
      if (legacyVal !== coreVal) diffFields.push(field);
    }

    if (diffFields.length === 0) {
      logger.info('[shadow_read.department] match', {
        category: 'db.shadow_read.department',
        source:   'health',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
      });
      return { outcome: 'match' };
    }

    logger.warn('[shadow_read.department] diff_fields', {
      category:    'db.shadow_read.department',
      source:      'health',
      legacyId:    legacyRow.id,
      tenantId:    legacyRow.tenantId,
      diff_fields: diffFields,
    });
    return { outcome: 'diff_fields', diff_fields: diffFields };
  } catch (err: unknown) {
    logger.error('[shadow_read.department] error during shadow compare (health)', {
      category: 'db.shadow_read.department',
      source:   'health',
      legacyId: legacyRow.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'skipped' };
  }
}

/**
 * Compare a CVision legacy department row against core_departments.
 * Call AFTER the legacy read returns, before the response is sent.
 * Fire-and-forget: `void compareLegacyCvisionToCore(...).catch(() => {})`.
 */
export async function compareLegacyCvisionToCore(
  legacyRow: LegacyCvisionDepartmentRow,
): Promise<ShadowResult> {
  if (!isEnabled('FF_DEPARTMENT_UNIFIED_READ_SHADOW')) return { outcome: 'skipped' };

  try {
    const coreRow = await prisma.coreDepartment.findFirst({
      where: { legacyCvisionDepartmentId: legacyRow.id },
      select: { code: true, name: true, nameAr: true },
    });

    if (!coreRow) {
      logger.info('[shadow_read.department] missing_in_core', {
        category: 'db.shadow_read.department',
        source:   'cvision',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
        code:     legacyRow.code,
      });
      return { outcome: 'missing_in_core' };
    }

    const diffFields: string[] = [];
    for (const field of CVISION_COMPARE_FIELDS) {
      const legacyVal = legacyRow[field] ?? null;
      const coreVal   = (coreRow as Record<string, unknown>)[field] ?? null;
      if (legacyVal !== coreVal) diffFields.push(field);
    }

    if (diffFields.length === 0) {
      logger.info('[shadow_read.department] match', {
        category: 'db.shadow_read.department',
        source:   'cvision',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
      });
      return { outcome: 'match' };
    }

    logger.warn('[shadow_read.department] diff_fields', {
      category:    'db.shadow_read.department',
      source:      'cvision',
      legacyId:    legacyRow.id,
      tenantId:    legacyRow.tenantId,
      diff_fields: diffFields,
    });
    return { outcome: 'diff_fields', diff_fields: diffFields };
  } catch (err: unknown) {
    logger.error('[shadow_read.department] error during shadow compare (cvision)', {
      category: 'db.shadow_read.department',
      source:   'cvision',
      legacyId: legacyRow.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'skipped' };
  }
}
