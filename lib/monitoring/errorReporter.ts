/**
 * Error Reporter for Thea EHR
 *
 * Captures and tracks application errors with context.
 * - Standalone: in-memory ring buffer for recent errors (exposed via /api/health)
 * - Sentry: optional integration when SENTRY_DSN is configured
 *
 * Usage:
 * ```ts
 * import { reportError, getRecentErrors } from '@/lib/monitoring/errorReporter';
 * reportError(err, { route: '/api/opd/queue', tenantId, userId });
 * ```
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorEntry {
  id: number;
  timestamp: string;
  message: string;
  name: string;
  stack?: string;
  route?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

export interface ErrorContext {
  route?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Ring buffer — keeps last N errors in memory
// ---------------------------------------------------------------------------

const MAX_ERRORS = 100;
const errors: ErrorEntry[] = [];
let errorIdCounter = 0;

let totalErrorCount = 0;
let errorCountSinceReset = 0;
let lastResetAt = Date.now();

// Per-route error counters (top offenders)
const routeErrorCounts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Sentry lazy loader
// ---------------------------------------------------------------------------

let sentryModule: any = null;
let sentryInitialised = false;

async function getSentry(): Promise<any> {
  if (sentryInitialised) return sentryModule;
  sentryInitialised = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    // Dynamic import — only loads if SENTRY_DSN is set
    const Sentry = await import(/* webpackIgnore: true */ '@sentry/nextjs');
    if (!Sentry.isInitialized()) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.NEXT_PUBLIC_BUILD_ID || 'dev',
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
        // Don't send PII unless explicitly enabled
        sendDefaultPii: process.env.SENTRY_SEND_PII === '1',
      });
    }
    sentryModule = Sentry;
    logger.info('Sentry initialised', { category: 'system' });
    return Sentry;
  } catch {
    // @sentry/nextjs not installed — that's fine
    logger.debug('Sentry SDK not available (not installed)', { category: 'system' });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Report an error — logs it, stores in ring buffer, and forwards to Sentry if configured.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  const err = normaliseError(error);
  const id = ++errorIdCounter;

  const entry: ErrorEntry = {
    id,
    timestamp: new Date().toISOString(),
    message: err.message,
    name: err.name,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    route: context?.route,
    tenantId: context?.tenantId,
    userId: context?.userId,
    requestId: context?.requestId,
  };

  // Ring buffer
  if (errors.length >= MAX_ERRORS) errors.shift();
  errors.push(entry);

  // Counters
  totalErrorCount++;
  errorCountSinceReset++;
  if (context?.route) {
    routeErrorCounts.set(context.route, (routeErrorCounts.get(context.route) || 0) + 1);
  }

  // Structured log
  logger.error(err.message, {
    category: 'system',
    route: context?.route,
    tenantId: context?.tenantId,
    userId: context?.userId,
    requestId: context?.requestId,
    error: err,
  });

  // Forward to Sentry (fire-and-forget)
  getSentry().then((Sentry) => {
    if (!Sentry) return;
    Sentry.withScope((scope: any) => {
      if (context?.tenantId) scope.setTag('tenantId', context.tenantId);
      if (context?.userId) scope.setTag('userId', context.userId);
      if (context?.route) scope.setTag('route', context.route);
      if (context?.requestId) scope.setTag('requestId', context.requestId);
      Sentry.captureException(err);
    });
  }).catch(() => {}); // never throw from error reporter
}

/**
 * Get recent errors (for /api/health?errors=true).
 * Returns newest first.
 */
export function getRecentErrors(limit = 20): ErrorEntry[] {
  return errors.slice(-limit).reverse();
}

/**
 * Get error statistics.
 */
export function getErrorStats(): {
  totalErrors: number;
  errorsSinceReset: number;
  resetAt: string;
  errorsPerMinute: number;
  topRoutes: { route: string; count: number }[];
  sentryEnabled: boolean;
} {
  const elapsedMinutes = Math.max(1, (Date.now() - lastResetAt) / 60_000);

  const topRoutes = [...routeErrorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([route, count]) => ({ route, count }));

  return {
    totalErrors: totalErrorCount,
    errorsSinceReset: errorCountSinceReset,
    resetAt: new Date(lastResetAt).toISOString(),
    errorsPerMinute: Math.round((errorCountSinceReset / elapsedMinutes) * 100) / 100,
    topRoutes,
    sentryEnabled: !!process.env.SENTRY_DSN,
  };
}

/**
 * Reset error counters (useful for periodic health reports).
 */
export function resetErrorCounters(): void {
  errorCountSinceReset = 0;
  lastResetAt = Date.now();
  routeErrorCounts.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (error && typeof error === 'object' && 'message' in error) {
    const e = new Error(String((error as Error).message));
    e.name = String((error as Error).name || 'Error');
    return e;
  }
  return new Error(String(error));
}
