/**
 * Request Logger Middleware for Thea EHR
 *
 * Logs every API request: method, path, status, duration, tenantId.
 * Adds correlation IDs (X-Request-Id) for distributed tracing.
 * Skips health-check requests to avoid noise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { recordRequest } from './metrics';
import { reportError } from './errorReporter';

const SKIP_PATHS = ['/api/health', '/api/opd/health', '/_next', '/favicon.ico'];
const SENSITIVE_PATHS = ['/api/auth/login', '/api/auth/register', '/api/portal/auth'];

// Lightweight counter-based ID (no uuid import needed for request IDs)
let _reqCounter = 0;
function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const seq = (++_reqCounter & 0xffff).toString(36);
  return `${ts}-${seq}`;
}

/**
 * Wrap an API handler with request logging + metrics tracking.
 *
 * Adds X-Request-Id header for correlation across logs.
 *
 * Usage:
 * ```ts
 * export const POST = withRequestLogging(withAuthTenant(async (req, ctx) => { ... }));
 * ```
 */
export function withRequestLogging<TArgs extends [NextRequest, ...any[]]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    const req = args[0];
    const path = req.nextUrl.pathname;

    // Skip noisy paths
    if (SKIP_PATHS.some((skip) => path.startsWith(skip))) {
      return handler(...args);
    }

    // Generate or propagate correlation ID
    const requestId = req.headers.get('x-request-id') || generateRequestId();
    const start = Date.now();
    let status = 200;

    try {
      const response = await handler(...args);
      status = response.status;
      // Attach correlation ID to response for client-side tracing
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error) {
      status = 500;
      // Report to error tracking (Sentry + ring buffer)
      reportError(error, { route: `${req.method} ${path}`, requestId });
      throw error;
    } finally {
      const durationMs = Date.now() - start;
      const isError = status >= 400;
      const isSensitive = SENSITIVE_PATHS.some((sp) => path.startsWith(sp));

      // Record metric
      recordRequest(path, durationMs, isError);

      // Log request with correlation ID
      const logData: Record<string, any> = {
        category: 'api',
        requestId,
        method: req.method,
        path: isSensitive ? `${path} [SENSITIVE]` : path,
        status,
        durationMs,
      };

      if (isError) {
        logger.warn('API Error Response', logData);
      } else {
        logger.info('API Request', logData);
      }

      // Warn on slow requests (> 3s)
      if (durationMs > 3000) {
        logger.warn('Slow request detected', {
          category: 'api',
          requestId,
          path,
          durationMs,
        });
      }
    }
  };
}
