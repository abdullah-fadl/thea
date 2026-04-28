/**
 * Phase 8.1.2 — NPHIES eligibility FHIR R4 read-only tests
 * (CoverageEligibilityRequest + CoverageEligibilityResponse)
 *
 * Both serializers project the same NphiesEligibilityLog row into two
 * resource views. The route tests use source inspection to assert the
 * 4 invariants (flag gate, perm/tenantScoped, GET-only, tenant-scoped
 * model query + fhir+json content type) — same shape as the 8.1.1 suite.
 *
 * Cases:
 *   REQ-01..REQ-03  serializeCoverageEligibilityRequest  — happy path,
 *                   missing optional fields, NPHIES profile in meta.profile.
 *   RES-01..RES-03  serializeCoverageEligibilityResponse — happy path
 *                   (benefits + benefitPeriod + payer org), missing optional
 *                   fields (no benefits, ineligible disposition), NPHIES
 *                   profile + error[] population on error outcome.
 *   R-01..R-08      Two [id] routes × 4 invariants.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { serializeCoverageEligibilityRequest } from '@/lib/fhir/serializers/coverageEligibilityRequest';
import { serializeCoverageEligibilityResponse } from '@/lib/fhir/serializers/coverageEligibilityResponse';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const TENANT = '11111111-1111-1111-1111-111111111111';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeEligibilityLog(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:          'elig-001',
    tenantId:    TENANT,
    patientId:   'pat-001',
    insuranceId: 'cov-007',  // PatientInsurance.id (= Coverage id)
    status:      'eligible',
    eligible:    true,
    response: {
      status:         'eligible',
      eligible:       true,
      coverageActive: true,
      disposition:    'Eligible — primary coverage active',
      serviceDate:    '2026-04-22',
      benefitPeriod:  { start: '2026-01-01', end: '2026-12-31' },
      benefits: [
        {
          serviceCategory:        'consult',
          serviceCategoryDisplay: 'Outpatient consultation',
          covered:                true,
          copay:                  20,
          deductible:             100,
          maxBenefit:             5000,
          usedBenefit:            1500,
          remainingBenefit:       3500,
          authorizationRequired:  false,
          excluded:               false,
          notes:                  'Primary care visits covered',
        },
        {
          serviceCategory:        'pharmacy',
          serviceCategoryDisplay: 'Pharmacy',
          covered:                true,
          coinsurance:            20,
          authorizationRequired:  true,
          excluded:               false,
        },
      ],
    },
    createdAt:   new Date('2026-04-22T10:30:00Z'),
    createdBy:   'usr-frontdesk-1',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: serializeCoverageEligibilityRequest (REQ-01..REQ-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.2 — serializeCoverageEligibilityRequest', () => {
  // REQ-01
  it('REQ-01: full log → active status, patient/insurer/coverage refs, enterer set, servicedDate from response', () => {
    const fhir = serializeCoverageEligibilityRequest(makeEligibilityLog() as never, TENANT);
    expect(fhir.resourceType).toBe('CoverageEligibilityRequest');
    expect(fhir.id).toBe('elig-001');
    expect(fhir.status).toBe('active');
    expect(fhir.purpose).toEqual(['benefits', 'validation']);
    expect(fhir.patient.reference).toBe('Patient/pat-001');
    expect(fhir.insurer.reference).toBe('Organization/cov-007');
    expect(fhir.created).toBe('2026-04-22T10:30:00.000Z');
    expect(fhir.servicedDate).toBe('2026-04-22');
    expect(fhir.enterer?.reference).toBe('Practitioner/usr-frontdesk-1');
    const ins = fhir.insurance ?? [];
    expect(ins.length).toBe(1);
    expect(ins[0].focal).toBe(true);
    expect(ins[0].coverage.reference).toBe('Coverage/cov-007');
  });

  // REQ-02
  it('REQ-02: missing createdBy + missing response.serviceDate → no enterer, servicedDate falls back to createdAt date', () => {
    const fhir = serializeCoverageEligibilityRequest(
      makeEligibilityLog({
        createdBy: null,
        response:  { eligible: true, status: 'eligible' },  // no serviceDate
      }) as never,
      TENANT,
    );
    expect(fhir.enterer).toBeUndefined();
    expect(fhir.servicedDate).toBe('2026-04-22'); // YYYY-MM-DD slice of createdAt
    // Insurance + insurer still emitted — the request is valid even without enterer.
    expect(fhir.insurer.reference).toBe('Organization/cov-007');
    expect(fhir.insurance?.[0].coverage.reference).toBe('Coverage/cov-007');
  });

  // REQ-03
  it('REQ-03: NPHIES profile URL appears in meta.profile', () => {
    const fhir = serializeCoverageEligibilityRequest(makeEligibilityLog() as never, TENANT);
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST);
    expect(fhir.meta?.profile?.[0]).toBe(
      'http://nphies.sa/StructureDefinition/ksa-coverage-eligibility-request',
    );
    expect(fhir.meta?.lastUpdated).toBe('2026-04-22T10:30:00.000Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: serializeCoverageEligibilityResponse (RES-01..RES-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.2 — serializeCoverageEligibilityResponse', () => {
  // RES-01
  it('RES-01: eligible log → outcome=complete, disposition surfaced, insurance[].item[] with benefit[] for each category', () => {
    const fhir = serializeCoverageEligibilityResponse(makeEligibilityLog() as never, TENANT);
    expect(fhir.resourceType).toBe('CoverageEligibilityResponse');
    expect(fhir.outcome).toBe('complete');
    expect(fhir.disposition).toBe('Eligible — primary coverage active');
    expect(fhir.patient.reference).toBe('Patient/pat-001');
    expect(fhir.insurer.reference).toBe('Organization/cov-007');
    expect(fhir.request.reference).toBe('CoverageEligibilityRequest/elig-001');
    expect(fhir.requestor?.reference).toBe('Practitioner/usr-frontdesk-1');

    const ins = fhir.insurance ?? [];
    expect(ins.length).toBe(1);
    expect(ins[0].coverage.reference).toBe('Coverage/cov-007');
    expect(ins[0].inforce).toBe(true);
    expect(ins[0].benefitPeriod?.start).toBe('2026-01-01');
    expect(ins[0].benefitPeriod?.end).toBe('2026-12-31');

    const items = ins[0].item ?? [];
    expect(items.length).toBe(2);

    const consult = items.find(i => i.name === 'Outpatient consultation');
    expect(consult?.category?.coding?.[0].code).toBe('consult');
    expect(consult?.authorizationRequired).toBe(false);
    expect(consult?.description).toBe('Primary care visits covered');
    const consultBenefits = consult?.benefit ?? [];
    const copay = consultBenefits.find(b => b.type.coding?.[0].code === 'copay');
    expect(copay?.allowedMoney?.value).toBe(20);
    expect(copay?.allowedMoney?.currency).toBe('SAR');
    const benefit = consultBenefits.find(b => b.type.coding?.[0].code === 'benefit');
    expect(benefit?.allowedMoney?.value).toBe(5000);
    expect(benefit?.usedMoney?.value).toBe(1500);

    const pharmacy = items.find(i => i.name === 'Pharmacy');
    expect(pharmacy?.authorizationRequired).toBe(true);
    const coinsurance = pharmacy?.benefit?.find(b => b.type.coding?.[0].code === 'coinsurance');
    expect(coinsurance?.allowedUnsignedInt).toBe(20);
  });

  // RES-02
  it('RES-02: NPHIES profile URL appears in meta.profile + request ref points back at sibling resource', () => {
    const fhir = serializeCoverageEligibilityResponse(makeEligibilityLog() as never, TENANT);
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.COVERAGE_ELIGIBILITY_RESPONSE);
    expect(fhir.meta?.profile?.[0]).toBe(
      'http://nphies.sa/StructureDefinition/ksa-coverage-eligibility-response',
    );
    // The request reference uses the same id — request and response are two
    // projections of one log row.
    expect(fhir.request.reference).toBe('CoverageEligibilityRequest/elig-001');
    expect(fhir.request.type).toBe('CoverageEligibilityRequest');
  });

  // RES-03
  it('RES-03: error response → outcome=error, error[] populated, no benefits, status=pending → outcome=queued (separate sub-case)', () => {
    // Sub-case A: error outcome
    const errorFhir = serializeCoverageEligibilityResponse(
      makeEligibilityLog({
        status:   'error',
        eligible: false,
        response: {
          status:         'error',
          eligible:       false,
          coverageActive: false,
          disposition:    'Payer service unavailable',
          errors:         ['Connection timeout', 'Payer returned HTTP 504'],
          errorsAr:       ['انتهت مهلة الاتصال', 'استجابة من الدافع HTTP 504'],
        },
      }) as never,
      TENANT,
    );
    expect(errorFhir.outcome).toBe('error');
    expect(errorFhir.disposition).toBe('Payer service unavailable');
    expect(errorFhir.error?.length).toBe(2);
    expect(errorFhir.error?.[0].code.coding?.[0].display).toBe('Connection timeout');
    expect(errorFhir.error?.[0].code.text).toBe('انتهت مهلة الاتصال');
    expect(errorFhir.insurance).toBeUndefined(); // outcome=error, no items, no insurance block

    // Sub-case B: pending → queued
    const pendingFhir = serializeCoverageEligibilityResponse(
      makeEligibilityLog({
        status:   'pending',
        eligible: false,
        response: { status: 'pending', eligible: false, coverageActive: false },
        createdBy: null,
      }) as never,
      TENANT,
    );
    expect(pendingFhir.outcome).toBe('queued');
    expect(pendingFhir.requestor).toBeUndefined();
    expect(pendingFhir.error).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Route source inspection (R-01..R-08, 4 invariants × 2 routes)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.2 — Route source inspection', () => {
  const routes: { name: string; file: string; model: string }[] = [
    {
      name:  'CoverageEligibilityRequest',
      file:  'app/api/fhir/CoverageEligibilityRequest/[id]/route.ts',
      model: 'prisma.nphiesEligibilityLog.findFirst',
    },
    {
      name:  'CoverageEligibilityResponse',
      file:  'app/api/fhir/CoverageEligibilityResponse/[id]/route.ts',
      model: 'prisma.nphiesEligibilityLog.findFirst',
    },
  ];

  for (const r of routes) {
    // R-01 / R-02 — flag gate
    it(`R-${r.name}-flag: ${r.name} route checks FF_FHIR_API_ENABLED and returns featureDisabledOutcome with status 404`, () => {
      const source = src(r.file);
      expect(source).toContain("isEnabled('FF_FHIR_API_ENABLED')");
      expect(source).toContain('featureDisabledOutcome');
      expect(source).toContain('status: 404');
    });

    // R-03 / R-04 — permission + tenantScoped
    it(`R-${r.name}-perm: ${r.name} route requires fhir.patient.read + tenantScoped: true`, () => {
      const source = src(r.file);
      expect(source).toContain("permissionKey: 'fhir.patient.read'");
      expect(source).toContain('tenantScoped: true');
    });

    // R-05 / R-06 — read-only
    it(`R-${r.name}-readonly: ${r.name} route exports GET only — no POST/PUT/PATCH/DELETE`, () => {
      const source = src(r.file);
      expect(source).toMatch(/export const GET\s*=/);
      expect(source).not.toContain('export const POST');
      expect(source).not.toContain('export const PUT');
      expect(source).not.toContain('export const PATCH');
      expect(source).not.toContain('export const DELETE');
    });

    // R-07 / R-08 — canonical model + content type + tenant-scoped query
    it(`R-${r.name}-tenant: ${r.name} route queries ${r.model} with tenantId+id and returns application/fhir+json`, () => {
      const source = src(r.file);
      expect(source).toContain(r.model);
      expect(source).toMatch(/where:\s*\{\s*tenantId,\s*id\s*\}/);
      expect(source).toContain("'Content-Type': 'application/fhir+json'");
      expect(source).toContain('notFoundOutcome');
    });
  }
});
