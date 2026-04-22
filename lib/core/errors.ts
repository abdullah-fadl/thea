/**
 * Unified Error Handler for Thea EHR API Routes
 *
 * Provides structured error classes and a `withErrorHandler` wrapper that
 * catches exceptions inside any API route handler and returns a consistent
 * JSON error response.
 *
 * Usage — wrapping a withAuthTenant route:
 * ```ts
 * export const POST = withAuthTenant(
 *   withErrorHandler(async (req, ctx) => {
 *     // ... handler code — thrown errors are caught automatically
 *   }),
 *   { platformKey: 'thea_health' }
 * );
 * ```
 *
 * Usage — wrapping a standalone handler:
 * ```ts
 * export async function POST(req: NextRequest) {
 *   return withErrorHandler(async () => {
 *     // ...
 *   })(req);
 * }
 * ```
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class UnprocessableError extends ApiError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422, 'UNPROCESSABLE');
    this.name = 'UnprocessableError';
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
  }
}

// ---------------------------------------------------------------------------
// Handler wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps an API route handler with automatic error catching.
 *
 * - Known `ApiError` subclasses → deterministic status + JSON body
 * - Unknown errors → 500 with a sanitised message in production
 *
 * The wrapper is transparent to TypeScript — it preserves the original
 * function signature so it can be nested inside `withAuthTenant()`.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function withErrorHandler<TArgs extends any[], TReturn>(
  handler: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn | NextResponse> {
  return async (...args: TArgs) => {
    try {
      const result = await handler(...args);
      if (result instanceof NextResponse) {
        applySecurityHeaders(result);
      }
      return result;
    } catch (error: unknown) {
      let errorResponse: NextResponse;

      // Known API errors — deterministic status code
      if (error instanceof ApiError) {
        errorResponse = NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode },
        );
      } else if (isPrismaError(error)) {
        // Prisma known-request errors (P2002 = unique constraint, P2025 = not found)
        const { status, body } = mapPrismaError(error);
        errorResponse = NextResponse.json(body, { status });
      } else {
        // Fallback — unknown / unexpected errors
        const isDev = process.env.NODE_ENV !== 'production';
        const message = isDev && error instanceof Error
          ? error.message
          : 'Internal server error';

        logger.error('[withErrorHandler] Unexpected error', { category: 'api', error: error instanceof Error ? error : undefined });

        errorResponse = NextResponse.json(
          { error: message, code: 'INTERNAL_ERROR' },
          { status: 500 },
        );
      }

      return applySecurityHeaders(errorResponse);
    }
  };
}

// ---------------------------------------------------------------------------
// Prisma error helpers
// ---------------------------------------------------------------------------

interface PrismaClientKnownRequestError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
}

function isPrismaError(err: unknown): err is PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string' &&
    ((err as Record<string, unknown>).code as string).startsWith('P')
  );
}

function mapPrismaError(err: PrismaClientKnownRequestError): {
  status: number;
  body: { error: string; code: string };
} {
  switch (err.code) {
    case 'P2002':
      return {
        status: 409,
        body: {
          error: 'A record with the same unique value already exists',
          code: 'DUPLICATE',
        },
      };
    case 'P2025':
      return {
        status: 404,
        body: { error: 'Record not found', code: 'NOT_FOUND' },
      };
    default:
      return {
        status: 500,
        body: { error: 'Database error', code: `DB_${err.code}` },
      };
  }
}
