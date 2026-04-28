/**
 * Phase 5.3 — Ontology lookup tests
 *
 * Cases:
 *  1.  Flag OFF → findConceptByCode() returns null
 *  2.  Flag OFF → findConceptsByDisplay() returns []
 *  3.  Flag OFF → getMappingsForEntity() returns []
 *  4.  Flag ON  → exact code lookup returns the concept
 *  5.  Flag ON  → wrong code returns null
 *  6.  Flag ON  → unknown code system returns null
 *  7.  Flag ON  → display search returns relevant hits
 *  8.  Flag ON  → display search with codeSystem filter limits results
 *  9.  Flag ON  → tenant isolation: concept seeded for tenant A not visible to tenant B
 * 10.  Flag ON  → global concept (ONTOLOGY_GLOBAL_TENANT_ID) visible to any tenant
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { ONTOLOGY_GLOBAL_TENANT_ID } from '@/lib/ontology/constants';

// ─── Mock prisma ──────────────────────────────────────────────────────────────

const mockFindUniqueCodeSystem = vi.fn();
const mockFindFirstConcept = vi.fn();
const mockFindManyConcept = vi.fn();
const mockFindManyMapping = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ontologyCodeSystem: { findUnique: mockFindUniqueCodeSystem },
    ontologyConcept: { findFirst: mockFindFirstConcept, findMany: mockFindManyConcept },
    ontologyMapping: { findMany: mockFindManyMapping },
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CS_ID = 'cs-snomed-0000-0000-000000000001';
const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000001';

const asthmaConcept = {
  id: 'concept-0000-0000-0000-000000000001',
  tenantId: ONTOLOGY_GLOBAL_TENANT_ID,
  codeSystemId: CS_ID,
  code: '195967001',
  display: 'Asthma',
  displayAr: 'الربو',
  semanticType: 'disorder',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const glucoseConcept = {
  id: 'concept-0000-0000-0000-000000000002',
  tenantId: ONTOLOGY_GLOBAL_TENANT_ID,
  codeSystemId: 'cs-loinc-0000-0000-000000000001',
  code: '2339-0',
  display: 'Glucose [Mass/volume] in Blood',
  displayAr: 'الجلوكوز في الدم',
  semanticType: 'laboratory',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_ONTOLOGY_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ONTOLOGY_ENABLED]; }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('findConceptByCode — flag OFF', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 1: returns null without any DB call', async () => {
    const { findConceptByCode } = await import('@/lib/ontology/lookup');
    const result = await findConceptByCode('SNOMED_CT', '195967001');
    expect(result).toBeNull();
    expect(mockFindUniqueCodeSystem).not.toHaveBeenCalled();
    expect(mockFindFirstConcept).not.toHaveBeenCalled();
  });
});

describe('findConceptsByDisplay — flag OFF', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 2: returns [] without any DB call', async () => {
    const { findConceptsByDisplay } = await import('@/lib/ontology/lookup');
    const result = await findConceptsByDisplay('Asthma');
    expect(result).toEqual([]);
    expect(mockFindManyConcept).not.toHaveBeenCalled();
  });
});

describe('getMappingsForEntity — flag OFF', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 3: returns [] without any DB call', async () => {
    const { getMappingsForEntity } = await import('@/lib/ontology/lookup');
    const result = await getMappingsForEntity('core_department', 'dept-001', TENANT_A);
    expect(result).toEqual([]);
    expect(mockFindManyMapping).not.toHaveBeenCalled();
  });
});

describe('findConceptByCode — flag ON', () => {
  beforeEach(() => {
    enableFlag();
    vi.clearAllMocks();
    mockFindUniqueCodeSystem.mockResolvedValue({ id: CS_ID });
  });
  afterEach(disableFlag);

  it('Case 4: exact code lookup returns the concept', async () => {
    mockFindFirstConcept.mockResolvedValue(asthmaConcept);
    const { findConceptByCode } = await import('@/lib/ontology/lookup');
    const result = await findConceptByCode('SNOMED_CT', '195967001', TENANT_A);
    expect(result).not.toBeNull();
    expect(result?.code).toBe('195967001');
    expect(result?.display).toBe('Asthma');
  });

  it('Case 5: wrong code returns null', async () => {
    mockFindFirstConcept.mockResolvedValue(null);
    const { findConceptByCode } = await import('@/lib/ontology/lookup');
    const result = await findConceptByCode('SNOMED_CT', 'DOES-NOT-EXIST', TENANT_A);
    expect(result).toBeNull();
  });

  it('Case 6: unknown code system (no system row) returns null', async () => {
    mockFindUniqueCodeSystem.mockResolvedValue(null);
    const { findConceptByCode } = await import('@/lib/ontology/lookup');
    // @ts-expect-error intentional wrong system
    const result = await findConceptByCode('UNKNOWN_SYSTEM', '123', TENANT_A);
    expect(result).toBeNull();
    expect(mockFindFirstConcept).not.toHaveBeenCalled();
  });
});

describe('findConceptsByDisplay — flag ON', () => {
  beforeEach(() => {
    enableFlag();
    vi.clearAllMocks();
    mockFindUniqueCodeSystem.mockResolvedValue({ id: CS_ID });
  });
  afterEach(disableFlag);

  it('Case 7: display search returns relevant hits', async () => {
    mockFindManyConcept.mockResolvedValue([asthmaConcept]);
    const { findConceptsByDisplay } = await import('@/lib/ontology/lookup');
    const results = await findConceptsByDisplay('Asthma');
    expect(results).toHaveLength(1);
    expect(results[0].display).toBe('Asthma');
  });

  it('Case 8: codeSystem filter resolves the system and passes codeSystemId', async () => {
    mockFindManyConcept.mockResolvedValue([asthmaConcept]);
    const { findConceptsByDisplay } = await import('@/lib/ontology/lookup');
    const results = await findConceptsByDisplay('Asthma', 'SNOMED_CT', TENANT_A);
    expect(results).toHaveLength(1);
    // Confirm codeSystemId was passed in the where clause.
    const whereArg = mockFindManyConcept.mock.calls[0][0].where;
    expect(whereArg.codeSystemId).toBe(CS_ID);
  });
});

describe('tenant isolation', () => {
  beforeEach(() => {
    enableFlag();
    vi.clearAllMocks();
    mockFindUniqueCodeSystem.mockResolvedValue({ id: CS_ID });
  });
  afterEach(disableFlag);

  it('Case 9: concept seeded for tenant A not returned when tenant B searches different tenantId', async () => {
    // Tenant B query finds nothing (Prisma returns null for a non-matching tenantId).
    mockFindFirstConcept.mockResolvedValue(null);
    const { findConceptByCode } = await import('@/lib/ontology/lookup');
    const result = await findConceptByCode('SNOMED_CT', '195967001', TENANT_B);
    // The where clause passed to Prisma includes both TENANT_B and GLOBAL.
    const whereArg = mockFindFirstConcept.mock.calls[0][0].where;
    expect(whereArg.tenantId.in).toContain(TENANT_B);
    expect(whereArg.tenantId.in).toContain(ONTOLOGY_GLOBAL_TENANT_ID);
    expect(result).toBeNull();
  });

  it('Case 10: global concept (GLOBAL_TENANT_ID) is included in every tenant query', async () => {
    const globalConcept = { ...asthmaConcept, tenantId: ONTOLOGY_GLOBAL_TENANT_ID };
    mockFindFirstConcept.mockResolvedValue(globalConcept);
    const { findConceptByCode } = await import('@/lib/ontology/lookup');
    const result = await findConceptByCode('SNOMED_CT', '195967001', TENANT_A);
    // Query must include the global sentinel in the tenantId filter.
    const whereArg = mockFindFirstConcept.mock.calls[0][0].where;
    expect(whereArg.tenantId.in).toContain(ONTOLOGY_GLOBAL_TENANT_ID);
    expect(result?.tenantId).toBe(ONTOLOGY_GLOBAL_TENANT_ID);
  });
});

// Suppress unused-import lint for glucoseConcept used in description only.
void glucoseConcept;
