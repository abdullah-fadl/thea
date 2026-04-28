/**
 * lib/core/units/dualWrite.ts
 *
 * Phase 3.2 — Unit dual-write infrastructure.
 *
 * When FF_UNIT_DUAL_WRITE is ON, every ClinicalInfraUnit / CvisionUnit create
 * additionally writes a corresponding row in core_units.
 *
 * Rules (non-negotiable):
 * - Callers invoke AFTER the legacy insert succeeds.
 * - NOT in a transaction — core write failure must NOT roll back the legacy write.
 * - On failure: log and swallow; legacy write remains source of truth.
 * - When flag is OFF: no-op, returns undefined immediately.
 */

import { prisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';

export interface ClinicalInfraUnitInput {
  tenantId:                  string; // UUID
  hospitalId?:               string; // UUID (nullable)
  departmentId?:             string; // UUID (nullable FK → core_departments)
  code:                      string; // derived from ClinicalInfraUnit.shortCode
  name:                      string;
  legacyClinicalInfraUnitId: string; // UUID of the newly-inserted ClinicalInfraUnit row
  createdBy?:                string;
}

export interface CvisionUnitInput {
  tenantId:             string;
  hospitalId?:          string;
  departmentId?:        string; // UUID (nullable FK → core_departments)
  code:                 string;
  name:                 string;
  nameAr?:              string;
  legacyCvisionUnitId:  string; // id of the CvisionUnit row
  createdBy?:           string;
}

/**
 * Called after a ClinicalInfraUnit row is inserted.
 * Returns the created CoreUnit row, or undefined when flag is OFF or on error.
 */
export async function createCoreUnitFromClinicalInfra(
  input: ClinicalInfraUnitInput,
): Promise<{ id: string } | undefined> {
  if (!isEnabled('FF_UNIT_DUAL_WRITE')) return undefined;

  try {
    const row = await prisma.coreUnit.create({
      data: {
        tenantId:                  input.tenantId,
        hospitalId:                input.hospitalId ?? null,
        departmentId:              input.departmentId ?? null,
        code:                      input.code,
        name:                      input.name,
        type:                      'clinical',
        legacyClinicalInfraUnitId: input.legacyClinicalInfraUnitId,
        createdBy:                 input.createdBy ?? null,
        updatedBy:                 input.createdBy ?? null,
      },
      select: { id: true },
    });
    return row;
  } catch (err: unknown) {
    logger.error('[dual_write.unit] Failed to write core_units from ClinicalInfra source', {
      category:  'db.dual_write.unit',
      source:    'clinical_infra',
      tenantId:  input.tenantId,
      code:      input.code,
      legacyId:  input.legacyClinicalInfraUnitId,
      error:     err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Called after a CvisionUnit row is inserted.
 * Returns the created (or merged) CoreUnit row, or undefined when flag is OFF or on error.
 */
export async function createCoreUnitFromCvision(
  input: CvisionUnitInput,
): Promise<{ id: string } | undefined> {
  if (!isEnabled('FF_UNIT_DUAL_WRITE')) return undefined;

  try {
    // If a core row for the same (tenantId, code) already exists from the ClinicalInfra side,
    // upgrade it to type='both' and set the CVision back-link.
    const existing = await prisma.coreUnit.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
      select: { id: true, type: true },
    });

    if (existing) {
      const row = await prisma.coreUnit.update({
        where: { id: existing.id },
        data: {
          legacyCvisionUnitId: input.legacyCvisionUnitId,
          nameAr:              input.nameAr ?? null,
          type:                'both',
          updatedBy:           input.createdBy ?? null,
        },
        select: { id: true },
      });
      logger.info('[dual_write.unit] Merged CVision unit into existing ClinicalInfra core row', {
        category:  'db.dual_write.unit',
        coreId:    row.id,
        tenantId:  input.tenantId,
        code:      input.code,
      });
      return row;
    }

    const row = await prisma.coreUnit.create({
      data: {
        tenantId:            input.tenantId,
        hospitalId:          input.hospitalId ?? null,
        departmentId:        input.departmentId ?? null,
        code:                input.code,
        name:                input.name,
        nameAr:              input.nameAr ?? null,
        type:                'hr',
        legacyCvisionUnitId: input.legacyCvisionUnitId,
        createdBy:           input.createdBy ?? null,
        updatedBy:           input.createdBy ?? null,
      },
      select: { id: true },
    });
    return row;
  } catch (err: unknown) {
    logger.error('[dual_write.unit] Failed to write core_units from CVision source', {
      category:  'db.dual_write.unit',
      source:    'cvision',
      tenantId:  input.tenantId,
      code:      input.code,
      legacyId:  input.legacyCvisionUnitId,
      error:     err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
