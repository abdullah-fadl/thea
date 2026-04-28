/**
 * Phase 7.3 — ensureConcept lazy-upsert tests
 *
 * Cases:
 *  1. Flag OFF → throws OntologyDisabled (no DB calls)
 *  2. Flag ON  → returns the existing concept when one already exists
 *  3. Flag ON  → creates a stub concept (display = displayHint) when none exists
 *  4. Flag ON  → race-safe: P2002 unique violation falls back to existing row
 *  5. Flag ON  → unknown codeSystem throws Error before any DB call
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { OntologyDisabled, OntologyNotFound } from '@/lib/ontology/errors';
import { ONTOLOGY_GLOBAL_TENANT_ID } from '@/lib/ontology/constants';

const mockSystemFindUnique = vi.fn();
const mockConceptFindFirst = vi.fn();
const mockConceptCreate    = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ontologyCodeSystem: { findUnique: mockSystemFindUnique },
    ontologyConcept:    { findFirst: mockConceptFindFirst, create: mockConceptCreate },
  },
}));

const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001';
const SYSTEM_ROW   = { id: 'cs-rxnorm-0001' };
const EXISTING_ROW = {
  id: 'concept-existing-001',
  tenantId: TENANT,
  codeSystemId: SYSTEM_ROW.id,
  code: '857005',
  display: 'Acetaminophen 325 MG Oral Tablet',
  displayAr: null,
  semanticType: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function enableFlag()  { process.env[FLAGS.FF_ONTOLOGY_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_ONTOLOGY_ENABLED]; }

describe('ensureConcept — flag OFF', () => {
  beforeEach(() => { disableFlag(); vi.clearAllMocks(); });
  afterEach(disableFlag);

  it('Case 1: throws OntologyDisabled and never touches DB', async () => {
    const { ensureConcept } = await import('@/lib/ontology/lazyUpsert');
    await expect(
      ensureConcept({ codeSystem: 'RXNORM', code: '857005', tenantId: TENANT }),
    ).rejects.toBeInstanceOf(OntologyDisabled);

    expect(mockSystemFindUnique).not.toHaveBeenCalled();
    expect(mockConceptFindFirst).not.toHaveBeenCalled();
    expect(mockConceptCreate).not.toHaveBeenCalled();
  });
});

describe('ensureConcept — flag ON', () => {
  beforeEach(() => { enableFlag(); vi.clearAllMocks(); });
  afterEach(disableFlag);

  it('Case 2: returns existing concept without creating a new one', async () => {
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockConceptFindFirst.mockResolvedValue(EXISTING_ROW);

    const { ensureConcept } = await import('@/lib/ontology/lazyUpsert');
    const result = await ensureConcept({
      codeSystem: 'RXNORM',
      code: '857005',
      tenantId: TENANT,
      displayHint: 'Acetaminophen',
    });

    expect(result.id).toBe(EXISTING_ROW.id);
    expect(mockConceptCreate).not.toHaveBeenCalled();
  });

  it('Case 3: creates a stub concept when none exists', async () => {
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    mockConceptFindFirst.mockResolvedValue(null);
    mockConceptCreate.mockResolvedValue({ ...EXISTING_ROW, id: 'concept-new-002' });

    const { ensureConcept } = await import('@/lib/ontology/lazyUpsert');
    const result = await ensureConcept({
      codeSystem: 'RXNORM',
      code: '999999',
      tenantId: TENANT,
      displayHint: 'New Drug X',
    });

    expect(result.id).toBe('concept-new-002');
    expect(mockConceptCreate).toHaveBeenCalledOnce();
    expect(mockConceptCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        codeSystemId: SYSTEM_ROW.id,
        code: '999999',
        display: 'New Drug X',
        displayAr: null,
        status: 'active',
      }),
    });
  });

  it('Case 4: P2002 unique violation falls back to the existing row (race-safe)', async () => {
    mockSystemFindUnique.mockResolvedValue(SYSTEM_ROW);
    // First findFirst (initial check) → null. Second (after rescue) → winner row.
    mockConceptFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(EXISTING_ROW);
    mockConceptCreate.mockRejectedValue(Object.assign(new Error('Unique violation'), { code: 'P2002' }));

    const { ensureConcept } = await import('@/lib/ontology/lazyUpsert');
    const result = await ensureConcept({
      codeSystem: 'RXNORM',
      code: '857005',
      tenantId: TENANT,
    });

    expect(result.id).toBe(EXISTING_ROW.id);
    expect(mockConceptFindFirst).toHaveBeenCalledTimes(2);
  });

  it('Case 5: unknown codeSystem throws Error before any DB call; missing seed throws OntologyNotFound', async () => {
    const { ensureConcept } = await import('@/lib/ontology/lazyUpsert');

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ensureConcept({ codeSystem: 'BOGUS_SYSTEM' as any, code: '1', tenantId: TENANT }),
    ).rejects.toThrowError(/Unknown codeSystem/);
    expect(mockSystemFindUnique).not.toHaveBeenCalled();

    mockSystemFindUnique.mockResolvedValue(null);
    await expect(
      ensureConcept({ codeSystem: 'RXNORM', code: '1', tenantId: ONTOLOGY_GLOBAL_TENANT_ID }),
    ).rejects.toBeInstanceOf(OntologyNotFound);
  });
});
