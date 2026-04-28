// =============================================================================
// NPHIES Retry Logic with Exponential Backoff
// =============================================================================

import { logger } from '@/lib/monitoring/logger';
import {
  NphiesConnectionError,
  NphiesTimeoutError,
  type NphiesRetryConfig,
  DEFAULT_RETRY_CONFIG,
} from './types';

/**
 * Executes an async operation with retry + exponential backoff.
 *
 * Only retries on transient errors (network, timeout, 5xx).
 * Does NOT retry on 4xx client errors.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
  config: Partial<NphiesRetryConfig> = {},
): Promise<T> {
  const cfg: NphiesRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry client errors (4xx) — they won't self-resolve
      if (isClientError(error)) {
        throw error;
      }

      const isLastAttempt = attempt === cfg.maxAttempts;
      if (isLastAttempt) {
        logger.error(`NPHIES ${label}: all ${cfg.maxAttempts} attempts failed`, {
          category: 'billing',
          attempt,
          error,
        });
        break;
      }

      const delay = Math.min(
        cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, attempt - 1),
        cfg.maxDelayMs,
      );

      logger.warn(`NPHIES ${label}: attempt ${attempt} failed, retrying in ${delay}ms`, {
        category: 'billing',
        attempt,
        nextDelay: delay,
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  // Wrap the last error in a more descriptive type
  if (isTimeoutError(lastError)) {
    throw new NphiesTimeoutError();
  }
  if (isNetworkError(lastError)) {
    throw new NphiesConnectionError(
      `NPHIES ${label}: connection failed after ${cfg.maxAttempts} attempts`,
      { originalError: lastError instanceof Error ? lastError.message : String(lastError) },
    );
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ErrorWithStatus {
  response?: { status?: number };
  statusCode?: number;
  status?: number;
}

interface ErrorWithCode extends Error {
  code?: string;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as ErrorWithStatus;
    return e.response?.status ?? e.statusCode ?? e.status;
  }
  return undefined;
}

function isClientError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return true;
  }
  return false;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('timeout') || (error as ErrorWithCode).code === 'ECONNABORTED';
  }
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as ErrorWithCode).code;
    return (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ENETUNREACH' ||
      code === 'ERR_NETWORK' ||
      error.message.includes('Network Error')
    );
  }
  return false;
}
