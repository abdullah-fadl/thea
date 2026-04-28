/**
 * Phase 8.1.4 — getNphiesConfig env-var loader tests.
 *
 * Cases:
 *   CFG-01  missing env returns null
 *   CFG-02  full env returns config (gatewayUrl/clientId/clientSecret/environment)
 *   CFG-03  environment validates as 'sandbox'|'production' (anything-not-production → sandbox)
 *   CFG-04  timeout has default + retry has default
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getNphiesConfig } from '@/lib/integrations/nphies/config';

const KEYS = [
  'NPHIES_GATEWAY_URL',
  'NPHIES_CLIENT_ID',
  'NPHIES_CLIENT_SECRET',
  'NPHIES_ENVIRONMENT',
  'NPHIES_TIMEOUT_MS',
  'NPHIES_RETRY_COUNT',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('FHIR 8.1.4 — getNphiesConfig', () => {
  // CFG-01
  it('CFG-01: missing env returns null', () => {
    expect(getNphiesConfig()).toBeNull();

    process.env.NPHIES_GATEWAY_URL = 'https://sandbox.nphies.sa/$process-message';
    expect(getNphiesConfig()).toBeNull(); // still missing other keys
    process.env.NPHIES_CLIENT_ID = 'cid';
    expect(getNphiesConfig()).toBeNull();
    process.env.NPHIES_CLIENT_SECRET = 'sec';
    expect(getNphiesConfig()).toBeNull(); // still missing NPHIES_ENVIRONMENT
  });

  // CFG-02
  it('CFG-02: full env returns the populated NphiesAdapterConfig', () => {
    process.env.NPHIES_GATEWAY_URL  = 'https://sandbox.nphies.sa/$process-message';
    process.env.NPHIES_CLIENT_ID    = 'cid-001';
    process.env.NPHIES_CLIENT_SECRET = 'sec-001';
    process.env.NPHIES_ENVIRONMENT  = 'sandbox';

    const cfg = getNphiesConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.gatewayUrl).toBe('https://sandbox.nphies.sa/$process-message');
    expect(cfg?.clientId).toBe('cid-001');
    expect(cfg?.clientSecret).toBe('sec-001');
    expect(cfg?.environment).toBe('sandbox');
  });

  // CFG-03
  it('CFG-03: environment narrows to sandbox|production (unknown → sandbox)', () => {
    process.env.NPHIES_GATEWAY_URL  = 'https://example.test/$process-message';
    process.env.NPHIES_CLIENT_ID    = 'a';
    process.env.NPHIES_CLIENT_SECRET = 'b';

    process.env.NPHIES_ENVIRONMENT = 'production';
    expect(getNphiesConfig()?.environment).toBe('production');

    process.env.NPHIES_ENVIRONMENT = 'sandbox';
    expect(getNphiesConfig()?.environment).toBe('sandbox');

    process.env.NPHIES_ENVIRONMENT = 'something-weird';
    expect(getNphiesConfig()?.environment).toBe('sandbox');
  });

  // CFG-04
  it('CFG-04: timeoutMs/retryCount default when env unset', () => {
    process.env.NPHIES_GATEWAY_URL   = 'https://example.test/$process-message';
    process.env.NPHIES_CLIENT_ID     = 'a';
    process.env.NPHIES_CLIENT_SECRET = 'b';
    process.env.NPHIES_ENVIRONMENT   = 'sandbox';

    let cfg = getNphiesConfig();
    expect(cfg?.timeoutMs).toBe(30000);
    expect(cfg?.retryCount).toBe(1);

    process.env.NPHIES_TIMEOUT_MS = '7500';
    process.env.NPHIES_RETRY_COUNT = '3';
    cfg = getNphiesConfig();
    expect(cfg?.timeoutMs).toBe(7500);
    expect(cfg?.retryCount).toBe(3);
  });
});
