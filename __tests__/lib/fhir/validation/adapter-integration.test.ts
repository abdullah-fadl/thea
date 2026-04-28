/**
 * Phase 8.1.5 — adapter ↔ validator integration.
 *
 * Cases:
 *   INT-01  validation flag OFF → no validation work; behavior identical to 8.1.4
 *           (synthetic mock response, validationIssueCount=0, validationFailed=false)
 *   INT-02  validation ON, non-strict, invalid bundle → warns but still returns OK
 *           with validationIssueCount > 0 + validationFailed=true
 *   INT-03  validation ON, STRICT, valid bundle → still passes (no false positives)
 *   INT-04  validation ON, STRICT, invalid bundle → throws NphiesValidationError
 *           BEFORE any fetch (no token, no $process-message)
 *   INT-05  validationIssueCount + validationFailed are persisted in
 *           sendEligibilityCheck's nphiesEligibilityLog.update payload
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import {
  sendNphiesMessage,
  NphiesValidationError,
} from '@/lib/integrations/nphies/adapter';
import { _resetNphiesAuthCacheForTesting } from '@/lib/integrations/nphies/auth';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';
import type { FhirBundle } from '@/lib/fhir/types';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const TENANT = '11111111-1111-1111-1111-111111111111';

const ENV_KEYS = [
  FLAGS.FF_NPHIES_HTTP_ENABLED,
  FLAGS.FF_NPHIES_VALIDATION_ENABLED,
  FLAGS.FF_NPHIES_VALIDATION_STRICT,
  'NPHIES_GATEWAY_URL',
  'NPHIES_CLIENT_ID',
  'NPHIES_CLIENT_SECRET',
  'NPHIES_ENVIRONMENT',
] as const;

let saved: Record<string, string | undefined>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

// A valid NPHIES message bundle: message-type, timestamp, entry[0]=MessageHeader,
// fullUrls present, MessageHeader meets its own profile rules.
function makeValidBundle(): FhirBundle {
  return {
    resourceType: 'Bundle',
    id:           'bundle-good',
    type:         'message',
    timestamp:    '2026-04-26T09:00:00Z',
    meta:         { profile: [NPHIES_PROFILES.MESSAGE_BUNDLE] },
    entry: [
      {
        fullUrl: 'urn:uuid:mh-1',
        resource: {
          resourceType: 'MessageHeader',
          id:           'mh-1',
          meta:         { profile: [NPHIES_PROFILES.MESSAGE_HEADER] },
          eventCoding:  { system: 'x', code: 'eligibility-request' },
          destination:  [{ endpoint: 'urn:uuid:hub' }],
          source:       { endpoint: 'urn:uuid:provider' },
          focus:        [{ reference: 'CoverageEligibilityRequest/req-1' }],
        } as never,
      },
      {
        fullUrl: 'urn:uuid:req-1',
        resource: {
          resourceType: 'CoverageEligibilityRequest',
          id:           'req-1',
          meta:         { profile: [NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST] },
          status:       'active',
          purpose:      ['benefits'],
          patient:      { reference: 'Patient/pat-1' },
          created:      '2026-04-26T09:00:00Z',
          insurer:      { reference: 'Organization/payer-1' },
        } as never,
      },
    ],
  };
}

// An invalid bundle: same wrapper but the focal resource is missing nearly
// every required field, so the per-profile validator emits multiple errors.
function makeInvalidBundle(): FhirBundle {
  return {
    resourceType: 'Bundle',
    id:           'bundle-bad',
    type:         'message',
    timestamp:    '2026-04-26T09:00:00Z',
    meta:         { profile: [NPHIES_PROFILES.MESSAGE_BUNDLE] },
    entry: [
      {
        fullUrl: 'urn:uuid:mh-1',
        resource: {
          resourceType: 'MessageHeader',
          id:           'mh-1',
          meta:         { profile: [NPHIES_PROFILES.MESSAGE_HEADER] },
          eventCoding:  { system: 'x', code: 'eligibility-request' },
          destination:  [{ endpoint: 'urn:uuid:hub' }],
          source:       { endpoint: 'urn:uuid:provider' },
          focus:        [{ reference: 'CoverageEligibilityRequest/req-1' }],
        } as never,
      },
      {
        fullUrl: 'urn:uuid:req-1',
        // missing required: status, purpose, patient, created, insurer
        resource: {
          resourceType: 'CoverageEligibilityRequest',
          id:           'req-1',
          meta:         { profile: [NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST] },
        } as never,
      },
    ],
  };
}

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  _resetNphiesAuthCacheForTesting();

  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({
      resourceType: 'Bundle',
      id: 'gateway-resp',
      type: 'message',
      entry: [],
    }), { status: 200 });
  });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fetchSpy.mockRestore();
  vi.clearAllMocks();
});

describe('FHIR 8.1.5 — adapter ↔ validator integration', () => {
  it('INT-01: validation flag OFF → behavior identical to 8.1.4 (counters=0)', async () => {
    // FF_NPHIES_VALIDATION_ENABLED OFF (default), FF_NPHIES_HTTP_ENABLED OFF.
    const r = await sendNphiesMessage({ bundle: makeInvalidBundle(), tenantId: TENANT });
    expect(r.httpStatus).toBe(200);
    expect(r.validationIssueCount).toBe(0);
    expect(r.validationFailed).toBe(false);
    // Zero network even though the bundle is invalid — proves we did not
    // upgrade behavior accidentally.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('INT-02: validation ON, non-strict + invalid bundle → warns + still returns', async () => {
    process.env[FLAGS.FF_NPHIES_VALIDATION_ENABLED] = 'true';
    // FF_NPHIES_VALIDATION_STRICT stays OFF, FF_NPHIES_HTTP_ENABLED stays OFF (mock-mode).
    const r = await sendNphiesMessage({ bundle: makeInvalidBundle(), tenantId: TENANT });
    expect(r.httpStatus).toBe(200); // Send proceeds.
    expect(r.validationIssueCount).toBeGreaterThan(0);
    expect(r.validationFailed).toBe(true);
  });

  it('INT-03: validation ON, STRICT + valid bundle → passes (no false positive)', async () => {
    process.env[FLAGS.FF_NPHIES_VALIDATION_ENABLED] = 'true';
    process.env[FLAGS.FF_NPHIES_VALIDATION_STRICT]  = 'true';
    const r = await sendNphiesMessage({ bundle: makeValidBundle(), tenantId: TENANT });
    expect(r.httpStatus).toBe(200);
    expect(r.validationFailed).toBe(false);
  });

  it('INT-04: validation ON, STRICT + invalid bundle → throws BEFORE network call', async () => {
    process.env[FLAGS.FF_NPHIES_VALIDATION_ENABLED] = 'true';
    process.env[FLAGS.FF_NPHIES_VALIDATION_STRICT]  = 'true';
    process.env[FLAGS.FF_NPHIES_HTTP_ENABLED]       = 'true';
    process.env.NPHIES_GATEWAY_URL   = 'https://sandbox.nphies.sa/$process-message';
    process.env.NPHIES_CLIENT_ID     = 'cid';
    process.env.NPHIES_CLIENT_SECRET = 'sec';
    process.env.NPHIES_ENVIRONMENT   = 'sandbox';

    await expect(
      sendNphiesMessage({ bundle: makeInvalidBundle(), tenantId: TENANT }),
    ).rejects.toBeInstanceOf(NphiesValidationError);
    // Critical: validation runs BEFORE auth + POST, so zero fetch calls.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('INT-05: validation summary persisted on nphiesEligibilityLog.update', async () => {
    // Use the operations layer which is what actually writes to the DB. We
    // mock prisma so we can assert the payload shape.
    const mockUpdate = vi.fn().mockResolvedValue({});
    vi.doMock('@/lib/db/prisma', () => ({
      prisma: {
        nphiesEligibilityLog: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'elig-1', tenantId: TENANT, patientId: 'pat-1',
            insuranceId: 'ins-1', status: 'PENDING', eligible: false,
            response: null, createdAt: new Date(), createdBy: 'u-1',
          }),
          update: mockUpdate,
        },
      },
    }));
    process.env[FLAGS.FF_NPHIES_VALIDATION_ENABLED] = 'true';

    const { sendEligibilityCheck } = await import('@/lib/integrations/nphies/operations');
    await sendEligibilityCheck({ eligibilityRequestId: 'elig-1', tenantId: TENANT });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.data.response.validationIssueCount).toBeDefined();
    expect(payload.data.response.validationFailed).toBeDefined();
    expect(typeof payload.data.response.validationIssueCount).toBe('number');
    expect(typeof payload.data.response.validationFailed).toBe('boolean');

    vi.doUnmock('@/lib/db/prisma');
  });
});
