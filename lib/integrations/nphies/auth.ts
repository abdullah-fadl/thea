// Phase 8.1.4 — NPHIES OAuth2 token helper.
//
// Lazy-fetches a `client_credentials` access token from the NPHIES OAuth
// endpoint and caches it in-memory with a TTL derived from the `expires_in`
// field (with a 60s safety buffer). All callers — adapter, operations,
// future poll loop — go through `getNphiesAccessToken()`.
//
// When FF_NPHIES_HTTP_ENABLED is OFF the helper short-circuits to a
// synthetic token (`mock-token-flag-off`) and never touches the network.
// This keeps tests and CI jobs entirely offline. The flag-on path requires
// `getNphiesConfig()` to return a complete config — otherwise we throw a
// clear error rather than silently using stale defaults.

import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';
import { getNphiesConfig, type NphiesAdapterConfig } from './config';

const MOCK_TOKEN = 'mock-token-flag-off' as const;
const TOKEN_PATH_DEFAULT = '/oauth2/token';
const REFRESH_BUFFER_MS = 60_000;

interface CachedToken {
  accessToken: string;
  expiresAt:   number; // epoch ms
}

let cached: CachedToken | null = null;

/**
 * For tests: clear the in-memory token cache.
 *
 * The adapter test suite calls this in `beforeEach` so each test starts
 * with a clean slate.
 */
export function _resetNphiesAuthCacheForTesting(): void {
  cached = null;
}

function deriveTokenUrl(cfg: NphiesAdapterConfig): string {
  const explicit = process.env.NPHIES_TOKEN_URL;
  if (explicit) return explicit;
  // Strip the `$process-message` (or any path tail) and append /oauth2/token.
  try {
    const u = new URL(cfg.gatewayUrl);
    u.pathname = TOKEN_PATH_DEFAULT;
    u.search   = '';
    return u.toString();
  } catch {
    // Fall back to a join — covers gatewayUrls that aren't strict URLs in tests.
    return cfg.gatewayUrl.replace(/\/?\$process-message.*$/, '') + TOKEN_PATH_DEFAULT;
  }
}

/**
 * Returns a valid NPHIES bearer token.
 *
 * Behavior:
 *   - FF OFF                → returns `mock-token-flag-off` immediately, no network.
 *   - FF ON, config missing → throws `Error('NPHIES config incomplete: ...')`.
 *   - FF ON, valid cache    → returns cached token.
 *   - FF ON, no cache       → POSTs `client_credentials` to the token URL,
 *                             caches `expires_in - 60s`, returns it.
 */
export async function getNphiesAccessToken(): Promise<string> {
  if (!isEnabled('FF_NPHIES_HTTP_ENABLED')) {
    return MOCK_TOKEN;
  }

  const cfg = getNphiesConfig();
  if (!cfg) {
    throw new Error(
      'NPHIES config incomplete: set NPHIES_GATEWAY_URL, NPHIES_CLIENT_ID, NPHIES_CLIENT_SECRET, NPHIES_ENVIRONMENT',
    );
  }

  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.accessToken;
  }

  const tokenUrl = deriveTokenUrl(cfg);
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     cfg.clientId,
    client_secret: cfg.clientSecret,
    scope:         'nphies',
  });

  const startedAt = Date.now();
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('NPHIES OAuth token request failed', {
      category: 'integration' as const,
      subsystem: 'nphies.http',
      tokenUrl,
      httpStatus: res.status,
      elapsedMs: Date.now() - startedAt,
      bodySnippet: text.slice(0, 200),
    });
    throw new Error(`NPHIES OAuth token request failed: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error('NPHIES OAuth response missing access_token');
  }

  const expiresInMs = ((json.expires_in ?? 3600) * 1000) - REFRESH_BUFFER_MS;
  cached = {
    accessToken: json.access_token,
    expiresAt:   now + Math.max(expiresInMs, 0),
  };

  logger.info('NPHIES OAuth token acquired', {
    category: 'integration' as const,
    subsystem: 'nphies.http',
    tokenUrl,
    expiresAt: new Date(cached.expiresAt).toISOString(),
    elapsedMs: Date.now() - startedAt,
  });

  return cached.accessToken;
}
