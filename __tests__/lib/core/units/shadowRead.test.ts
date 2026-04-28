/**
 * Phase 3.2 — shadowRead.ts tests
 *
 * Cases:
 *  1. FF_UNIT_UNIFIED_READ_SHADOW OFF → no-op, no DB call, outcome=skipped
 *  2. Flag ON + rows match (ClinicalInfra)         → logs 'match', outcome=match
 *  3. Flag ON + rows differ on 'name' (ClinicalInfra) → logs 'diff_fields: [name]', outcome=diff_fields
 *  4. Flag ON + core row missing (ClinicalInfra)   → logs 'missing_in_core'
 *  5. Flag ON + rows match (CVision)               → logs 'match', outcome=match
 *  6. Flag ON + rows differ on 'name' (CVision)    → logs diff_fields: ['name']
 *  7. Flag ON + core row missing (CVision)         → logs 'missing_in_core'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const TENANT_UUID  = 'bbbb0000-0000-0000-0000-000000000002';
const LEGACY_CI_ID = 'iiii0000-0000-0000-0000-000000000002';
const LEGACY_CV_ID = 'vvvv0000-0000-0000-0000-000000000002';

const { mockFindFirst, mockLogger } = vi.hoisted(() => {
  const mockFindFirst = vi.fn();
  const mockLogger    = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { mockFindFirst, mockLogger };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    coreUnit: { findFirst: mockFindFirst },
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Base legacy rows
// ---------------------------------------------------------------------------

const clinicalInfraRow = {
  id:       LEGACY_CI_ID,
  tenantId: TENANT_UUID,
  code:     'ICU',
  name:     'Intensive Care Unit',
  nameAr:   null,
} as const;

const cvisionRow = {
  id:       LEGACY_CV_ID,
  tenantId: TENANT_UUID,
  code:     'NURS',
  name:     'Nursing Unit',
  nameAr:   null,
} as const;

// ---------------------------------------------------------------------------
// compareLegacyClinicalInfraToCore
// ---------------------------------------------------------------------------

describe('compareLegacyClinicalInfraToCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW];
  });

  it('1 — flag OFF: no DB call, outcome=skipped', async () => {
    const { compareLegacyClinicalInfraToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyClinicalInfraToCore(clinicalInfraRow);

    expect(result).toEqual({ outcome: 'skipped' });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('2 — flag ON + match: logs match, outcome=match', async () => {
    process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'ICU', name: 'Intensive Care Unit', nameAr: null });

    const { compareLegacyClinicalInfraToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyClinicalInfraToCore(clinicalInfraRow);

    expect(result).toEqual({ outcome: 'match' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('match'),
      expect.objectContaining({ category: 'db.shadow_read.unit', source: 'clinical_infra' }),
    );
  });

  it('3 — flag ON + name differs: outcome=diff_fields, logs diff_fields: [name]', async () => {
    process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'ICU', name: 'ICU — Different Name', nameAr: null });

    const { compareLegacyClinicalInfraToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyClinicalInfraToCore(clinicalInfraRow);

    expect(result).toEqual({ outcome: 'diff_fields', diff_fields: ['name'] });
    expect(mockLogger.warn).toHaveBeenCalledOnce();
    const logArg = mockLogger.warn.mock.calls[0][1];
    expect(logArg.diff_fields).toEqual(['name']);
  });

  it('4 — flag ON + core row missing: outcome=missing_in_core', async () => {
    process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue(null);

    const { compareLegacyClinicalInfraToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyClinicalInfraToCore(clinicalInfraRow);

    expect(result).toEqual({ outcome: 'missing_in_core' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('missing_in_core'),
      expect.objectContaining({ category: 'db.shadow_read.unit', source: 'clinical_infra' }),
    );
  });
});

// ---------------------------------------------------------------------------
// compareLegacyCvisionToCore
// ---------------------------------------------------------------------------

describe('compareLegacyCvisionToCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW];
  });

  it('5 — flag ON + match (CVision): logs match, outcome=match', async () => {
    process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'NURS', name: 'Nursing Unit', nameAr: null });

    const { compareLegacyCvisionToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyCvisionToCore(cvisionRow);

    expect(result).toEqual({ outcome: 'match' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('match'),
      expect.objectContaining({ category: 'db.shadow_read.unit', source: 'cvision' }),
    );
  });

  it('6 — flag ON + name differs (CVision): logs diff_fields: [name]', async () => {
    process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue({ code: 'NURS', name: 'Nursing — Renamed', nameAr: null });

    const { compareLegacyCvisionToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyCvisionToCore(cvisionRow);

    expect(result).toEqual({ outcome: 'diff_fields', diff_fields: ['name'] });
    const logArg = mockLogger.warn.mock.calls[0][1];
    expect(logArg.diff_fields).toEqual(['name']);
  });

  it('7 — flag ON + core row missing (CVision): outcome=missing_in_core', async () => {
    process.env[FLAGS.FF_UNIT_UNIFIED_READ_SHADOW] = 'true';
    mockFindFirst.mockResolvedValue(null);

    const { compareLegacyCvisionToCore } = await import('@/lib/core/units/shadowRead');

    const result = await compareLegacyCvisionToCore(cvisionRow);

    expect(result).toEqual({ outcome: 'missing_in_core' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('missing_in_core'),
      expect.objectContaining({ category: 'db.shadow_read.unit', source: 'cvision' }),
    );
  });
});
