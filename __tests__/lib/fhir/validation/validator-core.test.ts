/**
 * Phase 8.1.5 — validator core (validateAgainstNphiesProfile).
 *
 * Cases:
 *   CORE-01  unknown profile URL → returns warning (`unknown-profile`), valid=true
 *   CORE-02  missing resourceType → error, valid=false
 *   CORE-03  known profile + happy resource → valid=true, zero errors
 *   CORE-04  required-field missing → error issue with code='required'
 *   CORE-05  defaultProfileFor maps every NPHIES resourceType to a profile URL
 */

import { describe, it, expect } from 'vitest';
import {
  validateAgainstNphiesProfile,
  defaultProfileFor,
  isValid,
} from '@/lib/fhir/validation/validator';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';
import type { FhirCoverage, FhirResource } from '@/lib/fhir/types';

describe('FHIR 8.1.5 — validateAgainstNphiesProfile (core)', () => {
  it('CORE-01: unknown profile URL → single warning issue, valid=true', () => {
    const result = validateAgainstNphiesProfile(
      { resourceType: 'Coverage' } as FhirResource,
      'http://made-up.example/profile-x',
    );
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].code).toBe('unknown-profile');
  });

  it('CORE-02: resource missing resourceType → error, valid=false', () => {
    const result = validateAgainstNphiesProfile(
      // deliberately broken resource
      {} as FhirResource,
      NPHIES_PROFILES.COVERAGE,
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0].severity).toBe('error');
    expect(result.issues[0].code).toBe('required');
  });

  it('CORE-03: known profile + valid resource → valid=true, zero errors', () => {
    const cov: FhirCoverage = {
      resourceType: 'Coverage',
      id:           'cov-001',
      status:       'active',
      beneficiary:  { reference: 'Patient/pat-001' },
      payor:        [{ reference: 'Organization/payer-001' }],
      subscriberId: 'mem-12345',
      period:       { start: '2026-01-01', end: '2026-12-31' },
    };
    const result = validateAgainstNphiesProfile(cov, NPHIES_PROFILES.COVERAGE);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('CORE-04: required-field missing surfaces as `required` error issue', () => {
    const result = validateAgainstNphiesProfile(
      { resourceType: 'Coverage' } as FhirResource,
      NPHIES_PROFILES.COVERAGE,
    );
    expect(result.valid).toBe(false);
    const required = result.issues.filter((i) => i.code === 'required' && i.severity === 'error');
    expect(required.length).toBeGreaterThanOrEqual(3); // status, beneficiary, payor
    expect(isValid(result.issues)).toBe(false);
  });

  it('CORE-05: defaultProfileFor maps every NPHIES resourceType to a profile URL', () => {
    const types = [
      'Coverage', 'Claim', 'ClaimResponse',
      'CoverageEligibilityRequest', 'CoverageEligibilityResponse',
      'Practitioner', 'PractitionerRole', 'Organization', 'Location',
      'Bundle', 'MessageHeader',
    ];
    for (const t of types) {
      const url = defaultProfileFor(t);
      expect(url).toBeTruthy();
      expect(url!.startsWith('http://nphies.sa/StructureDefinition/')).toBe(true);
    }
    // Resources outside the NPHIES set return null.
    expect(defaultProfileFor('Patient')).toBeNull();
  });
});
