/**
 * Phase 3.2 — dualWrite.ts tests
 *
 * Cases:
 *  1. FF_UNIT_DUAL_WRITE OFF  → no-op, undefined returned, no DB call
 *  2. FF_UNIT_DUAL_WRITE ON   → createCoreUnitFromClinicalInfra creates core row (type=clinical)
 *  3. FF_UNIT_DUAL_WRITE ON   → createCoreUnitFromCvision creates core row (type=hr)
 *  4. FF_UNIT_DUAL_WRITE ON   + core insert throws → error logged, caller gets undefined (no rethrow)
 *  5. createCoreUnitFromCvision ON + (tenantId,code) collision → merges (type=both)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const TENANT_UUID    = 'aaaa0000-0000-0000-0000-000000000001';
const CORE_ROW_ID    = 'cccc0000-0000-0000-0000-000000000001';
const LEGACY_CI_ID   = 'iiii0000-0000-0000-0000-000000000001';
const LEGACY_CV_ID   = 'vvvv0000-0000-0000-0000-000000000001';

const { mockCreate, mockFindUnique, mockUpdate, mockLogger } = vi.hoisted(() => {
  const mockCreate     = vi.fn();
  const mockFindUnique = vi.fn();
  const mockUpdate     = vi.fn();
  const mockLogger     = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { mockCreate, mockFindUnique, mockUpdate, mockLogger };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    coreUnit: {
      create:     mockCreate,
      findUnique: mockFindUnique,
      update:     mockUpdate,
    },
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Tests — createCoreUnitFromClinicalInfra
// ---------------------------------------------------------------------------

describe('createCoreUnitFromClinicalInfra', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_UNIT_DUAL_WRITE];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_UNIT_DUAL_WRITE];
  });

  it('1 — flag OFF: returns undefined, no DB call', async () => {
    const { createCoreUnitFromClinicalInfra } = await import('@/lib/core/units/dualWrite');

    const result = await createCoreUnitFromClinicalInfra({
      tenantId:                  TENANT_UUID,
      code:                      'ICU',
      name:                      'Intensive Care Unit',
      legacyClinicalInfraUnitId: LEGACY_CI_ID,
    });

    expect(result).toBeUndefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('2 — flag ON: creates core row with type=clinical and correct fields', async () => {
    process.env[FLAGS.FF_UNIT_DUAL_WRITE] = 'true';
    mockCreate.mockResolvedValue({ id: CORE_ROW_ID });

    const { createCoreUnitFromClinicalInfra } = await import('@/lib/core/units/dualWrite');

    const result = await createCoreUnitFromClinicalInfra({
      tenantId:                  TENANT_UUID,
      code:                      'ICU',
      name:                      'Intensive Care Unit',
      legacyClinicalInfraUnitId: LEGACY_CI_ID,
    });

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0][0].data;
    expect(createArg.type).toBe('clinical');
    expect(createArg.tenantId).toBe(TENANT_UUID);
    expect(createArg.code).toBe('ICU');
    expect(createArg.legacyClinicalInfraUnitId).toBe(LEGACY_CI_ID);
  });

  it('4 — flag ON + core insert throws: error logged, caller gets undefined', async () => {
    process.env[FLAGS.FF_UNIT_DUAL_WRITE] = 'true';
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    const { createCoreUnitFromClinicalInfra } = await import('@/lib/core/units/dualWrite');

    const result = await createCoreUnitFromClinicalInfra({
      tenantId:                  TENANT_UUID,
      code:                      'ICU',
      name:                      'Intensive Care Unit',
      legacyClinicalInfraUnitId: LEGACY_CI_ID,
    });

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledOnce();
    const logArg = mockLogger.error.mock.calls[0][1];
    expect(logArg.category).toBe('db.dual_write.unit');
    expect(logArg.source).toBe('clinical_infra');
  });
});

// ---------------------------------------------------------------------------
// Tests — createCoreUnitFromCvision
// ---------------------------------------------------------------------------

describe('createCoreUnitFromCvision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_UNIT_DUAL_WRITE];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_UNIT_DUAL_WRITE];
  });

  it('1 — flag OFF: returns undefined, no DB call', async () => {
    const { createCoreUnitFromCvision } = await import('@/lib/core/units/dualWrite');

    const result = await createCoreUnitFromCvision({
      tenantId:            TENANT_UUID,
      code:                'NURS',
      name:                'Nursing Unit',
      legacyCvisionUnitId: LEGACY_CV_ID,
    });

    expect(result).toBeUndefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('3 — flag ON: creates core row with type=hr', async () => {
    process.env[FLAGS.FF_UNIT_DUAL_WRITE] = 'true';
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: CORE_ROW_ID });

    const { createCoreUnitFromCvision } = await import('@/lib/core/units/dualWrite');

    const result = await createCoreUnitFromCvision({
      tenantId:            TENANT_UUID,
      code:                'NURS',
      name:                'Nursing Unit',
      nameAr:              'وحدة التمريض',
      legacyCvisionUnitId: LEGACY_CV_ID,
    });

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0][0].data;
    expect(createArg.type).toBe('hr');
    expect(createArg.legacyCvisionUnitId).toBe(LEGACY_CV_ID);
    expect(createArg.nameAr).toBe('وحدة التمريض');
  });

  it('5 — flag ON + (tenantId,code) collision: merges (type=both)', async () => {
    process.env[FLAGS.FF_UNIT_DUAL_WRITE] = 'true';
    mockFindUnique.mockResolvedValue({ id: CORE_ROW_ID, type: 'clinical' });
    mockUpdate.mockResolvedValue({ id: CORE_ROW_ID });

    const { createCoreUnitFromCvision } = await import('@/lib/core/units/dualWrite');

    const result = await createCoreUnitFromCvision({
      tenantId:            TENANT_UUID,
      code:                'ICU',
      name:                'Intensive Care Unit',
      legacyCvisionUnitId: LEGACY_CV_ID,
    });

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledOnce();
    const updateArg = mockUpdate.mock.calls[0][0].data;
    expect(updateArg.type).toBe('both');
    expect(updateArg.legacyCvisionUnitId).toBe(LEGACY_CV_ID);
  });
});
