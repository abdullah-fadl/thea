/**
 * Phase 7.3 — DiagnosisCatalog ↔ ICD-10-AM wiring tests
 *
 * Cases:
 * 11.  Flag ON  — diagnosis with icd10 code is mapped end-to-end (concept stub
 *                 created, mapping written with source = 'inferred').
 * 12.  Flag ON  — diagnosis without icd10 returns
 *                 { skipped: true, reason: 'no_icd10_code' }.
 * 13.  Flag ON  — re-running mapDiagnosisCatalogToIcd10 is idempotent
 *                 (mapping row updated, not duplicated).
 * 14.  Flag ON  — findIcd10ConceptForDiagnosis returns the linked concept.
 * 15.  Flag ON  — findIcd10ConceptForDiagnosis returns null when no mapping exists.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

const mockDxFindUnique     = vi.fn();
const mockSystemFindUnique = vi.fn();
const mockConceptFindFirst = vi.fn();
const mockConceptCreate    = vi.fn();
const mockMappingFindFirst = vi.fn();
const mockMappingCreate    = vi.fn();
const mockMappingUpdate    = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    diagnosisCatalog:   { findUnique: mockDxFindUnique },
    ontologyCodeSystem: { findUnique: mockSystemFindUnique },
    ontologyConcept:    { findFirst: mockConceptFindFirst, create: mockConceptCreate },
    ontologyMapping:    { findFirst: mockMappingFindFirst, create: mockMappingCreate, update: mockMappingUpdate },
  },
}));

const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';
const DX_ID  = 'diagnosis-0000-0000-0000-000000000001';
const SYSTEM_ROW = { id: 'cs-icd10am-0001' };

const dxRow = (overrides: Partial<{ icd10: string | null; name: string }> = {}) => ({
  id: DX_ID,
  tenantId: TENANT,
  icd10: 'E11.9',
  name: 'Type 2 diabetes mellitus without complications',
  ...overrides,
});

const conceptRow = {
  id: 'concept-icd10am-001',
  tenantId: TENANT,
  codeSystemId: SYSTEM_ROW.id,
  code: 'E11.9',
  display: 'Type 2 diabetes mellitus without complications',
  displayAr: null,
  semanticType: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mappingRow = {
  id: 'mapping-dx-001',
  tenantId: TENANT,
  entityType: 'diagnosis_catalog',
  entityId: DX_ID,
  conceptId: conceptRow.id,
  mappingType: 'primary',
  confidence: 1.0,
  source: 'inferred',
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function enableFlag()  { process.env[FLAGS.FF_ONTOLOGY_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ONTOLOGY_ENABLED]; }

describe('mapDiagnosisCatalogToIcd10 — flag ON', () => {
  beforeEach(() => { enableFlag(); vi.clearAllMocks(); });
  afterEach(disableFlag);

  it('Case 11: diagnosis with icd10 code is mapped end-to-end with source = "inferred"', async () => {
    mockDxFindUnique.mockResolvedValue(dxRow());
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockConceptFindFirst.mockResolvedValue(null);
    mockConceptCreate.mockResolvedValue(conceptRow);
    mockMappingFindFirst.mockResolvedValue(null);
    mockMappingCreate.mockResolvedValue(mappingRow);

    const { mapDiagnosisCatalogToIcd10 } = await import('@/lib/ontology/wiring/diagnosisCatalog');
    const result = await mapDiagnosisCatalogToIcd10(DX_ID);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.concept.code).toBe('E11.9');
      expect(result.mapping.source).toBe('inferred');
      expect(result.mapping.entityType).toBe('diagnosis_catalog');
    }
    expect(mockConceptCreate).toHaveBeenCalledOnce();
    expect(mockMappingCreate).toHaveBeenCalledOnce();
  });

  it('Case 12: diagnosis without icd10 returns { skipped: true, reason: "no_icd10_code" }', async () => {
    mockDxFindUnique.mockResolvedValue(dxRow({ icd10: null }));

    const { mapDiagnosisCatalogToIcd10 } = await import('@/lib/ontology/wiring/diagnosisCatalog');
    const result = await mapDiagnosisCatalogToIcd10(DX_ID);

    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('no_icd10_code');
    expect(mockConceptCreate).not.toHaveBeenCalled();
    expect(mockMappingCreate).not.toHaveBeenCalled();
  });

  it('Case 13: idempotent — re-running updates the existing mapping rather than creating a new one', async () => {
    mockDxFindUnique.mockResolvedValue(dxRow());
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockConceptFindFirst.mockResolvedValue(conceptRow);
    mockMappingFindFirst.mockResolvedValue(mappingRow);
    mockMappingUpdate.mockResolvedValue({ ...mappingRow, confidence: 1.0 });

    const { mapDiagnosisCatalogToIcd10 } = await import('@/lib/ontology/wiring/diagnosisCatalog');
    const result = await mapDiagnosisCatalogToIcd10(DX_ID);

    expect(result.skipped).toBe(false);
    expect(mockConceptCreate).not.toHaveBeenCalled();
    expect(mockMappingCreate).not.toHaveBeenCalled();
    expect(mockMappingUpdate).toHaveBeenCalledOnce();
  });
});

describe('findIcd10ConceptForDiagnosis — flag ON', () => {
  beforeEach(() => { enableFlag(); vi.clearAllMocks(); });
  afterEach(disableFlag);

  it('Case 14: returns the linked concept when a mapping exists', async () => {
    mockDxFindUnique.mockResolvedValue({ id: DX_ID, tenantId: TENANT });
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockMappingFindFirst.mockResolvedValue({ ...mappingRow, concept: conceptRow });

    const { findIcd10ConceptForDiagnosis } = await import('@/lib/ontology/wiring/diagnosisCatalog');
    const concept = await findIcd10ConceptForDiagnosis(DX_ID);

    expect(concept).not.toBeNull();
    expect(concept?.code).toBe('E11.9');
  });

  it('Case 15: returns null when no mapping has been created yet', async () => {
    mockDxFindUnique.mockResolvedValue({ id: DX_ID, tenantId: TENANT });
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockMappingFindFirst.mockResolvedValue(null);

    const { findIcd10ConceptForDiagnosis } = await import('@/lib/ontology/wiring/diagnosisCatalog');
    const concept = await findIcd10ConceptForDiagnosis(DX_ID);

    expect(concept).toBeNull();
  });
});
