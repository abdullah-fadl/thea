/**
 * Phase 8.6 — Sentry-ready error capture stub.
 *
 * The codebase doesn't have Sentry (or any APM) wired up yet — that's a
 * subscription decision for a later step. But every error site that wants
 * "send this to Sentry when we have it" needs a stable call site _now_,
 * otherwise we'll have a hundred ad-hoc try/catch+console.error patterns
 * to grep through when we do wire Sentry in.
 *
 * This module provides that stable call site as a no-op that logs locally.
 * When Sentry (or Datadog APM, Honeycomb, etc.) is added:
 *   1. `npm i @sentry/nextjs`
 *   2. Replace the body of `captureException()` with `Sentry.captureException(err, { tags: { tenantId, userId, category } })`.
 *   3. Optionally replace `withErrorCapture()` with the Sentry helper of the same shape.
 * Every existing call site keeps working — there's no ripple change required.
 *
 * Usage:
 *   import { captureException } from '@/lib/observability/errors';
 *
 *   try {
 *     await dangerous();
 *   } catch (err) {
 *     captureException(err, { tenantId, userId, category: 'opd' });
 *     throw err; // captureException never swallows — caller decides
 *   }
 *
 *   // Or wrap a function to capture-and-rethrow automatically:
 *   const safeRun = withErrorCapture(dangerous, { category: 'cron.daily' });
 *   await safeRun(args);
 */

import { obs, type ObsContext } from './logger';

export interface ErrorCaptureContext extends ObsContext {
  /** Free-text fingerprint to deduplicate similar errors when Sentry is wired in. */
  fingerprint?: string;
}

/**
 * Capture an exception. Today this just logs as an `error`-level structured
 * line via `obs`. When Sentry / Datadog is added, swap the body to forward
 * to the SDK — the public signature stays the same so no callers change.
 *
 * Never throws (capturing must never break the caller).
 */
export function captureException(err: unknown, context: ErrorCaptureContext = {}): void {
  try {
    obs.error('exception.captured', { ...context, error: err });
  } catch {
    // Truly defensive — if even logging fails, swallow rather than crash.
  }
}

/**
 * Wrap an async function so any thrown error is captured (with context) and
 * then re-thrown. Keeps caller semantics identical — this is purely an
 * observability hook.
 */
export function withErrorCapture<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  context: ErrorCaptureContext = {},
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      captureException(err, context);
      throw err;
    }
  };
}
