/**
 * Phase 7.7 — FHIR R4 expansion tests (MedicationRequest + AllergyIntolerance + Condition)
 *
 * Cases:
 *  MR-01..MR-03  serializeMedicationRequest — status map + RxNorm enrichment via Phase 7.3 wiring
 *  AI-01..AI-03  serializeAllergyIntolerance — type/category/criticality + NKDA + reaction
 *  CD-01..CD-03  serializeCondition — icdCode emission + ontology enrichment + clinical status
 *  R-01..R-12    Three [id] routes (4 invariants × 3 routes): flag gate, permission/tenant,
 *                read-only (no POST/PUT), tenant-scoped prisma.findFirst + fhir+json content type.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─── Mock the ontology wiring layer before any serializer import ─────────────

const mockFindRxNormConceptForDrug   = vi.fn();
const mockFindIcd10ConceptForDiagnosis = vi.fn();

vi.mock('@/lib/ontology/wiring/formularyDrug', () => ({
  findRxNormConceptForDrug: (...args: unknown[]) => mockFindRxNormConceptForDrug(...args),
}));
vi.mock('@/lib/ontology/wiring/diagnosisCatalog', () => ({
  findIcd10ConceptForDiagnosis: (...args: unknown[]) => mockFindIcd10ConceptForDiagnosis(...args),
}));

// ─── Mock prisma so the serializers can query FormularyDrug/DiagnosisCatalog ─

const mockFormularyDrugFindFirst    = vi.fn();
const mockDiagnosisCatalogFindFirst = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    formularyDrug:    { findFirst: (...a: unknown[]) => mockFormularyDrugFindFirst(...a) },
    diagnosisCatalog: { findFirst: (...a: unknown[]) => mockDiagnosisCatalogFindFirst(...a) },
  },
}));

// ─── Static imports (after mocks) ────────────────────────────────────────────

import { serializeMedicationRequest } from '@/lib/fhir/serializers/medicationRequest';
import { serializeAllergyIntolerance } from '@/lib/fhir/serializers/allergyIntolerance';
import { serializeCondition } from '@/lib/fhir/serializers/condition';

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const TENANT = '11111111-1111-1111-1111-111111111111';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePrescription(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:                'rx-001',
    tenantId:          TENANT,
    patientId:         'pat-001',
    patientName:       'Ahmed Al-Farsi',
    mrn:               'MRN-001',
    encounterId:       'enc-001',
    medication:        'Amoxicillin 500mg',
    medicationAr:      'أموكسيسيلين',
    genericName:       'amoxicillin',
    strength:          '500mg',
    form:              'CAPSULE',
    route:             'oral',
    frequency:         'tid',
    duration:          '7 days',
    quantity:          21,
    refills:           0,
    instructions:      'Take with food',
    instructionsAr:    'يؤخذ مع الطعام',
    doctorId:          'doc-001',
    doctorName:        'Dr. Hassan',
    priority:          'ROUTINE',
    status:            'VERIFIED',
    prescribedAt:      new Date('2026-04-20T08:00:00Z'),
    prescribedBy:      'doc-001',
    prescriberName:    'Dr. Hassan',
    verifiedAt:        new Date('2026-04-20T09:00:00Z'),
    verifiedBy:        'pharm-001',
    verifierName:      'Pharm. Ali',
    verificationNotes: null,
    dispensedAt:       null,
    dispensedBy:       null,
    dispenserName:     null,
    pharmacistNotes:   null,
    pickedUpAt:        null,
    pickedUpRecordedBy: null,
    cancelledAt:       null,
    cancelledBy:       null,
    cancellationReason: null,
    ordersHubId:       null,
    createdAt:         new Date('2026-04-20'),
    updatedAt:         new Date('2026-04-20T09:00:00Z'),
    ...overrides,
  };
}

function makeAllergy(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:        'allergy-001',
    tenantId:  TENANT,
    patientId: 'pat-001',
    allergen:  'Penicillin',
    reaction:  'Rash and hives',
    type:      'DRUG',
    severity:  'severe',
    status:    'active',
    nkda:      false,
    onsetDate: new Date('2024-06-01'),
    notes:     'Confirmed via skin test',
    createdAt: new Date('2024-06-02'),
    updatedAt: new Date('2026-04-20T10:00:00Z'),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeProblem(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:           'prob-001',
    tenantId:     TENANT,
    patientId:    'pat-001',
    problemName:  'Type 2 diabetes mellitus',
    code:         'DX-T2DM',
    description:  null,
    icdCode:      'E11.9',
    status:       'active',
    onsetDate:    new Date('2020-01-15'),
    resolvedDate: null,
    severity:     'moderate',
    notes:        'On metformin',
    createdAt:    new Date('2020-01-16'),
    updatedAt:    new Date('2026-04-20T11:00:00Z'),
    createdBy:    null,
    updatedBy:    null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: serializeMedicationRequest (MR-01..MR-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 7.7 — serializeMedicationRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormularyDrugFindFirst.mockResolvedValue(null);
    mockFindRxNormConceptForDrug.mockResolvedValue(null);
  });
  afterEach(() => vi.clearAllMocks());

  // MR-01
  it('MR-01: VERIFIED status → active; encounter+requester refs set; intent=order', async () => {
    const fhir = await serializeMedicationRequest(makePrescription() as never, TENANT);
    expect(fhir.resourceType).toBe('MedicationRequest');
    expect(fhir.status).toBe('active');
    expect(fhir.intent).toBe('order');
    expect(fhir.subject.reference).toBe('Patient/pat-001');
    expect(fhir.encounter?.reference).toBe('Encounter/enc-001');
    expect(fhir.requester?.reference).toBe('Practitioner/doc-001');
    expect(fhir.requester?.display).toBe('Dr. Hassan');
    expect(fhir.dosageInstruction?.[0].text).toBe('Take with food');
  });

  // MR-02
  it('MR-02: when FormularyDrug + RxNorm concept resolve, RxNorm coding appended', async () => {
    mockFormularyDrugFindFirst.mockResolvedValue({ id: 'drug-001' });
    mockFindRxNormConceptForDrug.mockResolvedValue({
      id: 'c-rx-001',
      code: '723',
      display: 'Amoxicillin',
      tenantId: 'global',
      codeSystemId: 'cs-rxnorm',
      semanticType: null,
      status: 'active',
      displayAr: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fhir = await serializeMedicationRequest(makePrescription() as never, TENANT);
    const codings = fhir.medicationCodeableConcept?.coding ?? [];
    const rx = codings.find(c => c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm');
    expect(rx).toBeDefined();
    expect(rx?.code).toBe('723');
    expect(rx?.display).toBe('Amoxicillin');
    expect(mockFindRxNormConceptForDrug).toHaveBeenCalledWith('drug-001');
  });

  // MR-03
  it('MR-03: when no FormularyDrug match, only Thea internal coding is present', async () => {
    mockFormularyDrugFindFirst.mockResolvedValue(null);
    const fhir = await serializeMedicationRequest(
      makePrescription({ status: 'CANCELLED' }) as never,
      TENANT,
    );
    expect(fhir.status).toBe('cancelled');
    const codings = fhir.medicationCodeableConcept?.coding ?? [];
    expect(codings.find(c => c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm')).toBeUndefined();
    expect(codings[0].system).toContain('thea.com.sa');
    expect(mockFindRxNormConceptForDrug).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: serializeAllergyIntolerance (AI-01..AI-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 7.7 — serializeAllergyIntolerance', () => {
  // AI-01
  it('AI-01: DRUG type → category medication; severe → criticality high; active status', () => {
    const fhir = serializeAllergyIntolerance(makeAllergy() as never);
    expect(fhir.resourceType).toBe('AllergyIntolerance');
    expect(fhir.type).toBe('allergy');
    expect(fhir.category).toEqual(['medication']);
    expect(fhir.criticality).toBe('high');
    expect(fhir.clinicalStatus?.coding?.[0].code).toBe('active');
  });

  // AI-02
  it('AI-02: NKDA flag yields explicit "No known drug allergies" code text and omits clinicalStatus', () => {
    const fhir = serializeAllergyIntolerance(
      makeAllergy({ nkda: true, allergen: '', reaction: null }) as never,
    );
    expect(fhir.code?.text).toBe('No known drug allergies');
    expect(fhir.clinicalStatus).toBeUndefined();
    expect(fhir.reaction).toBeUndefined();
  });

  // AI-03
  it('AI-03: patient ref + reaction.manifestation.text + recordedDate from createdAt', () => {
    const fhir = serializeAllergyIntolerance(makeAllergy() as never);
    expect(fhir.patient.reference).toBe('Patient/pat-001');
    expect(fhir.reaction?.[0].manifestation[0].text).toBe('Rash and hives');
    expect(fhir.reaction?.[0].severity).toBe('severe');
    expect(fhir.recordedDate).toMatch(/2024-06-02/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: serializeCondition (CD-01..CD-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 7.7 — serializeCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiagnosisCatalogFindFirst.mockResolvedValue(null);
    mockFindIcd10ConceptForDiagnosis.mockResolvedValue(null);
  });
  afterEach(() => vi.clearAllMocks());

  // CD-01
  it('CD-01: emits Thea catalog code + free-text icdCode under hl7.org/fhir/sid/icd-10-am', async () => {
    const fhir = await serializeCondition(makeProblem() as never, TENANT);
    expect(fhir.resourceType).toBe('Condition');
    const codings = fhir.code?.coding ?? [];
    const thea  = codings.find(c => c.system?.includes('thea.com.sa'));
    const icd10 = codings.find(c => c.system === 'http://hl7.org/fhir/sid/icd-10-am');
    expect(thea?.code).toBe('DX-T2DM');
    expect(icd10?.code).toBe('E11.9');
    expect(fhir.code?.text).toBe('Type 2 diabetes mellitus');
  });

  // CD-02
  it('CD-02: when DiagnosisCatalog match + ICD-10 concept resolve, distinct concept code is appended', async () => {
    mockDiagnosisCatalogFindFirst.mockResolvedValue({ id: 'dx-001' });
    mockFindIcd10ConceptForDiagnosis.mockResolvedValue({
      id: 'c-icd-001',
      code: 'E11.65',
      display: 'Type 2 diabetes mellitus with hyperglycemia',
      tenantId: 'global',
      codeSystemId: 'cs-icd10',
      semanticType: null,
      status: 'active',
      displayAr: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fhir = await serializeCondition(makeProblem() as never, TENANT);
    const codings = fhir.code?.coding ?? [];
    const icd10s = codings.filter(c => c.system === 'http://hl7.org/fhir/sid/icd-10-am');
    expect(icd10s.length).toBe(2); // free-text E11.9 + ontology E11.65
    expect(icd10s.map(c => c.code).sort()).toEqual(['E11.65', 'E11.9']);
    expect(mockFindIcd10ConceptForDiagnosis).toHaveBeenCalledWith('dx-001');
  });

  // CD-03
  it('CD-03: clinicalStatus map (resolved → resolved); abatementDateTime set when resolvedDate present', async () => {
    const fhir = await serializeCondition(
      makeProblem({ status: 'resolved', resolvedDate: new Date('2025-12-01') }) as never,
      TENANT,
    );
    expect(fhir.clinicalStatus?.coding?.[0].code).toBe('resolved');
    expect(fhir.abatementDateTime).toMatch(/2025-12-01/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Route source inspection (R-01..R-12, 4 invariants × 3 routes)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 7.7 — Route source inspection', () => {
  const routes: { name: string; file: string; model: string }[] = [
    {
      name:  'MedicationRequest',
      file:  'app/api/fhir/MedicationRequest/[id]/route.ts',
      model: 'prisma.pharmacyPrescription.findFirst',
    },
    {
      name:  'AllergyIntolerance',
      file:  'app/api/fhir/AllergyIntolerance/[id]/route.ts',
      model: 'prisma.patientAllergy.findFirst',
    },
    {
      name:  'Condition',
      file:  'app/api/fhir/Condition/[id]/route.ts',
      model: 'prisma.patientProblem.findFirst',
    },
  ];

  for (const r of routes) {
    // R-01 / R-02 / R-03 — flag gate
    it(`R-${r.name}-flag: ${r.name} route checks FF_FHIR_API_ENABLED and returns featureDisabledOutcome with status 404`, () => {
      const source = src(r.file);
      expect(source).toContain("isEnabled('FF_FHIR_API_ENABLED')");
      expect(source).toContain('featureDisabledOutcome');
      expect(source).toContain('status: 404');
    });

    // R-04 / R-05 / R-06 — permission + tenantScoped
    it(`R-${r.name}-perm: ${r.name} route requires fhir.patient.read + tenantScoped: true`, () => {
      const source = src(r.file);
      expect(source).toContain("permissionKey: 'fhir.patient.read'");
      expect(source).toContain('tenantScoped: true');
    });

    // R-07 / R-08 / R-09 — read-only
    it(`R-${r.name}-readonly: ${r.name} route exports GET only — no POST/PUT/PATCH/DELETE`, () => {
      const source = src(r.file);
      expect(source).toMatch(/export const GET\s*=/);
      expect(source).not.toContain('export const POST');
      expect(source).not.toContain('export const PUT');
      expect(source).not.toContain('export const PATCH');
      expect(source).not.toContain('export const DELETE');
    });

    // R-10 / R-11 / R-12 — canonical model + content type + tenant-scoped query
    it(`R-${r.name}-tenant: ${r.name} route queries ${r.model} with tenantId+id and returns application/fhir+json`, () => {
      const source = src(r.file);
      expect(source).toContain(r.model);
      expect(source).toMatch(/where:\s*\{\s*tenantId,\s*id\s*\}/);
      expect(source).toContain("'Content-Type': 'application/fhir+json'");
      expect(source).toContain('notFoundOutcome');
    });
  }
});
