/**
 * Phase 8.1.3 — NPHIES supporting actors + envelope FHIR R4 tests
 * (Practitioner + PractitionerRole + Organization + Location + Bundle).
 *
 * Serializer unit tests cover the four actor projections; bundle tests
 * cover the envelope construction (type=message, MessageHeader-first,
 * focal in entries, urn:uuid internal references). Route tests use source
 * inspection — same shape as the 8.1.1 / 8.1.2 suites — to assert the 4
 * invariants (flag gate, perm/tenantScoped, GET-only, tenant-scoped query
 * + fhir+json content type).
 *
 * Cases:
 *   PR-01..PR-03  serializePractitioner       — happy path with profile,
 *                 missing profile (no qualification), NPHIES profile in
 *                 meta.profile.
 *   PRR-01..PRR-03 serializePractitionerRole  — happy path with provider,
 *                 missing provider (no code/specialty), parallel clinics
 *                 → multiple Location refs.
 *   ORG-01..ORG-03 serializeOrganization      — facility (Hospital),
 *                 payer (BillingPayer), NPHIES profile + type discriminator.
 *   LOC-01..LOC-03 serializeLocation          — happy path with type +
 *                 shortCode, status mapping, NPHIES profile.
 *   BND-01..BND-04 buildNphiesMessageBundle   — type=message + profile,
 *                 first entry is MessageHeader, focal resource is in
 *                 entries with urn:uuid fullUrl, MessageHeader.focus
 *                 references the focal urn:uuid.
 *   R-*           Four [id] routes × 4 invariants (16 cases).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { serializePractitioner } from '@/lib/fhir/serializers/practitioner';
import { serializePractitionerRole } from '@/lib/fhir/serializers/practitionerRole';
import { serializeOrganization } from '@/lib/fhir/serializers/organization';
import { serializeLocation } from '@/lib/fhir/serializers/location';
import { buildNphiesMessageBundle } from '@/lib/fhir/bundleBuilder';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';
import { NPHIES_EVENTS } from '@/lib/fhir/nphies-events';
import type { FhirResource } from '@/lib/fhir/resources/types';

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

const TENANT  = '11111111-1111-1111-1111-111111111111';
const NOW     = new Date('2026-04-26T09:00:00Z');

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:             'prov-001',
    tenantId:       TENANT,
    displayName:    'Dr. Sara Al-Otaibi',
    email:          'sara.alotaibi@thea.com.sa',
    staffId:        'EMP-9001',
    employmentType: 'FULL_TIME',
    shortCode:      'SAO',
    specialtyCode:  'CARDIO',
    isArchived:     false,
    archivedAt:     null,
    createdAt:      NOW,
    updatedAt:      NOW,
    createdBy:      null,
    updatedBy:      null,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:                      'prof-001',
    tenantId:                TENANT,
    providerId:              'prov-001',
    licenseNumber:           'LIC-44512',
    unitIds:                 [],
    specialtyIds:            [],
    consultationServiceCode: null,
    level:                   'CONSULTANT',
    createdAt:               NOW,
    updatedAt:               NOW,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:                'asg-001',
    tenantId:          TENANT,
    providerId:        'prov-001',
    primaryClinicId:   'clinic-A',
    parallelClinicIds: ['clinic-B', 'clinic-C'],
    createdAt:         NOW,
    updatedAt:         NOW,
    ...overrides,
  };
}

function makeHospital(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:        'hosp-001',
    tenantId:  TENANT,
    groupId:   'grp-001',
    name:      'Thea Medical Center — Riyadh',
    code:      'TMC-RYD',
    isActive:  true,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makePayer(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:        'pay-001',
    tenantId:  TENANT,
    name:      'Bupa Arabia',
    nameAr:    'بوبا العربية',
    code:      'BUPA',
    status:    'ACTIVE',
    metadata:  null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeFacility(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:        'fac-001',
    tenantId:  TENANT,
    name:      'Main Outpatient Building',
    shortCode: 'OPB-1',
    type:      'OUTPATIENT',
    status:    'active',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: serializePractitioner (PR-01..PR-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.3 — serializePractitioner', () => {
  // PR-01
  it('PR-01: provider + profile → identifier, telecom, qualification, active=true', () => {
    const fhir = serializePractitioner(
      makeProvider() as never,
      makeProfile() as never,
      TENANT,
    );
    expect(fhir.resourceType).toBe('Practitioner');
    expect(fhir.id).toBe('prov-001');
    expect(fhir.active).toBe(true);
    expect(fhir.name?.[0].family).toBe('Al-Otaibi');
    expect(fhir.name?.[0].given).toEqual(['Dr.', 'Sara']);
    expect(fhir.telecom?.[0]).toEqual({ system: 'email', value: 'sara.alotaibi@thea.com.sa', use: 'work' });
    const ids = fhir.identifier ?? [];
    expect(ids.find(i => i.system?.endsWith('staff-id'))?.value).toBe('EMP-9001');
    expect(ids.find(i => i.system?.endsWith('short-code'))?.value).toBe('SAO');
    expect(ids.find(i => i.system?.includes('practitioner-license'))?.value).toBe('LIC-44512');
    const qual = fhir.qualification ?? [];
    expect(qual.length).toBe(1);
    expect(qual[0].code.coding?.[0].code).toBe('CONSULTANT');
    expect(qual[0].identifier?.[0].value).toBe('LIC-44512');
  });

  // PR-02
  it('PR-02: archived provider, no profile, no email → active=false, no qualification, no telecom, no license id', () => {
    const fhir = serializePractitioner(
      makeProvider({ isArchived: true, email: null, staffId: null, shortCode: null }) as never,
      null,
      TENANT,
    );
    expect(fhir.active).toBe(false);
    expect(fhir.qualification).toBeUndefined();
    expect(fhir.telecom).toBeUndefined();
    expect(fhir.identifier).toBeUndefined();
    expect(fhir.name?.[0].family).toBe('Al-Otaibi');
  });

  // PR-03
  it('PR-03: NPHIES profile URL appears in meta.profile + lastUpdated mirrors updatedAt', () => {
    const fhir = serializePractitioner(makeProvider() as never, makeProfile() as never, TENANT);
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.PRACTITIONER);
    expect(fhir.meta?.profile?.[0]).toBe('http://nphies.sa/StructureDefinition/ksa-practitioner');
    expect(fhir.meta?.lastUpdated).toBe('2026-04-26T09:00:00.000Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: serializePractitionerRole (PRR-01..PRR-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.3 — serializePractitionerRole', () => {
  // PRR-01
  it('PRR-01: assignment + provider → practitioner ref, organization ref (primary clinic), code+specialty from provider', () => {
    const fhir = serializePractitionerRole(
      makeAssignment() as never,
      makeProvider() as never,
      TENANT,
    );
    expect(fhir.resourceType).toBe('PractitionerRole');
    expect(fhir.practitioner?.reference).toBe('Practitioner/prov-001');
    expect(fhir.organization?.reference).toBe('Organization/clinic-A');
    expect(fhir.code?.[0].coding?.[0].code).toBe('FULL_TIME');
    expect(fhir.specialty?.[0].coding?.[0].code).toBe('CARDIO');
    expect(fhir.active).toBe(true);
  });

  // PRR-02
  it('PRR-02: parallel clinics → multiple Location refs (primary + parallels), in order', () => {
    const fhir = serializePractitionerRole(
      makeAssignment() as never,
      null,
      TENANT,
    );
    const locs = fhir.location ?? [];
    expect(locs.map(l => l.reference)).toEqual([
      'Location/clinic-A',
      'Location/clinic-B',
      'Location/clinic-C',
    ]);
    // No provider → no role code, no specialty, no active
    expect(fhir.code).toBeUndefined();
    expect(fhir.specialty).toBeUndefined();
    expect(fhir.active).toBeUndefined();
  });

  // PRR-03
  it('PRR-03: no primaryClinicId → no organization ref + no Location entry from primary slot', () => {
    const fhir = serializePractitionerRole(
      makeAssignment({ primaryClinicId: null, parallelClinicIds: [] }) as never,
      makeProvider() as never,
      TENANT,
    );
    expect(fhir.organization).toBeUndefined();
    expect(fhir.location).toBeUndefined();
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.PRACTITIONER_ROLE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: serializeOrganization (ORG-01..ORG-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.3 — serializeOrganization', () => {
  // ORG-01
  it('ORG-01: facility (Hospital) → type=prov, identifier=hospital-code, active mirrors isActive', () => {
    const fhir = serializeOrganization(
      { kind: 'facility', row: makeHospital() as never },
      TENANT,
    );
    expect(fhir.resourceType).toBe('Organization');
    expect(fhir.id).toBe('hosp-001');
    expect(fhir.name).toBe('Thea Medical Center — Riyadh');
    expect(fhir.type?.[0].coding?.[0].code).toBe('prov');
    expect(fhir.identifier?.[0].system).toContain('hospital-code');
    expect(fhir.identifier?.[0].value).toBe('TMC-RYD');
    expect(fhir.active).toBe(true);
  });

  // ORG-02
  it('ORG-02: payer (BillingPayer) → type=pay, identifier=payer-license, active derived from status=ACTIVE', () => {
    const fhir = serializeOrganization(
      { kind: 'payer', row: makePayer() as never },
      TENANT,
    );
    expect(fhir.id).toBe('pay-001');
    expect(fhir.name).toBe('Bupa Arabia');
    expect(fhir.type?.[0].coding?.[0].code).toBe('pay');
    expect(fhir.identifier?.[0].system).toContain('payer-license');
    expect(fhir.identifier?.[0].value).toBe('BUPA');
    expect(fhir.active).toBe(true);

    const inactive = serializeOrganization(
      { kind: 'payer', row: makePayer({ status: 'INACTIVE' }) as never },
      TENANT,
    );
    expect(inactive.active).toBe(false);
  });

  // ORG-03
  it('ORG-03: NPHIES profile URL appears in meta.profile for both facility and payer flavors', () => {
    const facility = serializeOrganization({ kind: 'facility', row: makeHospital() as never }, TENANT);
    const payer    = serializeOrganization({ kind: 'payer',    row: makePayer()    as never }, TENANT);
    expect(facility.meta?.profile).toContain(NPHIES_PROFILES.ORGANIZATION);
    expect(payer.meta?.profile).toContain(NPHIES_PROFILES.ORGANIZATION);
    expect(facility.meta?.profile?.[0]).toBe('http://nphies.sa/StructureDefinition/ksa-organization');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: serializeLocation (LOC-01..LOC-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.3 — serializeLocation', () => {
  // LOC-01
  it('LOC-01: facility with type + shortCode → name, alias, identifier, type, mode=instance', () => {
    const fhir = serializeLocation(makeFacility() as never, TENANT);
    expect(fhir.resourceType).toBe('Location');
    expect(fhir.id).toBe('fac-001');
    expect(fhir.name).toBe('Main Outpatient Building');
    expect(fhir.alias).toEqual(['OPB-1']);
    expect(fhir.identifier?.[0].value).toBe('OPB-1');
    expect(fhir.type?.[0].coding?.[0].code).toBe('OUTPATIENT');
    expect(fhir.mode).toBe('instance');
    expect(fhir.status).toBe('active');
  });

  // LOC-02
  it('LOC-02: status mapping (suspended/inactive/unknown→active) + missing type/shortCode', () => {
    const susp = serializeLocation(makeFacility({ status: 'suspended', type: null, shortCode: null }) as never, TENANT);
    expect(susp.status).toBe('suspended');
    expect(susp.type).toBeUndefined();
    expect(susp.alias).toBeUndefined();
    expect(susp.identifier).toBeUndefined();

    const inactive = serializeLocation(makeFacility({ status: 'inactive' }) as never, TENANT);
    expect(inactive.status).toBe('inactive');

    const unknown = serializeLocation(makeFacility({ status: 'pending' }) as never, TENANT);
    expect(unknown.status).toBe('active'); // fallback
  });

  // LOC-03
  it('LOC-03: NPHIES profile URL appears in meta.profile', () => {
    const fhir = serializeLocation(makeFacility() as never, TENANT);
    expect(fhir.meta?.profile).toContain(NPHIES_PROFILES.LOCATION);
    expect(fhir.meta?.profile?.[0]).toBe('http://nphies.sa/StructureDefinition/ksa-location');
    expect(fhir.meta?.lastUpdated).toBe('2026-04-26T09:00:00.000Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: buildNphiesMessageBundle (BND-01..BND-04)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.3 — buildNphiesMessageBundle', () => {
  function focal(): FhirResource {
    return {
      resourceType: 'CoverageEligibilityRequest',
      id: 'elig-001',
    };
  }

  function patient(): FhirResource {
    return { resourceType: 'Patient', id: 'pat-001' };
  }

  function coverage(): FhirResource {
    return { resourceType: 'Coverage', id: 'cov-007' };
  }

  // BND-01
  it('BND-01: bundle is type=message with NPHIES MESSAGE_BUNDLE profile + timestamp', () => {
    const { bundle } = buildNphiesMessageBundle({
      eventCoding:           NPHIES_EVENTS.ELIGIBILITY,
      senderOrgId:           'hosp-001',
      receiverOrgId:         'pay-001',
      focalResource:         focal(),
      contributingResources: [patient(), coverage()],
      tenantId:              TENANT,
      bundleId:              'bundle-001',
      messageHeaderId:       'mh-001',
      timestamp:             '2026-04-26T09:00:00.000Z',
    });
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('message');
    expect(bundle.id).toBe('bundle-001');
    expect(bundle.timestamp).toBe('2026-04-26T09:00:00.000Z');
    expect(bundle.meta?.profile).toContain(NPHIES_PROFILES.MESSAGE_BUNDLE);
  });

  // BND-02
  it('BND-02: first entry is MessageHeader, has eventCoding and source/destination endpoints', () => {
    const { bundle } = buildNphiesMessageBundle({
      eventCoding:    NPHIES_EVENTS.CLAIM,
      senderOrgId:    'hosp-001',
      receiverOrgId:  'pay-001',
      focalResource:  focal(),
      tenantId:       TENANT,
      messageHeaderId:'mh-001',
    });
    const first = bundle.entry?.[0];
    expect(first?.resource?.resourceType).toBe('MessageHeader');
    const mh = first?.resource as { eventCoding: { code: string }; source: { endpoint: string }; destination: { endpoint: string }[]; sender: { reference: string } };
    expect(mh.eventCoding.code).toBe('claim-request');
    expect(mh.source.endpoint).toBe('urn:uuid:hosp-001');
    expect(mh.destination[0].endpoint).toBe('urn:uuid:pay-001');
    expect(mh.sender.reference).toBe('Organization/hosp-001');
    expect(first?.fullUrl).toBe('urn:uuid:mh-001');
    expect(first?.resource?.meta?.profile).toContain(NPHIES_PROFILES.MESSAGE_HEADER);
  });

  // BND-03
  it('BND-03: focal + contributing resources are present as entries with urn:uuid fullUrls', () => {
    const { bundle, fullUrls } = buildNphiesMessageBundle({
      eventCoding:           NPHIES_EVENTS.ELIGIBILITY,
      senderOrgId:           'hosp-001',
      receiverOrgId:         'pay-001',
      focalResource:         focal(),
      contributingResources: [patient(), coverage()],
      tenantId:              TENANT,
    });
    const entries = bundle.entry ?? [];
    // 1 MessageHeader + 1 focal + 2 contributing = 4
    expect(entries.length).toBe(4);
    expect(entries[1].resource?.resourceType).toBe('CoverageEligibilityRequest');
    expect(entries[1].fullUrl).toBe('urn:uuid:elig-001');
    expect(entries[2].resource?.resourceType).toBe('Patient');
    expect(entries[2].fullUrl).toBe('urn:uuid:pat-001');
    expect(entries[3].resource?.resourceType).toBe('Coverage');
    expect(entries[3].fullUrl).toBe('urn:uuid:cov-007');
    expect(fullUrls.get('elig-001')).toBe('urn:uuid:elig-001');
    expect(fullUrls.get('pat-001')).toBe('urn:uuid:pat-001');
    expect(fullUrls.get('cov-007')).toBe('urn:uuid:cov-007');
  });

  // BND-04
  it('BND-04: MessageHeader.focus[0].reference resolves to the focal resource urn:uuid', () => {
    const { bundle } = buildNphiesMessageBundle({
      eventCoding:    NPHIES_EVENTS.PRIOR_AUTH,
      senderOrgId:    'hosp-001',
      receiverOrgId:  'pay-001',
      focalResource:  focal(),
      tenantId:       TENANT,
    });
    const mh = bundle.entry?.[0].resource as { focus: { reference: string; type: string }[] };
    expect(mh.focus[0].reference).toBe('urn:uuid:elig-001');
    expect(mh.focus[0].type).toBe('CoverageEligibilityRequest');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Route source inspection (R-*, 4 invariants × 4 routes)
// ─────────────────────────────────────────────────────────────────────────────
describe('FHIR 8.1.3 — Route source inspection', () => {
  const routes: { name: string; file: string; modelHints: string[] }[] = [
    {
      name:       'Practitioner',
      file:       'app/api/fhir/Practitioner/[id]/route.ts',
      modelHints: ['prisma.clinicalInfraProvider.findFirst'],
    },
    {
      name:       'PractitionerRole',
      file:       'app/api/fhir/PractitionerRole/[id]/route.ts',
      modelHints: ['prisma.clinicalInfraProviderAssignment.findFirst'],
    },
    {
      name:       'Organization',
      file:       'app/api/fhir/Organization/[id]/route.ts',
      modelHints: ['prisma.hospital.findFirst', 'prisma.billingPayer.findFirst'],
    },
    {
      name:       'Location',
      file:       'app/api/fhir/Location/[id]/route.ts',
      modelHints: ['prisma.clinicalInfraFacility.findFirst'],
    },
  ];

  for (const r of routes) {
    // flag gate
    it(`R-${r.name}-flag: ${r.name} route checks FF_FHIR_API_ENABLED and returns featureDisabledOutcome with status 404`, () => {
      const source = src(r.file);
      expect(source).toContain("isEnabled('FF_FHIR_API_ENABLED')");
      expect(source).toContain('featureDisabledOutcome');
      expect(source).toContain('status: 404');
    });

    // permission + tenantScoped
    it(`R-${r.name}-perm: ${r.name} route requires fhir.patient.read + tenantScoped: true`, () => {
      const source = src(r.file);
      expect(source).toContain("permissionKey: 'fhir.patient.read'");
      expect(source).toContain('tenantScoped: true');
    });

    // read-only
    it(`R-${r.name}-readonly: ${r.name} route exports GET only — no POST/PUT/PATCH/DELETE`, () => {
      const source = src(r.file);
      expect(source).toMatch(/export const GET\s*=/);
      expect(source).not.toContain('export const POST');
      expect(source).not.toContain('export const PUT');
      expect(source).not.toContain('export const PATCH');
      expect(source).not.toContain('export const DELETE');
    });

    // canonical model + content type + tenant-scoped query
    it(`R-${r.name}-tenant: ${r.name} route queries canonical model with tenantId+id and returns application/fhir+json`, () => {
      const source = src(r.file);
      for (const hint of r.modelHints) expect(source).toContain(hint);
      expect(source).toMatch(/where:\s*\{\s*tenantId,\s*id\s*\}/);
      expect(source).toContain("'Content-Type': 'application/fhir+json'");
      expect(source).toContain('notFoundOutcome');
    });
  }
});
