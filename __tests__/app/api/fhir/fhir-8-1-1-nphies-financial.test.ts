/**
 * Phase 8.1.1 — NPHIES financial FHIR R4 read-only tests
 * (Coverage + Claim + ClaimResponse)
 *
 * Cases:
 *   CV-01..CV-03  serializeCoverage      — mapping + NPHIES profile + missing optionals
 *   CL-01..CL-03  serializeClaim         — line items + ICD-10 enrichment + NPHIES profile
 *   CR-01..CR-03  serializeClaimResponse — outcome map + total split + NPHIES profile
 *   R-01..R-12    Three [id] routes (4 invariants × 3 routes): flag gate,
 *                 permission/tenant, read-only (GET only),
 *                 tenant-scoped prisma.findFirst + fhir+json content type.
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

// ─── Mock prisma so the serializers can issue the cross-table lookups ────────

const mockEncounterCoreFindFirst    = vi.fn();
const mockPatientProblemFindFirst   = vi.fn();
const mockDiagnosisCatalogFindFirst = vi.fn();
const mockFormularyDrugFindFirst    = vi.fn();
const mockPatientInsuranceFindFirst = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    encounterCore:    { findFirst: (...a: unknown[]) => mockEncounterCoreFindFirst(...a) },
    patientProblem:   { findFirst: (...a: unknown[]) => mockPatientProblemFindFirst(...a) },
    diagnosisCatalog: { findFirst: (...a: unknown[]) => mockDiagnosisCatalogFindFirst(...a) },
    formularyDrug:    { findFirst: (...a: unknown[]) => mockFormularyDrugFindFirst(...a) },
    patientInsurance: { findFirst: (...a: unknown[]) => mockPatientInsuranceFindFirst(...a) },
  },
}));

// ─── Static imports (after mocks) ────────────────────────────────────────────

import { serializeCoverage }       from '@/lib/fhir/serializers/coverage';
import { serializeClaim }          from '@/lib/fhir/serializers/claim';
import { serializeClaimResponse }  from '@/lib/fhir/serializers/claimResponse';
import { NPHIES_PROFILES }         from '@/lib/fhir/nphies-profiles';

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const TENANT = '11111111-1111-1111-1111-111111111111';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeInsurance(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:           'cov-001',
    tenantId:     TENANT,
    patientId:    'pat-001',
    payerName:    'Bupa Arabia',
    payerId:      'PAYER-100',
    insurerId:    'INS-100',
    insurerName:  'Bupa Arabia KSA',
    policyNumber: 'POL-9988',
    memberId:     'MEM-77123',
    groupNumber:  'GRP-A',
    planType:     'Gold',
    relation:     'self',
    status:       'active',
    effectiveDate: new Date('2026-01-01'),
    expiryDate:    new Date('2026-12-31'),
    startDate:     null,
    endDate:       null,
    isPrimary:     true,
    lastEligibilityCheck: null,
    eligible:           true,
    coverageActive:     true,
    remainingBenefit:   null,
    eligibilityStatus:  'eligible',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-01T10:00:00Z'),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeBillingClaim(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:              'clm-001',
    tenantId:        TENANT,
    encounterCoreId: 'enc-001',
    claimNumber:     'CLM-T1-12345678-20260420',
    patient:         { id: 'pat-001', name: 'Ahmed Al-Farsi' },
    provider:        { department: 'OPD', encounterType: 'OPD' },
    totals:          { grandTotalActive: 1450.50, counts: { active: 3, voided: 0, total: 3 } },
    breakdown:       { byDepartment: [], byOrderKind: [] },
    lineItems: [
      {
        chargeEventId: 'ce-1', code: 'VIS-0001', name: 'Consultation',
        department: 'OPD', unitType: 'PER_VISIT', qty: 1, unitPrice: 200, total: 200,
        origin: { kind: 'VISIT' },
      },
      {
        chargeEventId: 'ce-2', code: 'MED-0001', name: 'amoxicillin',
        department: 'OPD', unitType: 'PER_DOSE', qty: 21, unitPrice: 5.5, total: 115.50,
        origin: { kind: 'MEDICATION' },
      },
    ],
    payerContext: {
      mode: 'INSURANCE',
      insuranceCompanyId: 'INS-100',
      insuranceCompanyName: 'Bupa Arabia KSA',
      memberOrPolicyRef: 'MEM-77123',
    },
    readiness: null,
    createdAt: new Date('2026-04-20T08:00:00Z'),
    createdByUserId: null,
    ...overrides,
  };
}

function makeNphiesClaim(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:                     'cr-001',
    tenantId:               TENANT,
    patientId:              'pat-001',
    insuranceId:            'INS-100',
    encounterId:            'enc-001',
    isResubmission:         false,
    originalClaimReference: 'clm-001',
    nphiesClaimId:          'NPH-AAA',
    nphiesClaimReference:   'NPH-CR-99',
    status:                 'active',
    accepted:               true,
    adjudicatedAmount:      1450.50,
    payerAmount:            1300.00,
    patientResponsibility:  150.50,
    denialReason:           null,
    denialReasonAr:         null,
    response:               { raw: 'fixture' },
    createdAt:              new Date('2026-04-21T09:00:00Z'),
    createdBy:              null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: serializeCoverage (CV-01..CV-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.1 — serializeCoverage', () => {
  // CV-01
  it('CV-01: full insurance row → active status, payor + class entries, beneficiary ref', () => {
    const fhir = serializeCoverage(makeInsurance() as never, TENANT);
    expect(fhir.resourceType).toBe('Coverage');
    expect(fhir.status).toBe('active');
    expect(fhir.beneficiary.reference).toBe('Patient/pat-001');
    expect(fhir.payor[0].display).toBe('Bupa Arabia');
    expect(fhir.payor[0].reference).toBe('Organization/INS-100');
    expect(fhir.subscriberId).toBe('MEM-77123');
    const cls = fhir.class ?? [];
    const planClass = cls.find(c => c.type.coding?.[0].code === 'plan');
    expect(planClass?.value).toBe('Gold');
    expect(fhir.period?.start).toMatch(/2026-01-01/);
    expect(fhir.period?.end).toMatch(/2026-12-31/);
    expect(fhir.relationship?.coding?.[0].code).toBe('self');
  });

  // CV-02
  it('CV-02: NPHIES profile URL appears in meta.profile', () => {
    const fhir = serializeCoverage(makeInsurance() as never, TENANT);
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.COVERAGE);
    expect(fhir.meta?.profile?.[0]).toBe('http://nphies.sa/StructureDefinition/ksa-coverage');
  });

  // CV-03
  it('CV-03: missing optional fields → no class array, no period, status maps expired→cancelled', () => {
    const fhir = serializeCoverage(
      makeInsurance({
        status: 'expired',
        groupNumber: null, planType: null, policyNumber: null,
        effectiveDate: null, expiryDate: null, relation: null,
        memberId: null, insurerId: null,
      }) as never,
      TENANT,
    );
    expect(fhir.status).toBe('cancelled');
    expect(fhir.class).toBeUndefined();
    expect(fhir.period).toBeUndefined();
    expect(fhir.relationship).toBeUndefined();
    expect(fhir.identifier).toBeUndefined();
    // Falls back to payerId for the org reference when insurerId is missing.
    expect(fhir.payor[0].reference).toBe('Organization/PAYER-100');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: serializeClaim (CL-01..CL-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.1 — serializeClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEncounterCoreFindFirst.mockResolvedValue({ id: 'enc-001', department: 'OPD' });
    mockPatientProblemFindFirst.mockResolvedValue(null);
    mockDiagnosisCatalogFindFirst.mockResolvedValue(null);
    mockFormularyDrugFindFirst.mockResolvedValue(null);
    mockFindIcd10ConceptForDiagnosis.mockResolvedValue(null);
    mockFindRxNormConceptForDrug.mockResolvedValue(null);
    mockPatientInsuranceFindFirst.mockResolvedValue({ id: 'cov-001' });
  });
  afterEach(() => vi.clearAllMocks());

  // CL-01
  it('CL-01: maps line items, total in SAR, NPHIES profile in meta.profile, type=professional for OPD', async () => {
    const fhir = await serializeClaim(makeBillingClaim() as never, TENANT);
    expect(fhir.resourceType).toBe('Claim');
    expect(fhir.status).toBe('active');
    expect(fhir.use).toBe('claim');
    expect(fhir.type.coding?.[0].code).toBe('professional');
    expect(fhir.patient.reference).toBe('Patient/pat-001');
    expect(fhir.total?.value).toBe(1450.50);
    expect(fhir.total?.currency).toBe('SAR');
    const items = fhir.item ?? [];
    expect(items.length).toBe(2);
    expect(items[0].sequence).toBe(1);
    expect(items[0].productOrService.text).toBe('Consultation');
    expect(items[0].unitPrice?.value).toBe(200);
    expect(items[1].productOrService.text).toBe('amoxicillin');
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.CLAIM);
    // Insurance reference resolved via patientInsurance lookup
    expect(fhir.insurance[0].coverage.reference).toBe('Coverage/cov-001');
    expect(fhir.insurance[0].focal).toBe(true);
  });

  // CL-02
  it('CL-02: ICD-10-AM enrichment via Phase 7.3 wiring + RxNorm enrichment for medication line', async () => {
    mockPatientProblemFindFirst.mockResolvedValue({
      code: 'DX-T2DM', icdCode: 'E11.9', problemName: 'Type 2 diabetes mellitus',
    });
    mockDiagnosisCatalogFindFirst.mockResolvedValue({ id: 'dx-001' });
    mockFindIcd10ConceptForDiagnosis.mockResolvedValue({
      id: 'c-icd-001', code: 'E11.65',
      display: 'Type 2 diabetes mellitus with hyperglycemia',
      tenantId: 'global', codeSystemId: 'cs-icd10',
      semanticType: null, status: 'active', displayAr: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    mockFormularyDrugFindFirst.mockResolvedValue({ id: 'drug-amox' });
    mockFindRxNormConceptForDrug.mockResolvedValue({
      id: 'c-rx-001', code: '723', display: 'Amoxicillin',
      tenantId: 'global', codeSystemId: 'cs-rxnorm',
      semanticType: null, status: 'active', displayAr: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const fhir = await serializeClaim(makeBillingClaim() as never, TENANT);
    const dxCodings = fhir.diagnosis?.[0].diagnosisCodeableConcept?.coding ?? [];
    const icd10s = dxCodings.filter(c => c.system === 'http://hl7.org/fhir/sid/icd-10-am');
    expect(icd10s.length).toBe(2); // free-text E11.9 + ontology E11.65
    expect(icd10s.map(c => c.code).sort()).toEqual(['E11.65', 'E11.9']);

    const medItem = fhir.item?.find(i => i.productOrService.text === 'amoxicillin');
    const rxCoding = medItem?.productOrService.coding?.find(
      c => c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm',
    );
    expect(rxCoding?.code).toBe('723');
    expect(mockFindRxNormConceptForDrug).toHaveBeenCalledWith('drug-amox');
    expect(mockFindIcd10ConceptForDiagnosis).toHaveBeenCalledWith('dx-001');
  });

  // CL-03
  it('CL-03: missing optionals → IPD encounter type → institutional, no diagnosis, self-pay placeholder', async () => {
    mockPatientInsuranceFindFirst.mockResolvedValue(null);
    const fhir = await serializeClaim(
      makeBillingClaim({
        provider: { department: 'IPD', encounterType: 'IPD' },
        payerContext: null,
        lineItems: [],
        totals: { grandTotalActive: 0, counts: { active: 0, voided: 0, total: 0 } },
      }) as never,
      TENANT,
    );
    expect(fhir.type.coding?.[0].code).toBe('institutional');
    expect(fhir.diagnosis).toBeUndefined();
    expect(fhir.item).toBeUndefined();
    expect(fhir.insurance.length).toBe(1);
    expect(fhir.insurance[0].coverage.display).toBe('self-pay');
    expect(fhir.insurance[0].coverage.reference).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: serializeClaimResponse (CR-01..CR-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.1 — serializeClaimResponse', () => {
  // CR-01
  it('CR-01: accepted+amounts → outcome=complete, total split into submitted/benefit/copay, payment block set', () => {
    const fhir = serializeClaimResponse(makeNphiesClaim() as never, TENANT);
    expect(fhir.resourceType).toBe('ClaimResponse');
    expect(fhir.outcome).toBe('complete');
    expect(fhir.disposition).toBe('Approved');
    expect(fhir.patient.reference).toBe('Patient/pat-001');
    expect(fhir.insurer.reference).toBe('Organization/INS-100');
    expect(fhir.request?.reference).toBe('Claim/clm-001');

    const totals = fhir.total ?? [];
    expect(totals.length).toBe(3);
    const codes = totals.map(t => t.category.coding?.[0].code).sort();
    expect(codes).toEqual(['benefit', 'copay', 'submitted']);
    const benefit = totals.find(t => t.category.coding?.[0].code === 'benefit');
    expect(benefit?.amount.value).toBe(1300);
    expect(benefit?.amount.currency).toBe('SAR');

    expect(fhir.payment?.amount.value).toBe(1300);
    expect(fhir.error).toBeUndefined();
    expect(fhir.identifier?.[0].value).toBe('NPH-CR-99');
  });

  // CR-02
  it('CR-02: NPHIES profile URL appears in meta.profile + item.adjudication mirrors total[]', () => {
    const fhir = serializeClaimResponse(makeNphiesClaim() as never, TENANT);
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.CLAIM_RESPONSE);
    expect(fhir.meta?.profile?.[0]).toBe('http://nphies.sa/StructureDefinition/ksa-claim-response');
    expect(fhir.item?.[0].itemSequence).toBe(1);
    expect(fhir.item?.[0].adjudication?.length).toBe(3);
  });

  // CR-03
  it('CR-03: denied response → outcome=error, error[] populated with denialReason, no payment block', () => {
    const fhir = serializeClaimResponse(
      makeNphiesClaim({
        accepted: false,
        payerAmount: null,
        denialReason: 'Service not covered under plan',
        denialReasonAr: 'الخدمة غير مغطاة',
      }) as never,
      TENANT,
    );
    expect(fhir.outcome).toBe('error');
    expect(fhir.disposition).toBe('Service not covered under plan');
    expect(fhir.payment).toBeUndefined();
    expect(fhir.error?.[0].code.coding?.[0].display).toBe('Service not covered under plan');
    expect(fhir.error?.[0].code.text).toBe('الخدمة غير مغطاة');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Route source inspection (R-01..R-12, 4 invariants × 3 routes)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.1 — Route source inspection', () => {
  const routes: { name: string; file: string; model: string }[] = [
    {
      name:  'Coverage',
      file:  'app/api/fhir/Coverage/[id]/route.ts',
      model: 'prisma.patientInsurance.findFirst',
    },
    {
      name:  'Claim',
      file:  'app/api/fhir/Claim/[id]/route.ts',
      model: 'prisma.billingClaim.findFirst',
    },
    {
      name:  'ClaimResponse',
      file:  'app/api/fhir/ClaimResponse/[id]/route.ts',
      model: 'prisma.nphiesClaim.findFirst',
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
