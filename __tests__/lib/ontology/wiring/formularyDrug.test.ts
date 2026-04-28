/**
 * Phase 7.3 — FormularyDrug ↔ RxNorm wiring tests
 *
 * Cases:
 *  6.  Flag ON  — drug with rxNorm code is mapped end-to-end (concept stub
 *                 created, mapping written with source = 'inferred').
 *  7.  Flag ON  — drug without rxNorm returns { skipped: true, reason: 'no_rxnorm_code' }.
 *  8.  Flag ON  — re-running mapFormularyDrugToRxNorm is idempotent (mapping
 *                 row updated, not duplicated).
 *  9.  Flag ON  — findRxNormConceptForDrug returns the linked concept.
 * 10.  Flag ON  — findRxNormConceptForDrug returns null when no mapping exists.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

const mockDrugFindUnique     = vi.fn();
const mockSystemFindUnique   = vi.fn();
const mockConceptFindFirst   = vi.fn();
const mockConceptCreate      = vi.fn();
const mockMappingFindFirst   = vi.fn();
const mockMappingCreate      = vi.fn();
const mockMappingUpdate      = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    formularyDrug:      { findUnique: mockDrugFindUnique },
    ontologyCodeSystem: { findUnique: mockSystemFindUnique },
    ontologyConcept:    { findFirst: mockConceptFindFirst, create: mockConceptCreate },
    ontologyMapping:    { findFirst: mockMappingFindFirst, create: mockMappingCreate, update: mockMappingUpdate },
  },
}));

const TENANT  = 'aaaaaaaa-0000-0000-0000-000000000001';
const DRUG_ID = 'drug-0000-0000-0000-000000000001';
const SYSTEM_ROW = { id: 'cs-rxnorm-0001' };

const drugRow = (overrides: Partial<{ rxNorm: string | null; genericName: string }> = {}) => ({
  id: DRUG_ID,
  tenantId: TENANT,
  rxNorm: '857005',
  genericName: 'Acetaminophen',
  ...overrides,
});

const conceptRow = {
  id: 'concept-rxnorm-001',
  tenantId: TENANT,
  codeSystemId: SYSTEM_ROW.id,
  code: '857005',
  display: 'Acetaminophen',
  displayAr: null,
  semanticType: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mappingRow = {
  id: 'mapping-001',
  tenantId: TENANT,
  entityType: 'formulary_drug',
  entityId: DRUG_ID,
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

describe('mapFormularyDrugToRxNorm — flag ON', () => {
  beforeEach(() => { enableFlag(); vi.clearAllMocks(); });
  afterEach(disableFlag);

  it('Case 6: drug with rxNorm code is mapped end-to-end with source = "inferred"', async () => {
    mockDrugFindUnique.mockResolvedValue(drugRow());
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockConceptFindFirst.mockResolvedValue(null);
    mockConceptCreate.mockResolvedValue(conceptRow);
    mockMappingFindFirst.mockResolvedValue(null);
    mockMappingCreate.mockResolvedValue(mappingRow);

    const { mapFormularyDrugToRxNorm } = await import('@/lib/ontology/wiring/formularyDrug');
    const result = await mapFormularyDrugToRxNorm(DRUG_ID);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.concept.code).toBe('857005');
      expect(result.mapping.source).toBe('inferred');
      expect(result.mapping.entityType).toBe('formulary_drug');
    }
    expect(mockConceptCreate).toHaveBeenCalledOnce();
    expect(mockMappingCreate).toHaveBeenCalledOnce();
    expect(mockMappingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'formulary_drug',
        source: 'inferred',
        mappingType: 'primary',
      }),
    });
  });

  it('Case 7: drug without rxNorm returns { skipped: true, reason: "no_rxnorm_code" }', async () => {
    mockDrugFindUnique.mockResolvedValue(drugRow({ rxNorm: null }));

    const { mapFormularyDrugToRxNorm } = await import('@/lib/ontology/wiring/formularyDrug');
    const result = await mapFormularyDrugToRxNorm(DRUG_ID);

    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('no_rxnorm_code');
    expect(mockConceptCreate).not.toHaveBeenCalled();
    expect(mockMappingCreate).not.toHaveBeenCalled();
  });

  it('Case 8: idempotent — re-running updates the existing mapping rather than creating a new one', async () => {
    mockDrugFindUnique.mockResolvedValue(drugRow());
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockConceptFindFirst.mockResolvedValue(conceptRow);
    mockMappingFindFirst.mockResolvedValue(mappingRow);
    mockMappingUpdate.mockResolvedValue({ ...mappingRow, confidence: 1.0 });

    const { mapFormularyDrugToRxNorm } = await import('@/lib/ontology/wiring/formularyDrug');
    const result = await mapFormularyDrugToRxNorm(DRUG_ID);

    expect(result.skipped).toBe(false);
    expect(mockConceptCreate).not.toHaveBeenCalled();
    expect(mockMappingCreate).not.toHaveBeenCalled();
    expect(mockMappingUpdate).toHaveBeenCalledOnce();
  });
});

describe('findRxNormConceptForDrug — flag ON', () => {
  beforeEach(() => { enableFlag(); vi.clearAllMocks(); });
  afterEach(disableFlag);

  it('Case 9: returns the linked concept when a mapping exists', async () => {
    mockDrugFindUnique.mockResolvedValue({ id: DRUG_ID, tenantId: TENANT });
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockMappingFindFirst.mockResolvedValue({ ...mappingRow, concept: conceptRow });

    const { findRxNormConceptForDrug } = await import('@/lib/ontology/wiring/formularyDrug');
    const concept = await findRxNormConceptForDrug(DRUG_ID);

    expect(concept).not.toBeNull();
    expect(concept?.code).toBe('857005');
  });

  it('Case 10: returns null when no mapping has been created yet', async () => {
    mockDrugFindUnique.mockResolvedValue({ id: DRUG_ID, tenantId: TENANT });
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockMappingFindFirst.mockResolvedValue(null);

    const { findRxNormConceptForDrug } = await import('@/lib/ontology/wiring/formularyDrug');
    const concept = await findRxNormConceptForDrug(DRUG_ID);

    expect(concept).toBeNull();
  });
});
