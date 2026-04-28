/**
 * Phase 3.1 — dualWrite.ts tests
 *
 * Cases:
 *  1. FF_DEPARTMENT_DUAL_WRITE OFF  → no-op, undefined returned, no DB call
 *  2. FF_DEPARTMENT_DUAL_WRITE ON   → createCoreDepartmentFromHealth creates core row
 *  3. FF_DEPARTMENT_DUAL_WRITE ON   → createCoreDepartmentFromCvision creates core row (type=hr)
 *  4. FF_DEPARTMENT_DUAL_WRITE ON   + core insert throws → error logged, caller gets undefined (no rethrow)
 *  5. createCoreDepartmentFromCvision ON + (tenantId,code) collision → merges (type=both)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const TENANT_UUID  = 'aaaa0000-0000-0000-0000-000000000001';
const CORE_ROW_ID  = 'cccc0000-0000-0000-0000-000000000001';
const LEGACY_H_ID  = 'hhhh0000-0000-0000-0000-000000000001';
const LEGACY_CV_ID = 'vvvv0000-0000-0000-0000-000000000001';

const { mockCreate, mockFindUnique, mockUpdate, mockLogger } = vi.hoisted(() => {
  const mockCreate    = vi.fn();
  const mockFindUnique = vi.fn();
  const mockUpdate    = vi.fn();
  const mockLogger    = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { mockCreate, mockFindUnique, mockUpdate, mockLogger };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    coreDepartment: {
      create:     mockCreate,
      findUnique: mockFindUnique,
      update:     mockUpdate,
    },
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createCoreDepartmentFromHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE];
  });

  it('1 — flag OFF: returns undefined, no DB call', async () => {
    const { createCoreDepartmentFromHealth } = await import('@/lib/core/departments/dualWrite');

    const result = await createCoreDepartmentFromHealth({
      tenantId:                  TENANT_UUID,
      code:                      'OPD',
      name:                      'Outpatient Dept',
      legacyHealthDepartmentId:  LEGACY_H_ID,
    });

    expect(result).toBeUndefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('2 — flag ON: creates core row with type=clinical and correct fields', async () => {
    process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE] = 'true';
    mockCreate.mockResolvedValue({ id: CORE_ROW_ID });

    const { createCoreDepartmentFromHealth } = await import('@/lib/core/departments/dualWrite');

    const result = await createCoreDepartmentFromHealth({
      tenantId:                  TENANT_UUID,
      code:                      'OPD',
      name:                      'Outpatient Dept',
      legacyHealthDepartmentId:  LEGACY_H_ID,
      createdBy:                 'user-1',
    });

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.tenantId).toBe(TENANT_UUID);
    expect(data.code).toBe('OPD');
    expect(data.type).toBe('clinical');
    expect(data.legacyHealthDepartmentId).toBe(LEGACY_H_ID);
  });

  it('4 — flag ON + core insert throws: error logged, returns undefined (no rethrow)', async () => {
    process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE] = 'true';
    mockCreate.mockRejectedValue(new Error('DB connection refused'));

    const { createCoreDepartmentFromHealth } = await import('@/lib/core/departments/dualWrite');

    // Must not throw
    const result = await createCoreDepartmentFromHealth({
      tenantId:                  TENANT_UUID,
      code:                      'OPD',
      name:                      'Outpatient Dept',
      legacyHealthDepartmentId:  LEGACY_H_ID,
    });

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledOnce();
    expect(mockLogger.error.mock.calls[0][0]).toContain('dual_write.department');
  });
});

describe('createCoreDepartmentFromCvision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE];
  });

  it('1 — flag OFF: returns undefined, no DB call', async () => {
    const { createCoreDepartmentFromCvision } = await import('@/lib/core/departments/dualWrite');

    const result = await createCoreDepartmentFromCvision({
      tenantId:                   TENANT_UUID,
      code:                       'HR',
      name:                       'Human Resources',
      legacyCvisionDepartmentId:  LEGACY_CV_ID,
    });

    expect(result).toBeUndefined();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('3 — flag ON: creates core row with type=hr when no collision', async () => {
    process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE] = 'true';
    mockFindUnique.mockResolvedValue(null); // no existing row
    mockCreate.mockResolvedValue({ id: CORE_ROW_ID });

    const { createCoreDepartmentFromCvision } = await import('@/lib/core/departments/dualWrite');

    const result = await createCoreDepartmentFromCvision({
      tenantId:                   TENANT_UUID,
      code:                       'HR',
      name:                       'Human Resources',
      legacyCvisionDepartmentId:  LEGACY_CV_ID,
      createdBy:                  'user-cv-1',
    });

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.type).toBe('hr');
    expect(data.legacyCvisionDepartmentId).toBe(LEGACY_CV_ID);
    expect(data.tenantId).toBe(TENANT_UUID);
  });

  it('5 — flag ON + collision: merges existing Health row to type=both', async () => {
    process.env[FLAGS.FF_DEPARTMENT_DUAL_WRITE] = 'true';
    // Simulate existing Health core row
    mockFindUnique.mockResolvedValue({ id: CORE_ROW_ID, type: 'clinical' });
    mockUpdate.mockResolvedValue({ id: CORE_ROW_ID });

    const { createCoreDepartmentFromCvision } = await import('@/lib/core/departments/dualWrite');

    const result = await createCoreDepartmentFromCvision({
      tenantId:                   TENANT_UUID,
      code:                       'OPD',
      name:                       'Outpatient Dept',
      legacyCvisionDepartmentId:  LEGACY_CV_ID,
    });

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockCreate).not.toHaveBeenCalled(); // merge, not create
    expect(mockUpdate).toHaveBeenCalledOnce();
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.type).toBe('both');
    expect(updateData.legacyCvisionDepartmentId).toBe(LEGACY_CV_ID);
    // Merge must also log
    expect(mockLogger.info).toHaveBeenCalledOnce();
    expect(mockLogger.info.mock.calls[0][0]).toContain('Merged CVision');
  });
});
