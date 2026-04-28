// Phase 8.1.4 — NPHIES HTTP transport adapter.
//
// `sendNphiesMessage` is the single chokepoint for outbound NPHIES traffic.
// It accepts a fully-built message-mode FhirBundle (typically minted by
// `lib/fhir/bundleBuilder.ts#buildNphiesMessageBundle`) and delivers it to
// the gateway, returning the parsed response Bundle plus transport metadata.
//
// Flag behaviour:
//   - FF_NPHIES_HTTP_ENABLED OFF → returns a synthetic mock response (input
//     bundle echoed back with one MessageHeader.response.code='ok' coding)
//     after a 50ms delay. NEVER reads config or hits the network.
//   - FF_NPHIES_HTTP_ENABLED ON  → fetch POSTs `bundle` JSON to
//     `config.gatewayUrl` with `Authorization: Bearer <token>`,
//     `Content-Type: application/fhir+json`. Reads response, parses to
//     FhirBundle. Logs request + response (`category: 'integration'`,
//     subsystem: 'nphies.http'). Retries once on 5xx with exponential
//     backoff (250ms × 2^attempt). 4xx never retried. Network errors
//     surface as a typed `NphiesTransportError`.
//
// Tenant scoping: every log entry carries `tenantId` from the request.

import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';
import type { FhirBundle } from '@/lib/fhir/types';
import { validateBundle, summarize, type ValidationResult } from '@/lib/fhir/validation';
import { getNphiesConfig } from './config';
import { getNphiesAccessToken } from './auth';

const FHIR_CONTENT_TYPE = 'application/fhir+json' as const;
const MOCK_DELAY_MS = 50;
const RETRY_BASE_MS = 250;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NphiesRequest {
  /** Built via `buildNphiesMessageBundle` (Phase 8.1.3). */
  bundle:        FhirBundle;
  /** Required — every log entry is tagged with this. */
  tenantId:      string;
  /** Optional caller-supplied id; auto-generated when absent. */
  correlationId?: string;
}

export interface NphiesResponse {
  /** Parsed response bundle (also message-type). */
  bundle:        FhirBundle;
  /** HTTP status (200 in mock mode, propagated from gateway when ON). */
  httpStatus:    number;
  /** Echoed back from request (or generated if request had none). */
  correlationId: string;
  /** Wall-clock duration of the round trip (or mock delay). */
  elapsedMs:     number;
  /**
   * Phase 8.1.5 — validation summary attached to every response (mock or
   * real). Counts only — full issue list is logged but not embedded here.
   * When FF_NPHIES_VALIDATION_ENABLED is OFF, all counts are 0 and
   * `validationFailed` is `false`.
   */
  validationIssueCount: number;
  validationFailed:     boolean;
}

export class NphiesTransportError extends Error {
  readonly cause?: unknown;
  readonly httpStatus?: number;
  readonly correlationId: string;
  constructor(message: string, opts: { cause?: unknown; httpStatus?: number; correlationId: string }) {
    super(message);
    this.name = 'NphiesTransportError';
    this.cause         = opts.cause;
    this.httpStatus    = opts.httpStatus;
    this.correlationId = opts.correlationId;
  }
}

/**
 * Phase 8.1.5 — thrown by `sendNphiesMessage` when STRICT validation is ON
 * and the bundle has at least one error-severity issue. The send is aborted
 * BEFORE any network call (no token fetch, no $process-message POST).
 *
 * Carries the full issue list so callers / API routes can render an
 * OperationOutcome 422 to the client.
 */
