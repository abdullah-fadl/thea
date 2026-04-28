/**
 * lib/core/units/shadowRead.ts
 *
 * Phase 3.2 — Unit shadow-read infrastructure.
 *
 * When FF_UNIT_UNIFIED_READ_SHADOW is ON, after a legacy unit read the caller
 * fires compareLegacyToCore() to compare the legacy row against the matching
 * core_units row, then logs the result.
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

export interface LegacyClinicalInfraUnitRow {
  id:        string;  // UUID — used as legacyClinicalInfraUnitId
  tenantId:  string;  // UUID
  code:      string;  // derived from shortCode
  name:      string;
  nameAr?:   string | null;
}

export interface LegacyCvisionUnitRow {
  id:        string;  // used as legacyCvisionUnitId
  tenantId:  string;
  code:      string;
  name:      string;
  nameAr?:   string | null;
}

// Fields compared between legacy and core rows
const COMPARE_FIELDS = ['code', 'name', 'nameAr'] as const;

type ShadowResult =
  | { outcome: 'match' }
  | { outcome: 'diff_fields'; diff_fields: string[] }
  | { outcome: 'missing_in_core' }
  | { outcome: 'skipped' }; // flag is OFF

/**
 * Compare a ClinicalInfraUnit legacy row against core_units.
 * Call AFTER the legacy read returns, before the response is sent.
 * Fire-and-forget: `void compareLegacyClinicalInfraToCore(...).catch(() => {})`.
 */
export async function compareLegacyClinicalInfraToCore(
  legacyRow: LegacyClinicalInfraUnitRow,
): Promise<ShadowResult> {
  if (!isEnabled('FF_UNIT_UNIFIED_READ_SHADOW')) return { outcome: 'skipped' };

  try {
    const coreRow = await prisma.coreUnit.findFirst({
      where: { legacyClinicalInfraUnitId: legacyRow.id },
      select: { code: true, name: true, nameAr: true },
    });

    if (!coreRow) {
      logger.info('[shadow_read.unit] missing_in_core', {
        category:  'db.shadow_read.unit',
        source:    'clinical_infra',
        legacyId:  legacyRow.id,
        tenantId:  legacyRow.tenantId,
        code:      legacyRow.code,
      });
      return { outcome: 'missing_in_core' };
    }

    const diffFields: string[] = [];
    for (const field of COMPARE_FIELDS) {
      const legacyVal = legacyRow[field] ?? null;
      const coreVal   = (coreRow as Record<string, unknown>)[field] ?? null;
      if (legacyVal !== coreVal) diffFields.push(field);
    }

    if (diffFields.length === 0) {
      logger.info('[shadow_read.unit] match', {
        category: 'db.shadow_read.unit',
        source:   'clinical_infra',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
      });
      return { outcome: 'match' };
    }

    logger.warn('[shadow_read.unit] diff_fields', {
      category:    'db.shadow_read.unit',
      source:      'clinical_infra',
      legacyId:    legacyRow.id,
      tenantId:    legacyRow.tenantId,
      diff_fields: diffFields,
    });
    return { outcome: 'diff_fields', diff_fields: diffFields };
  } catch (err: unknown) {
    logger.error('[shadow_read.unit] error during shadow compare (clinical_infra)', {
      category: 'db.shadow_read.unit',
      source:   'clinical_infra',
      legacyId: legacyRow.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'skipped' };
  }
}

/**
 * Compare a CvisionUnit legacy row against core_units.
 * Call AFTER the legacy read returns, before the response is sent.
 * Fire-and-forget: `void compareLegacyCvisionToCore(...).catch(() => {})`.
 */
export async function compareLegacyCvisionToCore(
  legacyRow: LegacyCvisionUnitRow,
): Promise<ShadowResult> {
  if (!isEnabled('FF_UNIT_UNIFIED_READ_SHADOW')) return { outcome: 'skipped' };

  try {
    const coreRow = await prisma.coreUnit.findFirst({
      where: { legacyCvisionUnitId: legacyRow.id },
      select: { code: true, name: true, nameAr: true },
    });

    if (!coreRow) {
      logger.info('[shadow_read.unit] missing_in_core', {
        category: 'db.shadow_read.unit',
        source:   'cvision',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
        code:     legacyRow.code,
      });
      return { outcome: 'missing_in_core' };
    }

    const diffFields: string[] = [];
    for (const field of COMPARE_FIELDS) {
      const legacyVal = legacyRow[field] ?? null;
      const coreVal   = (coreRow as Record<string, unknown>)[field] ?? null;
      if (legacyVal !== coreVal) diffFields.push(field);
    }

    if (diffFields.length === 0) {
      logger.info('[shadow_read.unit] match', {
        category: 'db.shadow_read.unit',
        source:   'cvision',
        legacyId: legacyRow.id,
        tenantId: legacyRow.tenantId,
      });
      return { outcome: 'match' };
    }

    logger.warn('[shadow_read.unit] diff_fields', {
      category:    'db.shadow_read.unit',
      source:      'cvision',
      legacyId:    legacyRow.id,
      tenantId:    legacyRow.tenantId,
      diff_fields: diffFields,
    });
    return { outcome: 'diff_fields', diff_fields: diffFields };
  } catch (err: unknown) {
    logger.error('[shadow_read.unit] error during shadow compare (cvision)', {
      category: 'db.shadow_read.unit',
      source:   'cvision',
      legacyId: legacyRow.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'skipped' };
  }
}
