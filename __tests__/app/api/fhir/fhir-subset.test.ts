/**
 * Phase 5.4 — FHIR R4 read-only subset tests
 *
 * Cases:
 *  FS-01..FS-03  errors.ts — operationOutcomeError / notFoundOutcome / featureDisabledOutcome
 *  FS-04..FS-06  serializePatient — identifiers, name/gender, active=false when MERGED
 *  FS-07..FS-09  serializeEncounter — status map, class map (ER→EMER, OPD→AMB), subject ref
 *  FS-10..FS-12  serializeObservation — status map, LOINC attached when concept found,
 *                LOINC omitted when findConceptByCode returns null
 *  FS-13..FS-15  Route source inspection — flag gate present, fhir.patient.read permission,
 *                no POST/PUT exports (read-only)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─── Mock findConceptByCode before any serializer import ─────────────────────

const mockFindConceptByCode = vi.fn();
vi.mock('@/lib/ontology/lookup', () => ({
  findConceptByCode: (...args: unknown[]) => mockFindConceptByCode(...args),
}));

// ─── Static imports (must come after vi.mock calls) ──────────────────────────

import { operationOutcomeError, notFoundOutcome, featureDisabledOutcome } from '@/lib/fhir/errors';
import { serializePatient } from '@/lib/fhir/serializers/patient';
import { serializeEncounter } from '@/lib/fhir/serializers/encounter';
import { serializeObservation } from '@/lib/fhir/serializers/observation';

// ─── Source helper ────────────────────────────────────────────────────────────

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePatient(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:         'pat-001',
    tenantId:   'tenant-001',
    mrn:        'MRN-001',
    firstName:  'Ahmed',
    middleName: 'Hassan',
    lastName:   'Al-Farsi',
    fullName:   'Ahmed Hassan Al-Farsi',
    nameNormalized: 'ahmed hassan al-farsi',
    dob:        new Date('1985-03-12'),
    gender:     'MALE',
    nationalId: '1234567890',
    iqama:      null,
    passport:   null,
    identifiers: null,
    status:     'KNOWN',
    mobile:     '+966501234567',
    email:      'ahmed@example.com',
    nationality: 'SA',
    bloodType:  null,
    city:       null,
    knownAllergies: null,
    emergencyContact: null,
    insuranceCompanyName: null,
    links: null,
    mergedIntoPatientId: null,
    mergedAt: null,
    nationalId_hash: null,
    iqama_hash: null,
    passport_hash: null,
    fullName_hash: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-04-24'),
    createdByUserId: null,
    updatedByUserId: null,
    ...overrides,
  };
}

function makeEncounter(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:            'enc-001',
    tenantId:      'tenant-001',
    patientId:     'pat-001',
    encounterType: 'OPD',
    status:        'ACTIVE',
    department:    'Cardiology',
    openedAt:      new Date('2026-04-01T08:00:00Z'),
    closedAt:      null,
    sourceSystem:  null,
    sourceId:      null,
    createdAt:     new Date('2026-04-01'),
    updatedAt:     new Date('2026-04-01'),
    createdByUserId: null,
    closedByUserId: null,
    ...overrides,
  };
}

function makeLabResult(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:           'obs-001',
    tenantId:     'tenant-001',
    testId:       null,
    orderId:      'order-001',
    patientId:    'pat-001',
    encounterId:  'enc-001',
    testCode:     '2339-0',
    testName:     'Glucose',
    testNameAr:   'جلوكوز',
    parameters:   null,
    status:       'VERIFIED',
    comments:     null,
    collectedAt:  new Date('2026-04-01T09:00:00Z'),
    resultedAt:   new Date('2026-04-01T11:00:00Z'),
    verifiedAt:   new Date('2026-04-01T12:00:00Z'),
    verifiedBy:   null,
    createdAt:    new Date('2026-04-01'),
    updatedAt:    new Date('2026-04-01'),
    createdByUserId: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: errors.ts (FS-01 .. FS-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Subset — errors.ts', () => {
  // FS-01
  it('FS-01: operationOutcomeError returns a valid OperationOutcome with given fields', () => {
    const oo = operationOutcomeError('error', 'not-found', 'Patient/xyz not found');
    expect(oo.resourceType).toBe('OperationOutcome');
    expect(oo.issue).toHaveLength(1);
    expect(oo.issue[0].severity).toBe('error');
    expect(oo.issue[0].code).toBe('not-found');
    expect(oo.issue[0].diagnostics).toBe('Patient/xyz not found');
  });

  // FS-02
  it('FS-02: notFoundOutcome embeds resource type and id in diagnostics', () => {
    const oo = notFoundOutcome('Encounter', 'enc-abc');
    expect(oo.resourceType).toBe('OperationOutcome');
    expect(oo.issue[0].code).toBe('not-found');
    expect(oo.issue[0].diagnostics).toContain('Encounter/enc-abc');
  });

  // FS-03
  it('FS-03: featureDisabledOutcome uses not-supported code and mentions the env var', () => {
    const oo = featureDisabledOutcome();
    expect(oo.resourceType).toBe('OperationOutcome');
    expect(oo.issue[0].severity).toBe('error');
    expect(oo.issue[0].code).toBe('not-supported');
    expect(oo.issue[0].diagnostics).toContain('THEA_FF_FHIR_API_ENABLED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: serializePatient (FS-04 .. FS-06)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Subset — serializePatient', () => {
  // FS-04
  it('FS-04: maps mrn and nationalId into FHIR identifiers with correct systems', () => {
    const fhir = serializePatient(makePatient() as any);
    expect(fhir.resourceType).toBe('Patient');
    expect(fhir.identifier).toBeDefined();
    const systems = fhir.identifier!.map(i => i.system);
    expect(systems).toContain('https://thea.com.sa/fhir/mrn');
    expect(systems).toContain('https://nphies.sa/identifier/nid');
  });

  // FS-05
  it('FS-05: maps name, gender, birthDate; active=true for KNOWN status', () => {
    const fhir = serializePatient(makePatient({ gender: 'FEMALE', status: 'KNOWN' }) as any);
    expect(fhir.gender).toBe('female');
    expect(fhir.active).toBe(true);
    expect(fhir.name?.[0].family).toBe('Al-Farsi');
    expect(fhir.name?.[0].given).toContain('Ahmed');
    expect(fhir.birthDate).toBe('1985-03-12');
  });

  // FS-06
  it('FS-06: MERGED status → active=false; null mobile/email/mrn produce no telecom/identifier', () => {
    const fhir = serializePatient(
      makePatient({ status: 'MERGED', mobile: null, email: null, mrn: null, nationalId: null }) as any,
    );
    expect(fhir.active).toBe(false);
    expect(fhir.telecom).toBeUndefined();
    expect(fhir.identifier).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: serializeEncounter (FS-07 .. FS-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Subset — serializeEncounter', () => {
  // FS-07
  it('FS-07: ACTIVE status → in-progress; OPD type → AMB class code', () => {
    const fhir = serializeEncounter(makeEncounter({ status: 'ACTIVE', encounterType: 'OPD' }) as any);
    expect(fhir.resourceType).toBe('Encounter');
    expect(fhir.status).toBe('in-progress');
    expect(fhir.class.code).toBe('AMB');
  });

  // FS-08
  it('FS-08: ER type → EMER class; CLOSED status → finished; period.end is set', () => {
    const fhir = serializeEncounter(
      makeEncounter({ encounterType: 'ER', status: 'CLOSED', closedAt: new Date('2026-04-01T18:00:00Z') }) as any,
    );
    expect(fhir.class.code).toBe('EMER');
    expect(fhir.status).toBe('finished');
    expect(fhir.period?.end).toMatch(/2026-04-01/);
  });

  // FS-09
  it('FS-09: subject uses Patient/{patientId}; serviceType.text reflects department', () => {
    const fhir = serializeEncounter(makeEncounter() as any);
    expect(fhir.subject?.reference).toBe('Patient/pat-001');
    expect(fhir.subject?.type).toBe('Patient');
    expect(fhir.serviceType?.text).toBe('Cardiology');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: serializeObservation (FS-10 .. FS-12)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Subset — serializeObservation', () => {
  const TENANT = 'tenant-001';

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  // FS-10
  it('FS-10: VERIFIED → final; category=laboratory; subject/encounter refs set', async () => {
    mockFindConceptByCode.mockResolvedValue(null);
    const fhir = await serializeObservation(makeLabResult({ status: 'VERIFIED' }) as any, TENANT);
    expect(fhir.resourceType).toBe('Observation');
    expect(fhir.status).toBe('final');
    expect(fhir.category?.[0].coding?.[0].code).toBe('laboratory');
    expect(fhir.subject?.reference).toBe('Patient/pat-001');
    expect(fhir.encounter?.reference).toBe('Encounter/enc-001');
  });

  // FS-11
  it('FS-11: when findConceptByCode returns a LOINC concept, LOINC coding is appended', async () => {
    mockFindConceptByCode.mockResolvedValue({
      id: 'c-001', code: '2339-0', display: 'Glucose [Mass/volume] in Blood',
      tenantId: 'global', codeSystemId: 'cs-loinc', semanticType: null,
      status: 'active', displayAr: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const fhir = await serializeObservation(makeLabResult() as any, TENANT);
    const loincCoding = fhir.code.coding?.find(c => c.system === 'http://loinc.org');
    expect(loincCoding).toBeDefined();
    expect(loincCoding?.code).toBe('2339-0');
    expect(loincCoding?.display).toContain('Glucose');
  });

  // FS-12
  it('FS-12: when findConceptByCode returns null, only Thea internal coding is present', async () => {
    mockFindConceptByCode.mockResolvedValue(null);
    const fhir = await serializeObservation(makeLabResult({ testCode: 'UNKNOWN-999' }) as any, TENANT);
    const loincCoding = fhir.code.coding?.find(c => c.system === 'http://loinc.org');
    expect(loincCoding).toBeUndefined();
    expect(fhir.code.coding?.[0].system).toContain('thea.com.sa');
    expect(fhir.code.coding?.[0].code).toBe('UNKNOWN-999');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Route source inspection (FS-13 .. FS-15)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR Subset — Route source inspection', () => {
  const routeFiles = [
    'app/api/fhir/Patient/route.ts',
    'app/api/fhir/Patient/[id]/route.ts',
    'app/api/fhir/Encounter/[id]/route.ts',
    'app/api/fhir/Observation/[id]/route.ts',
  ];

  // FS-13
  it('FS-13: all four FHIR routes check FF_FHIR_API_ENABLED and call featureDisabledOutcome', () => {
    for (const file of routeFiles) {
      const source = src(file);
      expect(source, `${file} missing flag check`).toContain("isEnabled('FF_FHIR_API_ENABLED')");
      expect(source, `${file} missing featureDisabledOutcome`).toContain('featureDisabledOutcome');
    }
  });

  // FS-14
  it('FS-14: all four FHIR routes require fhir.patient.read permission and tenantScoped: true', () => {
    for (const file of routeFiles) {
      const source = src(file);
      expect(source, `${file} wrong permission`).toContain("permissionKey: 'fhir.patient.read'");
      expect(source, `${file} missing tenantScoped`).toContain('tenantScoped: true');
    }
  });

  // FS-15
  it('FS-15: routes are read-only — no POST or PUT exports in any route file', () => {
    for (const file of routeFiles) {
      const source = src(file);
      expect(source, `${file} must not export POST`).not.toContain('export const POST');
      expect(source, `${file} must not export PUT`).not.toContain('export const PUT');
    }
  });
});