export class NphiesValidationError extends Error {
  readonly correlationId: string;
  readonly results:       ValidationResult[];
  readonly issueCount:    number;
  readonly errorCount:    number;
  constructor(message: string, opts: { correlationId: string; results: ValidationResult[]; issueCount: number; errorCount: number }) {
    super(message);
    this.name           = 'NphiesValidationError';
    this.correlationId  = opts.correlationId;
    this.results        = opts.results;
    this.issueCount     = opts.issueCount;
    this.errorCount     = opts.errorCount;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newCorrelationId(): string {
  // crypto.randomUUID is available in Node 18+ and the Edge runtime.
  return (globalThis.crypto?.randomUUID?.() ?? `nphies-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function syntheticResponse(bundle: FhirBundle, correlationId: string): FhirBundle {
  // Echo every input entry back; flip the MessageHeader (entry[0]) so
  // callers can pattern-match `response.code === 'ok'` without parsing the
  // whole bundle. The synthetic outcome is purely for offline development.
  const entries = (bundle.entry ?? []).map((e, i) => {
    if (i !== 0 || e.resource?.resourceType !== 'MessageHeader') return e;
    return {
      ...e,
      resource: {
        ...e.resource,
        // attach a `response` block flagging this as a mock outcome.
        response: { identifier: correlationId, code: 'ok' as const },
      },
    };
  });

  return {
    resourceType: 'Bundle',
    id: `${bundle.id ?? 'nphies'}-mock-response`,
    type: 'message',
    timestamp: new Date().toISOString(),
    meta: bundle.meta,
    entry: entries,
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendNphiesMessage(args: NphiesRequest): Promise<NphiesResponse> {
  const correlationId = args.correlationId ?? newCorrelationId();
  const startedAt = Date.now();

  // ── Phase 8.1.5: validate before send (flag-gated inside validateBundle). ─
  // When FF_NPHIES_VALIDATION_ENABLED is OFF, validateBundle returns a
  // single passing result and this whole block is effectively a no-op (the
  // summary counters all read 0). When ON + non-strict: log + proceed.
  // When ON + strict + any error: throw before the network call.
  const validationResults = validateBundle(args.bundle);
  const validationSummary = summarize(validationResults);
  if (validationSummary.totalIssues > 0) {
    logger.warn('NPHIES validation issues detected', {
      category: 'nphies.validation' as const,
      tenantId: args.tenantId,
      correlationId,
      bundleId: args.bundle.id,
      totalIssues:  validationSummary.totalIssues,
      errorCount:   validationSummary.errorCount,
      warningCount: validationSummary.warningCount,
      issues: validationResults.flatMap((r) => r.issues),
      strict: isEnabled('FF_NPHIES_VALIDATION_STRICT'),
    });
  }
  if (validationSummary.failed && isEnabled('FF_NPHIES_VALIDATION_STRICT')) {
    throw new NphiesValidationError(
      `NPHIES validation failed in strict mode: ${validationSummary.errorCount} error(s) across ${validationSummary.totalIssues} issue(s)`,
      {
        correlationId,
        results:    validationResults,
        issueCount: validationSummary.totalIssues,
        errorCount: validationSummary.errorCount,
      },
    );
  }

  // ── Flag OFF: synthetic mock response, no config, no network. ─────────
  if (!isEnabled('FF_NPHIES_HTTP_ENABLED')) {
    await delay(MOCK_DELAY_MS);
    const elapsedMs = Date.now() - startedAt;
    logger.info('NPHIES request (mock — flag off)', {
      category: 'integration' as const,
      subsystem: 'nphies.http',
      tenantId: args.tenantId,
      correlationId,
      bundleId: args.bundle.id,
      mock: true,
      elapsedMs,
      validationIssueCount: validationSummary.totalIssues,
      validationFailed:     validationSummary.failed,
    });
    return {
      bundle:     syntheticResponse(args.bundle, correlationId),
      httpStatus: 200,
      correlationId,
      elapsedMs,
      validationIssueCount: validationSummary.totalIssues,
      validationFailed:     validationSummary.failed,
    };
  }

  // ── Flag ON: real HTTP transport. ─────────────────────────────────────
  const cfg = getNphiesConfig();
  if (!cfg) {
    throw new NphiesTransportError(
      'NPHIES config incomplete: set NPHIES_GATEWAY_URL, NPHIES_CLIENT_ID, NPHIES_CLIENT_SECRET, NPHIES_ENVIRONMENT',
      { correlationId },
    );
  }

  const token = await getNphiesAccessToken();

  const maxAttempts = cfg.retryCount + 1; // retryCount=1 → 2 attempts max
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptStart = Date.now();
    logger.info('NPHIES request — outbound POST', {
      category: 'integration' as const,
      subsystem: 'nphies.http',
      tenantId: args.tenantId,
      correlationId,
      bundleId: args.bundle.id,
      gatewayUrl: cfg.gatewayUrl,
      attempt: attempt + 1,
      environment: cfg.environment,
    });

    let res: Response;
    try {
      res = await fetch(cfg.gatewayUrl, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': FHIR_CONTENT_TYPE,
          Accept:         FHIR_CONTENT_TYPE,
          'X-Correlation-Id': correlationId,
        },
        body: JSON.stringify(args.bundle),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
    } catch (err) {
      lastError = err;
      logger.error('NPHIES request — network error', {
        category: 'integration' as const,
        subsystem: 'nphies.http',
        tenantId: args.tenantId,
        correlationId,
        attempt: attempt + 1,
        elapsedMs: Date.now() - attemptStart,
        error: err instanceof Error ? err.message : String(err),
      });
      // Network errors are not retried per spec — only 5xx triggers retry.
      throw new NphiesTransportError('NPHIES network error', { cause: err, correlationId });
    }

    const elapsedMs = Date.now() - startedAt;

    // ── Retryable? ─────────────────────────────────────────────────────
    if (res.status >= 500 && attempt < maxAttempts - 1) {
      logger.warn('NPHIES request — 5xx, will retry', {
        category: 'integration' as const,
        subsystem: 'nphies.http',
        tenantId: args.tenantId,
        correlationId,
        httpStatus: res.status,
        attempt: attempt + 1,
        elapsedMs: Date.now() - attemptStart,
      });
      lastError = new NphiesTransportError(`NPHIES 5xx response (attempt ${attempt + 1})`, {
        httpStatus: res.status,
        correlationId,
      });
      await delay(RETRY_BASE_MS * Math.pow(2, attempt));
      continue;
    }

    // ── Final outcome (success or 4xx). ────────────────────────────────
    let parsed: FhirBundle;
    try {
      parsed = (await res.json()) as FhirBundle;
    } catch (err) {
      throw new NphiesTransportError('NPHIES response not valid JSON', {
        cause: err,
        httpStatus: res.status,
        correlationId,
      });
    }

    logger.info('NPHIES response — received', {
      category: 'integration' as const,
      subsystem: 'nphies.http',
      tenantId: args.tenantId,
      correlationId,
      httpStatus: res.status,
      bundleId: parsed.id,
      attempt: attempt + 1,
      elapsedMs,
    });

    if (res.status >= 400) {
      throw new NphiesTransportError(`NPHIES gateway returned HTTP ${res.status}`, {
        httpStatus: res.status,
        correlationId,
      });
    }

    return {
      bundle:     parsed,
      httpStatus: res.status,
      correlationId,
      elapsedMs,
      validationIssueCount: validationSummary.totalIssues,
      validationFailed:     validationSummary.failed,
    };
  }

  // Exhausted retries on 5xx — surface the last error.
  if (lastError instanceof NphiesTransportError) throw lastError;
  throw new NphiesTransportError('NPHIES request failed after retries', { cause: lastError, correlationId });
}
