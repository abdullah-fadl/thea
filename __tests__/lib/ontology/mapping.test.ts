/**
 * Phase 5.3 — Ontology mapping write tests
 *
 * Cases:
 * 11.  Flag OFF → mapEntityToConcept() throws OntologyDisabled
 * 12.  Flag OFF → unmapEntityFromConcept() throws OntologyDisabled
 * 13.  Flag ON  → mapEntityToConcept() creates a new mapping row
 * 14.  Flag ON  → second call with same args is idempotent (updates, not creates)
 * 15.  Flag ON  → unmapEntityFromConcept() deletes the mapping row
 * 16.  Flag ON  → unmapEntityFromConcept() is a no-op when mapping does not exist
 * 17.  Flag ON  → getMappingsForEntity() returns the linked OntologyConcept records
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { OntologyDisabled } from '@/lib/ontology/errors';
import { ONTOLOGY_GLOBAL_TENANT_ID } from '@/lib/ontology/constants';

// ─── Mock prisma ──────────────────────────────────────────────────────────────

const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFindManyMapping = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ontologyMapping: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      findMany: mockFindManyMapping,
    },
    ontologyCodeSystem: { findUnique: vi.fn() },
    ontologyConcept:   { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';
const CONCEPT_ID = 'concept-0000-0000-0000-000000000001';
const ENTITY_TYPE = 'core_department';
const ENTITY_ID = 'dept-00000001';

const mappingRow = {
  id: 'mapping-0000-0000-0000-000000000001',
  tenantId: TENANT,
  entityType: ENTITY_TYPE,
  entityId: ENTITY_ID,
  conceptId: CONCEPT_ID,
  mappingType: 'primary' as const,
  confidence: 1.0,
  source: 'manual' as const,
  createdBy: 'user-001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const conceptRow = {
  id: CONCEPT_ID,
  tenantId: ONTOLOGY_GLOBAL_TENANT_ID,
  codeSystemId: 'cs-snomed-0000',
  code: '195967001',
  display: 'Asthma',
  displayAr: 'الربو',
  semanticType: 'disorder',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_ONTOLOGY_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ONTOLOGY_ENABLED]; }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mapEntityToConcept — flag OFF', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 11: throws OntologyDisabled', async () => {
    const { mapEntityToConcept } = await import('@/lib/ontology/mapping');
    await expect(
      mapEntityToConcept({ tenantId: TENANT, entityType: ENTITY_TYPE, entityId: ENTITY_ID, conceptId: CONCEPT_ID }),
    ).rejects.toBeInstanceOf(OntologyDisabled);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('unmapEntityFromConcept — flag OFF', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 12: throws OntologyDisabled', async () => {
    const { unmapEntityFromConcept } = await import('@/lib/ontology/mapping');
    await expect(
      unmapEntityFromConcept({ tenantId: TENANT, entityType: ENTITY_TYPE, entityId: ENTITY_ID, conceptId: CONCEPT_ID }),
    ).rejects.toBeInstanceOf(OntologyDisabled);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('mapEntityToConcept — flag ON', () => {
  beforeEach(() => {
    enableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 13: creates a new mapping when none exists', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mappingRow);

    const { mapEntityToConcept } = await import('@/lib/ontology/mapping');
    const result = await mapEntityToConcept({
      tenantId: TENANT,
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      conceptId: CONCEPT_ID,
      createdBy: 'user-001',
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result.id).toBe(mappingRow.id);
  });

  it('Case 14: second call with same args updates (idempotent)', async () => {
    mockFindFirst.mockResolvedValue(mappingRow);
    mockUpdate.mockResolvedValue({ ...mappingRow, confidence: 0.9 });

    const { mapEntityToConcept } = await import('@/lib/ontology/mapping');
    const result = await mapEntityToConcept({
      tenantId: TENANT,
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      conceptId: CONCEPT_ID,
      confidence: 0.9,
      source: 'ai',
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.confidence).toBe(0.9);
  });
});

describe('unmapEntityFromConcept — flag ON', () => {
  beforeEach(() => {
    enableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 15: deletes the mapping row when it exists', async () => {
    mockFindFirst.mockResolvedValue({ id: mappingRow.id });
    mockDelete.mockResolvedValue(mappingRow);

    const { unmapEntityFromConcept } = await import('@/lib/ontology/mapping');
    await unmapEntityFromConcept({ tenantId: TENANT, entityType: ENTITY_TYPE, entityId: ENTITY_ID, conceptId: CONCEPT_ID });

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: mappingRow.id } });
  });

  it('Case 16: no-op when mapping does not exist', async () => {
    mockFindFirst.mockResolvedValue(null);

    const { unmapEntityFromConcept } = await import('@/lib/ontology/mapping');
    await expect(
      unmapEntityFromConcept({ tenantId: TENANT, entityType: ENTITY_TYPE, entityId: ENTITY_ID, conceptId: CONCEPT_ID }),
    ).resolves.toBeUndefined();

    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('getMappingsForEntity — flag ON', () => {
  beforeEach(() => {
    enableFlag();
    vi.clearAllMocks();
  });
  afterEach(disableFlag);

  it('Case 17: returns the linked OntologyConcept records', async () => {
    mockFindManyMapping.mockResolvedValue([{ ...mappingRow, concept: conceptRow }]);

    const { getMappingsForEntity } = await import('@/lib/ontology/lookup');
    const results = await getMappingsForEntity(ENTITY_TYPE, ENTITY_ID, TENANT);

    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('195967001');
    expect(results[0].display).toBe('Asthma');
  });
});
