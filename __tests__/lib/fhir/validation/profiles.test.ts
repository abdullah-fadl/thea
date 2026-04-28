/**
 * Phase 8.1.5 — per-profile validators (11 profiles × 2 cases = 22 cases).
 *
 * Pattern per profile:
 *   PROF-<XX>a:  valid resource → no error issues
 *   PROF-<XX>b:  missing required field(s) → at least one `required` error
 */

import { describe, it, expect } from 'vitest';
import { validateAgainstNphiesProfile } from '@/lib/fhir/validation/validator';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';
import { listRegisteredProfiles } from '@/lib/fhir/validation/profiles';
import type {
  FhirCoverage, FhirClaim, FhirClaimResponse,
  FhirCoverageEligibilityRequest, FhirCoverageEligibilityResponse,
  FhirPractitioner, FhirPractitionerRole, FhirOrganization, FhirLocation,
  FhirBundle, FhirMessageHeader, FhirResource,
} from '@/lib/fhir/types';

const ref = (s: string) => ({ reference: s });
const cc  = (code: string) => ({ coding: [{ system: 'x', code }] });

function errors(issues: { severity: string }[]) {
  return issues.filter((i) => i.severity === 'error');
}

describe('FHIR 8.1.5 — per-profile validators', () => {
  // -------------------------------------------------------------------------
  // Coverage
  // -------------------------------------------------------------------------
  it('PROF-01a: Coverage valid → no errors', () => {
    const cov: FhirCoverage = {
      resourceType: 'Coverage',
      status:       'active',
      beneficiary:  ref('Patient/pat-1'),
      payor:        [ref('Organization/payer-1')],
      subscriberId: 'mem-1',
      period:       { start: '2026-01-01' },
    };
    const r = validateAgainstNphiesProfile(cov, NPHIES_PROFILES.COVERAGE);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-01b: Coverage missing required fields → errors', () => {
    const cov = { resourceType: 'Coverage' } as FhirResource;
    const r = validateAgainstNphiesProfile(cov, NPHIES_PROFILES.COVERAGE);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Claim
  // -------------------------------------------------------------------------
  it('PROF-02a: Claim valid → no errors', () => {
    const claim: FhirClaim = {
      resourceType: 'Claim',
      status:    'active',
      use:       'claim',
      type:      cc('institutional'),
      patient:   ref('Patient/pat-1'),
      created:   '2026-04-26T09:00:00Z',
      provider:  ref('Organization/prov-1'),
      priority:  cc('normal'),
      insurance: [{ sequence: 1, focal: true, coverage: ref('Coverage/cov-1') }],
    };
    const r = validateAgainstNphiesProfile(claim, NPHIES_PROFILES.CLAIM);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-02b: Claim missing required fields → errors (status/use/patient/insurance)', () => {
    const claim = { resourceType: 'Claim', type: cc('inst') } as FhirResource;
    const r = validateAgainstNphiesProfile(claim, NPHIES_PROFILES.CLAIM);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(5);
  });

  // -------------------------------------------------------------------------
  // ClaimResponse
  // -------------------------------------------------------------------------
  it('PROF-03a: ClaimResponse valid → no errors', () => {
    const cr: FhirClaimResponse = {
      resourceType: 'ClaimResponse',
      status:  'active',
      type:    cc('institutional'),
      use:     'claim',
      patient: ref('Patient/pat-1'),
      created: '2026-04-26T09:00:00Z',
      insurer: ref('Organization/payer-1'),
      outcome: 'complete',
    };
    const r = validateAgainstNphiesProfile(cr, NPHIES_PROFILES.CLAIM_RESPONSE);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-03b: ClaimResponse missing required → errors', () => {
    const cr = { resourceType: 'ClaimResponse' } as FhirResource;
    const r = validateAgainstNphiesProfile(cr, NPHIES_PROFILES.CLAIM_RESPONSE);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(5);
  });

  // -------------------------------------------------------------------------
  // CoverageEligibilityRequest
  // -------------------------------------------------------------------------
  it('PROF-04a: CoverageEligibilityRequest valid → no errors', () => {
    const req: FhirCoverageEligibilityRequest = {
      resourceType: 'CoverageEligibilityRequest',
      status:  'active',
      purpose: ['benefits'],
      patient: ref('Patient/pat-1'),
      created: '2026-04-26T09:00:00Z',
      insurer: ref('Organization/payer-1'),
    };
    const r = validateAgainstNphiesProfile(req, NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-04b: CoverageEligibilityRequest invalid purpose value → value-set error', () => {
    const req = {
      resourceType: 'CoverageEligibilityRequest',
      status:  'active',
      purpose: ['nonsense'],
      patient: ref('Patient/pat-1'),
      created: '2026-04-26T09:00:00Z',
      insurer: ref('Organization/payer-1'),
    } as unknown as FhirResource;
    const r = validateAgainstNphiesProfile(req, NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'value-set')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CoverageEligibilityResponse
  // -------------------------------------------------------------------------
  it('PROF-05a: CoverageEligibilityResponse valid → no errors', () => {
    const res: FhirCoverageEligibilityResponse = {
      resourceType: 'CoverageEligibilityResponse',
      status:  'active',
      purpose: ['benefits'],
      patient: ref('Patient/pat-1'),
      created: '2026-04-26T09:00:00Z',
      request: ref('CoverageEligibilityRequest/req-1'),
      outcome: 'complete',
      insurer: ref('Organization/payer-1'),
    };
    const r = validateAgainstNphiesProfile(res, NPHIES_PROFILES.COVERAGE_ELIGIBILITY_RESPONSE);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-05b: CoverageEligibilityResponse missing required → errors', () => {
    const res = { resourceType: 'CoverageEligibilityResponse' } as FhirResource;
    const r = validateAgainstNphiesProfile(res, NPHIES_PROFILES.COVERAGE_ELIGIBILITY_RESPONSE);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(5);
  });

  // -------------------------------------------------------------------------
  // Practitioner
  // -------------------------------------------------------------------------
  it('PROF-06a: Practitioner valid → no errors', () => {
    const p: FhirPractitioner = {
      resourceType: 'Practitioner',
      identifier:   [{ system: 'http://moh.gov.sa/license', value: 'L-001' }],
      name:         [{ family: 'AlSaud', given: ['Khalid'] }],
    };
    const r = validateAgainstNphiesProfile(p, NPHIES_PROFILES.PRACTITIONER);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-06b: Practitioner missing identifier + name → errors', () => {
    const p = { resourceType: 'Practitioner' } as FhirResource;
    const r = validateAgainstNphiesProfile(p, NPHIES_PROFILES.PRACTITIONER);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // PractitionerRole
  // -------------------------------------------------------------------------
  it('PROF-07a: PractitionerRole valid → no errors', () => {
    const pr: FhirPractitionerRole = {
      resourceType: 'PractitionerRole',
      practitioner: ref('Practitioner/p-1'),
      organization: ref('Organization/o-1'),
      code:         [cc('doctor')],
    };
    const r = validateAgainstNphiesProfile(pr, NPHIES_PROFILES.PRACTITIONER_ROLE);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-07b: PractitionerRole missing required → errors', () => {
    const pr = { resourceType: 'PractitionerRole' } as FhirResource;
    const r = validateAgainstNphiesProfile(pr, NPHIES_PROFILES.PRACTITIONER_ROLE);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Organization
  // -------------------------------------------------------------------------
  it('PROF-08a: Organization valid → no errors', () => {
    const o: FhirOrganization = {
      resourceType: 'Organization',
      identifier:   [{ system: 'http://nphies.sa/license', value: 'PROV-001' }],
      name:         'Thea Medical Center',
    };
    const r = validateAgainstNphiesProfile(o, NPHIES_PROFILES.ORGANIZATION);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-08b: Organization missing required → errors', () => {
    const o = { resourceType: 'Organization' } as FhirResource;
    const r = validateAgainstNphiesProfile(o, NPHIES_PROFILES.ORGANIZATION);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // Location
  // -------------------------------------------------------------------------
  it('PROF-09a: Location valid → no errors', () => {
    const l: FhirLocation = {
      resourceType: 'Location',
      status: 'active',
      name:   'Riyadh OPD',
      mode:   'instance',
    };
    const r = validateAgainstNphiesProfile(l, NPHIES_PROFILES.LOCATION);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-09b: Location missing name + invalid mode → errors', () => {
    const l = { resourceType: 'Location', mode: 'bogus' } as unknown as FhirResource;
    const r = validateAgainstNphiesProfile(l, NPHIES_PROFILES.LOCATION);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'value-set')).toBe(true);
    expect(r.issues.some((i) => i.code === 'required')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // MessageHeader
  // -------------------------------------------------------------------------
  it('PROF-10a: MessageHeader valid → no errors', () => {
    const mh: FhirMessageHeader = {
      resourceType: 'MessageHeader',
      eventCoding: { system: 'x', code: 'eligibility-request' },
      destination: [{ endpoint: 'urn:uuid:hub' }],
      source:      { endpoint: 'urn:uuid:provider' },
      focus:       [ref('CoverageEligibilityRequest/req-1')],
    };
    const r = validateAgainstNphiesProfile(mh, NPHIES_PROFILES.MESSAGE_HEADER);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-10b: MessageHeader missing endpoint + eventCoding.code → errors', () => {
    const mh = {
      resourceType: 'MessageHeader',
      eventCoding: { system: 'x' }, // missing .code
      destination: [{}],            // missing endpoint
      source:      {},              // missing endpoint
      focus:       [ref('X/1')],
    } as unknown as FhirResource;
    const r = validateAgainstNphiesProfile(mh, NPHIES_PROFILES.MESSAGE_HEADER);
    expect(r.valid).toBe(false);
    expect(errors(r.issues).length).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Bundle (NPHIES message)
  // -------------------------------------------------------------------------
  it('PROF-11a: NPHIES message Bundle valid → no errors', () => {
    const b: FhirBundle = {
      resourceType: 'Bundle',
      type:         'message',
      timestamp:    '2026-04-26T09:00:00Z',
      entry: [
        { fullUrl: 'urn:uuid:mh-1',  resource: { resourceType: 'MessageHeader' } as FhirResource },
        { fullUrl: 'urn:uuid:req-1', resource: { resourceType: 'CoverageEligibilityRequest' } as FhirResource },
      ],
    };
    const r = validateAgainstNphiesProfile(b, NPHIES_PROFILES.MESSAGE_BUNDLE);
    expect(errors(r.issues)).toHaveLength(0);
  });
  it('PROF-11b: Bundle wrong type + entry[0] not MessageHeader + missing fullUrl → errors', () => {
    const b = {
      resourceType: 'Bundle',
      type:         'collection',
      entry:        [{ resource: { resourceType: 'Coverage' } }],
    } as unknown as FhirResource;
    const r = validateAgainstNphiesProfile(b, NPHIES_PROFILES.MESSAGE_BUNDLE);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'invariant')).toBe(true);
    expect(r.issues.some((i) => i.code === 'required' && i.path.includes('fullUrl'))).toBe(true);
    expect(r.issues.some((i) => i.code === 'value-set')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Registry sanity check
  // -------------------------------------------------------------------------
  it('REG-01: every NPHIES profile URL has a registered validator', () => {
    const registered = listRegisteredProfiles();
    for (const url of Object.values(NPHIES_PROFILES)) {
      expect(registered).toContain(url);
    }
  });
});
