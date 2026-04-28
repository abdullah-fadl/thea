/**
 * Phase 8.1.4 — sendEligibilityCheck + sendClaim operations tests.
 *
 * Cases:
 *   OPS-01  sendEligibilityCheck builds correct bundle from log (eligibility-request event)
 *   OPS-02  sendClaim builds correct bundle from BillingClaim (claim-request event)
 *   OPS-03  both persist response onto the existing log table
 *   OPS-04  both flag-gated end-to-end (FF OFF → mock outcome, FF ON → real fetch)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const TENANT = '11111111-1111-1111-1111-111111111111';

// ── Hoisted prisma mock so it's defined before importing operations.ts ──
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    nphiesEligibilityLog: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    billingClaim: {
      findFirst: vi.fn(),
    },
    nphiesClaim: {
      create: vi.fn().mockResolvedValue({ id: 'persisted-row' }),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

// Stub the Claim serializer so the test doesn't need ontology DB rows.
vi.mock('@/lib/fhir/serializers/claim', () => ({
  serializeClaim: vi.fn(async (bc: { id: string }) => ({
    resourceType: 'Claim',
    id: bc.id,
    status: 'active',
  })),
}));

import { sendEligibilityCheck, sendClaim } from '@/lib/integrations/nphies/operations';
import { _resetNphiesAuthCacheForTesting } from '@/lib/integrations/nphies/auth';

const ENV_KEYS = [
  'NPHIES_GATEWAY_URL',
  'NPHIES_CLIENT_ID',
  'NPHIES_CLIENT_SECRET',
  'NPHIES_ENVIRONMENT',
  FLAGS.FF_NPHIES_HTTP_ENABLED,
] as const;

let saved: Record<string, string | undefined>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

const NOW = new Date('2026-04-26T09:00:00Z');

function makeEligLog() {
  return {
    id:          'elig-log-001',
    tenantId:    TENANT,
    patientId:   'pat-001',
    insuranceId: 'ins-001',
    status:      'PENDING',
    eligible:    false,
    response:    null,
    createdAt:   NOW,
    createdBy:   'user-001',
  };
}

function makeBillingClaim() {
  return {
    id:              'claim-001',
    tenantId:        TENANT,
    encounterCoreId: 'enc-001',
    claimNumber:     'CLM-0001',
    patient:         { id: 'pat-001', name: 'Test' },
    provider:        { department: 'OPD' },
    totals:          { grandTotalActive: 100 },
    breakdown:       null,
    lineItems:       [],
    payerContext:    null,
    readiness:       null,
    createdAt:       NOW,
    createdByUserId: 'user-001',
  };
}

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  _resetNphiesAuthCacheForTesting();

  mockPrisma.nphiesEligibilityLog.findFirst.mockResolvedValue(makeEligLog());
  mockPrisma.nphiesEligibilityLog.update.mockResolvedValue(makeEligLog());
  mockPrisma.billingClaim.findFirst.mockResolvedValue(makeBillingClaim());
  mockPrisma.nphiesClaim.create.mockResolvedValue({ id: 'persisted-row' });

  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({
      resourceType: 'Bundle',
      id: 'gateway-resp-001',
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

describe('FHIR 8.1.4 — sendEligibilityCheck / sendClaim', () => {
  // OPS-01
  it('OPS-01: sendEligibilityCheck builds eligibility-request bundle from the log row', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED]; // mock-mode

    const res = await sendEligibilityCheck({ eligibilityRequestId: 'elig-log-001', tenantId: TENANT });

    // Found the right row by tenant + id.
    expect(mockPrisma.nphiesEligibilityLog.findFirst).toHaveBeenCalledWith({
      where: { id: 'elig-log-001', tenantId: TENANT },
    });

    // Mock-mode response is the synthetic bundle echoing the request — its
    // first entry's MessageHeader carries the eligibility event code.
    const mhResource = res.bundle.entry?.[0]?.resource as { resourceType: string; eventCoding?: { code: string } };
    expect(mhResource.resourceType).toBe('MessageHeader');
    expect(mhResource.eventCoding?.code).toBe('eligibility-request');
  });

  // OPS-02
  it('OPS-02: sendClaim builds claim-request bundle from BillingClaim', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED]; // mock-mode

    const res = await sendClaim({ claimId: 'claim-001', tenantId: TENANT });

    expect(mockPrisma.billingClaim.findFirst).toHaveBeenCalledWith({
      where: { id: 'claim-001', tenantId: TENANT },
    });

    const mhResource = res.bundle.entry?.[0]?.resource as { resourceType: string; eventCoding?: { code: string } };
    expect(mhResource.resourceType).toBe('MessageHeader');
    expect(mhResource.eventCoding?.code).toBe('claim-request');
  });

  // OPS-03
  it('OPS-03: both ops persist the gateway response onto their log tables', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED];

    await sendEligibilityCheck({ eligibilityRequestId: 'elig-log-001', tenantId: TENANT });
    expect(mockPrisma.nphiesEligibilityLog.update).toHaveBeenCalledTimes(1);
    const eligUpdate = mockPrisma.nphiesEligibilityLog.update.mock.calls[0][0];
    expect(eligUpdate.where).toEqual({ id: 'elig-log-001' });
    expect(eligUpdate.data.response.gatewayHttpStatus).toBe(200);
    expect(eligUpdate.data.response.gatewayCorrelationId).toBeDefined();

    await sendClaim({ claimId: 'claim-001', tenantId: TENANT });
    expect(mockPrisma.nphiesClaim.create).toHaveBeenCalledTimes(1);
    const claimCreate = mockPrisma.nphiesClaim.create.mock.calls[0][0];
    expect(claimCreate.data.tenantId).toBe(TENANT);
    expect(claimCreate.data.encounterId).toBe('enc-001');
    expect(claimCreate.data.status).toBe('SUBMITTED');
    expect(claimCreate.data.response.gatewayHttpStatus).toBe(200);
  });

  // OPS-04
  it('OPS-04: both ops are flag-gated — flag OFF skips fetch, flag ON calls it', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED];
    await sendEligibilityCheck({ eligibilityRequestId: 'elig-log-001', tenantId: TENANT });
    await sendClaim({ claimId: 'claim-001', tenantId: TENANT });
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env[FLAGS.FF_NPHIES_HTTP_ENABLED] = 'true';
    process.env.NPHIES_GATEWAY_URL   = 'https://sandbox.nphies.sa/$process-message';
    process.env.NPHIES_CLIENT_ID     = 'cid';
    process.env.NPHIES_CLIENT_SECRET = 'sec';
    process.env.NPHIES_ENVIRONMENT   = 'sandbox';
    _resetNphiesAuthCacheForTesting();

    await sendEligibilityCheck({ eligibilityRequestId: 'elig-log-001', tenantId: TENANT });
    expect(fetchSpy).toHaveBeenCalled(); // token + process-message
  });
});
