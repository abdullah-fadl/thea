/**
 * Phase 8.1.4 — getNphiesAccessToken tests.
 *
 * Cases:
 *   AUTH-01  flag OFF → returns mock token, fetch never called
 *   AUTH-02  flag ON, missing config → throws
 *   AUTH-03  flag ON, valid config → calls fetch with client_credentials body
 *   AUTH-04  token cached on second call within TTL (single fetch)
 *   AUTH-05  expired token re-fetches
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import {
  getNphiesAccessToken,
  _resetNphiesAuthCacheForTesting,
} from '@/lib/integrations/nphies/auth';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const ENV_KEYS = [
  'NPHIES_GATEWAY_URL',
  'NPHIES_CLIENT_ID',
  'NPHIES_CLIENT_SECRET',
  'NPHIES_ENVIRONMENT',
  'NPHIES_TOKEN_URL',
  FLAGS.FF_NPHIES_HTTP_ENABLED,
] as const;

let saved: Record<string, string | undefined>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  _resetNphiesAuthCacheForTesting();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ access_token: 'real-token-aaa', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fetchSpy.mockRestore();
});

describe('FHIR 8.1.4 — getNphiesAccessToken', () => {
  // AUTH-01
  it('AUTH-01: flag OFF → returns mock token without calling fetch', async () => {
    delete process.env[FLAGS.FF_NPHIES_HTTP_ENABLED];
    const token = await getNphiesAccessToken();
    expect(token).toBe('mock-token-flag-off');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // AUTH-02
  it('AUTH-02: flag ON, missing config → throws clear error', async () => {
    process.env[FLAGS.FF_NPHIES_HTTP_ENABLED] = 'true';
    // No NPHIES_* env vars set.
    await expect(getNphiesAccessToken()).rejects.toThrow(/NPHIES config incomplete/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // AUTH-03
  it('AUTH-03: flag ON, valid config → POSTs client_credentials and returns token', async () => {
    process.env[FLAGS.FF_NPHIES_HTTP_ENABLED] = 'true';
    process.env.NPHIES_GATEWAY_URL   = 'https://sandbox.nphies.sa/$process-message';
    process.env.NPHIES_CLIENT_ID     = 'cid';
    process.env.NPHIES_CLIENT_SECRET = 'sec';
    process.env.NPHIES_ENVIRONMENT   = 'sandbox';

    const token = await getNphiesAccessToken();
    expect(token).toBe('real-token-aaa');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/oauth2\/token$/);
    expect((init as RequestInit)?.method).toBe('POST');
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const body = (init as RequestInit)?.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('sec');
  });

  // AUTH-04
  it('AUTH-04: token cached on second call within TTL → single fetch', async () => {
    process.env[FLAGS.FF_NPHIES_HTTP_ENABLED] = 'true';
    process.env.NPHIES_GATEWAY_URL   = 'https://sandbox.nphies.sa/$process-message';
    process.env.NPHIES_CLIENT_ID     = 'cid';
    process.env.NPHIES_CLIENT_SECRET = 'sec';
    process.env.NPHIES_ENVIRONMENT   = 'sandbox';

    const a = await getNphiesAccessToken();
    const b = await getNphiesAccessToken();
    const c = await getNphiesAccessToken();
    expect(a).toBe('real-token-aaa');
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // AUTH-05
  it('AUTH-05: expired token (TTL elapsed) re-fetches', async () => {
    process.env[FLAGS.FF_NPHIES_HTTP_ENABLED] = 'true';
    process.env.NPHIES_GATEWAY_URL   = 'https://sandbox.nphies.sa/$process-message';
    process.env.NPHIES_CLIENT_ID     = 'cid';
    process.env.NPHIES_CLIENT_SECRET = 'sec';
    process.env.NPHIES_ENVIRONMENT   = 'sandbox';

    // First call: short-lived token (expires_in 0 → cache TTL becomes 0 after buffer).
    fetchSpy.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 0 }), { status: 200 }),
    );
    const t1 = await getNphiesAccessToken();
    expect(t1).toBe('tok-1');

    // Second call after the cache window — should re-fetch.
    fetchSpy.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ access_token: 'tok-2', expires_in: 3600 }), { status: 200 }),
    );
    const t2 = await getNphiesAccessToken();
    expect(t2).toBe('tok-2');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
