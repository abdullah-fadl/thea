// =============================================================================
// NPHIES Configuration
// =============================================================================

import { logger } from '@/lib/monitoring/logger';
import type { NphiesClientConfig } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NPHIES_SANDBOX_URL = 'https://hsb.nphies.sa/';
const NPHIES_PRODUCTION_URL = 'https://hsb.nphies.sa/';

const REQUIRED_ENV_VARS = [
  'NPHIES_LICENSE_ID',
  'NPHIES_SENDER_ID',
  'NPHIES_PROVIDER_ID',
  'NPHIES_CLIENT_ID',
  'NPHIES_CLIENT_SECRET',
] as const;

// ---------------------------------------------------------------------------
// NphiesConfig Class
// ---------------------------------------------------------------------------

class NphiesConfig {
  private _config: NphiesClientConfig | null = null;
  private _validated = false;

  /**
   * Whether NPHIES integration is configured (all required env vars are set).
   */
  get isConfigured(): boolean {
    return REQUIRED_ENV_VARS.every((key) => !!process.env[key]);
  }

  /**
   * Whether the integration is running in sandbox/test mode.
   */
  get isSandbox(): boolean {
    return process.env.NPHIES_SANDBOX === '1' || process.env.NPHIES_SANDBOX === 'true';
  }

  /**
   * The resolved base URL based on environment and sandbox flag.
   */
  get baseUrl(): string {
    if (process.env.NPHIES_BASE_URL) {
      return process.env.NPHIES_BASE_URL;
    }
    return this.isSandbox ? NPHIES_SANDBOX_URL : NPHIES_PRODUCTION_URL;
  }

  /**
   * Validates that all required environment variables are set.
   * Throws if any are missing.
   */
  validate(): void {
    if (this._validated) return;

    const missing: string[] = [];
    for (const key of REQUIRED_ENV_VARS) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      const msg = `NPHIES configuration incomplete. Missing: ${missing.join(', ')}`;
      logger.error(msg, { category: 'billing', missing });
      throw new Error(msg);
    }

    this._validated = true;
    logger.info('NPHIES configuration validated', {
      category: 'billing',
      baseUrl: this.baseUrl,
      sandbox: this.isSandbox,
      providerId: process.env.NPHIES_PROVIDER_ID,
    });
  }

  /**
   * Returns the full NPHIES client configuration.
   * Validates environment variables on first access.
   */
  getClientConfig(): NphiesClientConfig {
    if (this._config) return this._config;

    this.validate();

    this._config = {
      baseUrl: this.baseUrl,
      licenseId: process.env.NPHIES_LICENSE_ID!,
      senderId: process.env.NPHIES_SENDER_ID!,
      providerId: process.env.NPHIES_PROVIDER_ID!,
      clientId: process.env.NPHIES_CLIENT_ID!,
      clientSecret: process.env.NPHIES_CLIENT_SECRET!,
    };

    return this._config;
  }

  /**
   * Checks if NPHIES is ready without throwing.
   * Returns `{ ready: true }` or `{ ready: false, reason: string }`.
   */
  checkReady(): { ready: boolean; reason?: string } {
    if (!this.isConfigured) {
      const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
      return { ready: false, reason: `Missing env vars: ${missing.join(', ')}` };
    }
    return { ready: true };
  }

  /**
   * Resets the cached config (useful for tests).
   */
  reset(): void {
    this._config = null;
    this._validated = false;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const nphiesConfig = new NphiesConfig();

// ---------------------------------------------------------------------------
// Phase 8.1.4 — Adapter-side configuration loader
// ---------------------------------------------------------------------------
//
// The legacy NphiesConfig singleton above is kept for the existing
// eligibility/claims/priorAuth flows that still go through the axios-based
// `client.ts`. The 8.1.4 HTTP adapter consumes this leaner shape instead:
// only what the adapter and OAuth helper actually need, plus an explicit
// environment discriminator and timeout/retry knobs.

export interface NphiesAdapterConfig {
  /** Full URL to the NPHIES `$process-message` endpoint. */
  gatewayUrl: string;
  /** OAuth2 client_credentials client identifier. */
  clientId: string;
  /** OAuth2 client_credentials secret. */
  clientSecret: string;
  /** Sandbox vs production — drives logging + future profile selection. */
  environment: 'sandbox' | 'production';
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Number of retries on 5xx responses (4xx never retried). */
  retryCount: number;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_COUNT = 1;

/**
 * Read the NPHIES adapter config from process.env.
 *
 * Returns `null` when any required var is missing — adapter callers should
 * defer the decision (and the matching error message) to the moment they
 * actually need to make a network call. Returning `null` keeps the
 * "FF_NPHIES_HTTP_ENABLED OFF" path zero-cost.
 *
 * Env vars consulted (all required):
 *   - NPHIES_GATEWAY_URL
 *   - NPHIES_CLIENT_ID
 *   - NPHIES_CLIENT_SECRET
 *   - NPHIES_ENVIRONMENT  ('sandbox' | 'production')
 *
 * Optional knobs (defaults applied):
 *   - NPHIES_TIMEOUT_MS    (default 30000)
 *   - NPHIES_RETRY_COUNT   (default 1)
 */
export function getNphiesConfig(): NphiesAdapterConfig | null {
  const gatewayUrl    = process.env.NPHIES_GATEWAY_URL;
  const clientId      = process.env.NPHIES_CLIENT_ID;
  const clientSecret  = process.env.NPHIES_CLIENT_SECRET;
  const environmentIn = process.env.NPHIES_ENVIRONMENT;

  if (!gatewayUrl || !clientId || !clientSecret || !environmentIn) {
    return null;
  }

  const environment: 'sandbox' | 'production' =
    environmentIn === 'production' ? 'production' : 'sandbox';

  const timeoutMs = Number.parseInt(process.env.NPHIES_TIMEOUT_MS ?? '', 10);
  const retryCount = Number.parseInt(process.env.NPHIES_RETRY_COUNT ?? '', 10);

  return {
    gatewayUrl,
    clientId,
    clientSecret,
    environment,
    timeoutMs:  Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    retryCount: Number.isFinite(retryCount) && retryCount >= 0 ? retryCount : DEFAULT_RETRY_COUNT,
  };
}
