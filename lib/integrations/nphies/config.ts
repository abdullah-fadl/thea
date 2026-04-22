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
