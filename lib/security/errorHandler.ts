import { logger } from '@/lib/monitoring/logger';

/**
 * Safe error response — never expose internal details in production
 */

export function safeError(
  error: unknown,
  defaultMessage = 'Internal server error'
): { message: string; status: number } {
  if (process.env.NODE_ENV === 'development') {
    return {
      message: error instanceof Error ? error.message : defaultMessage,
      status: 500,
    };
  }

  // Production: generic message, log the real error server-side
  logger.error('API Error', { category: 'api', error });
  return {
    message: defaultMessage,
    status: 500,
  };
}
