/**
 * Phase 3.1 — shadowRead.ts tests
 *
 * Cases:
 *  1. FF_DEPARTMENT_UNIFIED_READ_SHADOW OFF → no-op, no DB call, outcome=skipped
 *  2. Flag ON + rows match (Health)         → logs 'match', outcome=match
 *  3. Flag ON + rows differ on 'name' (Health) → logs 'diff_fields: [name]', outcome=diff_fields
 *  4. Flag ON + core row missing (Health)   → logs 'missing_in_core'
 *  5. Flag ON + rows match (CVision)        → logs 'match', outcome=match
 *  6. Flag ON + rows differ on 'name' (CVision) → logs diff_fields: ['name']
 *  7. Flag ON + core row missing (CVision)  → logs 'missing_in_core'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const TENANT_UUID  = 'bbbb0000-0000-0000-0000-000000000002';
const LEGACY_H_ID  = 'hhhh0000-0000-0000-0000-000000000002';
const LEGACY_CV_ID = 'vvvv0000-0000-0000-0000-000000000002';

const { mockFindFirst, mockLogger } = vi.hoisted(() => {
  const mockFindFirst = vi.fn();
  const mockLogger    = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { mockFindFirst, mockLogger };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    coreDepartment: { findFirst: mockFindFirst },
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Helper: base legacy rows
// ---------------------------------------------------------------------------

const healthRow = {
  id:       LEGACY_H_ID,
  tenantId: TENANT_UUID,
  code:     'OPD',
  name:     'Outpatient Dept',
  nameAr:   null,
  type:     'OPD',
} as const;

const cvisionRow = {
  id:       LEGACY_CV_ID,
  tenantId: TENANT_UUID,
  code:     'HR',
  name:     'Human Resources',
  nameAr:   null,
} as const;

// ---------------------------------------------------------------------------
// compareLegacyHealthToCore
// ---------------------------------------------------------------------------

describe('compareLegacyHealthToCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW];
  });

  it('1 — flag OFF: no DB call, outcome=skipped', async () => {
    const { compareLegacyHealthToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyHealthToCore(healthRow);

    expect(result).toEqual({ outcome: 'skipped' });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('2 — flag ON + rows match: logs match', async () => {
    process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'OPD', name: 'Outpatient Dept', nameAr: null });

    const { compareLegacyHealthToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyHealthToCore(healthRow);

    expect(result).toEqual({ outcome: 'match' });
    expect(mockLogger.info).toHaveBeenCalledOnce();
    // outcome is encoded in the log message string (first arg), not the context object
    expect(mockLogger.info.mock.calls[0][0]).toContain('match');
  });

  it('3 — flag ON + rows differ on name: logs diff_fields: [name]', async () => {
    process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'OPD', name: 'DIFFERENT NAME', nameAr: null });

    const { compareLegacyHealthToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyHealthToCore(healthRow);

    expect(result).toEqual({ outcome: 'diff_fields', diff_fields: ['name'] });
    expect(mockLogger.warn).toHaveBeenCalledOnce();
    expect(mockLogger.warn.mock.calls[0][1]).toMatchObject({ diff_fields: ['name'] });
  });

  it('4 — flag ON + core row missing: logs missing_in_core', async () => {
    process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue(null);

    const { compareLegacyHealthToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyHealthToCore(healthRow);

    expect(result).toEqual({ outcome: 'missing_in_core' });
    expect(mockLogger.info).toHaveBeenCalledOnce();
    // outcome is encoded in the log message string (first arg)
    expect(mockLogger.info.mock.calls[0][0]).toContain('missing_in_core');
  });
});

// ---------------------------------------------------------------------------
// compareLegacyCvisionToCore
// ---------------------------------------------------------------------------

describe('compareLegacyCvisionToCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW];
  });

  it('5 — flag ON + rows match (CVision): logs match', async () => {
    process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'HR', name: 'Human Resources', nameAr: null });

    const { compareLegacyCvisionToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyCvisionToCore(cvisionRow);

    expect(result).toEqual({ outcome: 'match' });
    expect(mockLogger.info).toHaveBeenCalledOnce();
  });

  it('6 — flag ON + rows differ on name (CVision): logs diff_fields: [name]', async () => {
    process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'HR', name: 'HR CHANGED', nameAr: null });

    const { compareLegacyCvisionToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyCvisionToCore(cvisionRow);

    expect(result).toEqual({ outcome: 'diff_fields', diff_fields: ['name'] });
    expect(mockLogger.warn).toHaveBeenCalledOnce();
    expect(mockLogger.warn.mock.calls[0][1]).toMatchObject({ diff_fields: ['name'] });
  });

  it('7 — flag ON + core row missing (CVision): logs missing_in_core', async () => {
    process.env[FLAGS.FF_DEPARTMENT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue(null);

    const { compareLegacyCvisionToCore } = await import('@/lib/core/departments/shadowRead');

    const result = await compareLegacyCvisionToCore(cvisionRow);

    expect(result).toEqual({ outcome: 'missing_in_core' });
    expect(mockLogger.info).toHaveBeenCalledOnce();
  });
});
