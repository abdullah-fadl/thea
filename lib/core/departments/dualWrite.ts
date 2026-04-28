/**
 * lib/core/departments/dualWrite.ts
 *
 * Phase 3.1 — Department dual-write infrastructure.
 *
 * When FF_DEPARTMENT_DUAL_WRITE is ON, every Health/CVision department create
 * additionally writes a corresponding row in core_departments.
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

export interface HealthDepartmentInput {
  tenantId: string;        // UUID
  hospitalId?: string;     // UUID (nullable)
  code: string;
  name: string;
  nameAr?: string;
  legacyHealthDepartmentId: string; // UUID of the newly-inserted Health departments row
  createdBy?: string;
}

export interface CvisionDepartmentInput {
  tenantId: string;
  hospitalId?: string;
  code: string;
  name: string;
  nameAr?: string;
  legacyCvisionDepartmentId: string; // id of the CVision departments row
  createdBy?: string;
}

/**
 * Called after a Health departments row is inserted.
 * Returns the created CoreDepartment row, or undefined when flag is OFF or on error.
 */
export async function createCoreDepartmentFromHealth(
  input: HealthDepartmentInput,
): Promise<{ id: string } | undefined> {
  if (!isEnabled('FF_DEPARTMENT_DUAL_WRITE')) return undefined;

  try {
    const row = await prisma.coreDepartment.create({
      data: {
        tenantId:                  input.tenantId,
        hospitalId:                input.hospitalId ?? null,
        code:                      input.code,
        name:                      input.name,
        nameAr:                    input.nameAr ?? null,
        type:                      'clinical',
        legacyHealthDepartmentId:  input.legacyHealthDepartmentId,
        createdBy:                 input.createdBy ?? null,
        updatedBy:                 input.createdBy ?? null,
      },
      select: { id: true },
    });
    return row;
  } catch (err: unknown) {
    logger.error('[dual_write.department] Failed to write core_departments from Health source', {
      category:  'db.dual_write.department',
      source:    'health',
      tenantId:  input.tenantId,
      code:      input.code,
      legacyId:  input.legacyHealthDepartmentId,
      error:     err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Called after a CVision departments row is inserted.
 * Returns the created (or merged) CoreDepartment row, or undefined when flag is OFF or on error.
 */
export async function createCoreDepartmentFromCvision(
  input: CvisionDepartmentInput,
): Promise<{ id: string } | undefined> {
  if (!isEnabled('FF_DEPARTMENT_DUAL_WRITE')) return undefined;

  try {
    // If a core row for the same (tenantId, code) already exists from the Health side,
    // upgrade it to type='both' and set the CVision back-link.
    const existing = await prisma.coreDepartment.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
      select: { id: true, type: true },
    });

    if (existing) {
      const row = await prisma.coreDepartment.update({
        where: { id: existing.id },
        data: {
          legacyCvisionDepartmentId: input.legacyCvisionDepartmentId,
          type:      'both',
          updatedBy: input.createdBy ?? null,
        },
        select: { id: true },
      });
      logger.info('[dual_write.department] Merged CVision dept into existing Health core row', {
        category:  'db.dual_write.department',
        coreId:    row.id,
        tenantId:  input.tenantId,
        code:      input.code,
      });
      return row;
    }

    const row = await prisma.coreDepartment.create({
      data: {
        tenantId:                   input.tenantId,
        hospitalId:                 input.hospitalId ?? null,
        code:                       input.code,
        name:                       input.name,
        nameAr:                     input.nameAr ?? null,
        type:                       'hr',
        legacyCvisionDepartmentId:  input.legacyCvisionDepartmentId,
        createdBy:                  input.createdBy ?? null,
        updatedBy:                  input.createdBy ?? null,
      },
      select: { id: true },
    });
    return row;
  } catch (err: unknown) {
    logger.error('[dual_write.department] Failed to write core_departments from CVision source', {
      category:  'db.dual_write.department',
      source:    'cvision',
      tenantId:  input.tenantId,
      code:      input.code,
      legacyId:  input.legacyCvisionDepartmentId,
      error:     err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
