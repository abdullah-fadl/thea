/**
 * Phase 8.1.4 — sendNphiesMessage adapter tests.
 *
 * Cases:
 *   ADP-01  flag OFF → returns synthetic bundle, httpStatus 200, mock outcome
 *   ADP-02  flag ON happy path → POSTs to gateway with bearer + fhir+json
 *   ADP-03  flag ON 5xx → triggers exactly one retry then succeeds
 *   ADP-04  flag ON 4xx → no retry, throws NphiesTransportError
 *   ADP-05  flag ON network error → throws typed NphiesTransportError
 *   ADP-06  response is parsed FhirBundle (not raw text)
 *   ADP-07  correlationId echoed back when supplied
 *   ADP-08  elapsedMs is measured (≥0, finite)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import {
  sendNphiesMessage,
  NphiesTransportError,
} from '@/lib/integrations/nphies/adapter';
import { _resetNphiesAuthCacheForTesting } from '@/lib/integrations/nphies/auth';
import type { FhirBundle } from '@/lib/fhir/types';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const TENANT = '11111111-1111-1111-1111-111111111111';

const ENV_KEYS = [
  'NPHIES_GATEWAY_URL',
  'NPHIES_CLIENT_ID',
  'NPHIES_CLIENT_SECRET',
  'NPHIES_ENVIRONMENT',
  'NPHIES_TIMEOUT_MS',
  'NPHIES_RETRY_COUNT',
  FLAGS.FF_NPHIES_HTTP_ENABLED,
] as const;

let saved: Record<string, string | undefined>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

function makeBundle(): FhirBundle {
  return {
    resourceType: 'Bundle',
    id: 'bundle-001',
    type: 'message',
    timestamp: '2026-04-26T09:00:00.000Z',
    entry: [
      {
        fullUrl: 'urn:uuid:mh-001',
        resource: {
          resourceType: 'MessageHeader',
          id: 'mh-001',
          eventCoding: { system: 'x', code: 'eligibility-request' },
        },
      } as never,
      {
        fullUrl: 'urn:uuid:elig-001',
        resource: { resourceType: 'CoverageEligibilityRequest', id: 'elig-001' },
      } as never,
    ],
  };
}

function makeOkResponse(overrides: Partial<FhirBundle> = {}): FhirBundle {
  return {
    resourceType: 'Bundle',
    id: 'response-bundle-001',
    type: 'message',
    timestamp: '2026-04-26T09:00:01.000Z',
    entry: [],
    ...overrides,
  };
}

function setFlagOn() {
  process.env[FLAGS.FF_NPHIES_HTTP_ENABLED] = 'true';
  process.env.NPHIES_GATEWAY_URL   = 'https://sandbox.nphies.sa/$process-message';
  process.env.NPHIES_CLIENT_ID     = 'cid';
  process.env.NPHIES_CLIENT_SECRET = 'sec';
  process.env.NPHIES_ENVIRONMENT   = 'sandbox';
}

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  _resetNphiesAuthCacheForTesting();

  // Default fetch mock: token endpoint then process-message endpoint both succeed.
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify(makeOkResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fetchSpy.mockRestore();
});

describe('FHIR 8.1.4 — sendNphiesMessage', () => {
  // ADP-01
  it('ADP-01: flag OFF → synthetic bundle, httpStatus 200, mock MessageHeader.response.code=ok', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED];
    const result = await sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT });
    expect(result.httpStatus).toBe(200);
    expect(result.bundle.resourceType).toBe('Bundle');
    expect(result.bundle.type).toBe('message');
    const mh = result.bundle.entry?.[0]?.resource as { response?: { code: string } };
    expect(mh.response?.code).toBe('ok');
    // Most importantly: zero network calls.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ADP-02
  it('ADP-02: flag ON happy path → POSTs to gateway with bearer + fhir+json', async () => {
    setFlagOn();
    const result = await sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT });
    expect(result.httpStatus).toBe(200);

    // First call is OAuth token, second is the process-message POST.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [postUrl, postInit] = fetchSpy.mock.calls[1];
    expect(String(postUrl)).toContain('/$process-message');
    expect((postInit as RequestInit).method).toBe('POST');
    const headers = (postInit as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-1');
    expect(headers['Content-Type']).toBe('application/fhir+json');
    expect(headers.Accept).toBe('application/fhir+json');
    // Body is the input bundle, JSON-serialized.
    expect(JSON.parse((postInit as RequestInit).body as string).id).toBe('bundle-001');
  });

  // ADP-03
  it('ADP-03: flag ON 5xx triggers exactly one retry, then succeeds', async () => {
    setFlagOn();
    let processMessageCalls = 0;
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      processMessageCalls++;
      if (processMessageCalls === 1) {
        return new Response('upstream timeout', { status: 503 });
      }
      return new Response(JSON.stringify(makeOkResponse()), { status: 200 });
    });

    const result = await sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT });
    expect(result.httpStatus).toBe(200);
    expect(processMessageCalls).toBe(2);
  });

  // ADP-04
  it('ADP-04: flag ON 4xx does NOT retry — single call, throws NphiesTransportError', async () => {
    setFlagOn();
    let processMessageCalls = 0;
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      processMessageCalls++;
      return new Response(JSON.stringify({ resourceType: 'OperationOutcome' }), { status: 400 });
    });

    await expect(
      sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT }),
    ).rejects.toBeInstanceOf(NphiesTransportError);
    expect(processMessageCalls).toBe(1);
  });

  // ADP-05
  it('ADP-05: flag ON network error → throws typed NphiesTransportError', async () => {
    setFlagOn();
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      throw new TypeError('ECONNRESET');
    });

    await expect(
      sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT }),
    ).rejects.toBeInstanceOf(NphiesTransportError);
  });

  // ADP-06
  it('ADP-06: response is parsed as FhirBundle (resourceType, type)', async () => {
    setFlagOn();
    const result = await sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT });
    expect(result.bundle.resourceType).toBe('Bundle');
    expect(result.bundle.type).toBe('message');
    expect(result.bundle.id).toBe('response-bundle-001');
  });

  // ADP-07
  it('ADP-07: correlationId echoed back when supplied', async () => {
    setFlagOn();
    const result = await sendNphiesMessage({
      bundle: makeBundle(),
      tenantId: TENANT,
      correlationId: 'corr-xyz-001',
    });
    expect(result.correlationId).toBe('corr-xyz-001');
    // X-Correlation-Id header propagates to the outbound request.
    const [, postInit] = fetchSpy.mock.calls[1];
    const headers = (postInit as RequestInit).headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toBe('corr-xyz-001');
  });

  // ADP-08
  it('ADP-08: elapsedMs is measured (>=0, finite, mock-mode hits ~50ms)', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED];
    const result = await sendNphiesMessage({ bundle: makeBundle(), tenantId: TENANT });
    expect(typeof result.elapsedMs).toBe('number');
    expect(Number.isFinite(result.elapsedMs)).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(40);
  });
});
