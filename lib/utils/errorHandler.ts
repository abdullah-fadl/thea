import { logger } from '@/lib/monitoring/logger';

const ERROR_MESSAGES: Record<string, string> = {
  ECONNREFUSED: 'Unable to connect to the server. Please try again later.',
  ETIMEDOUT: 'Request timed out. Please try again.',
  MongoServerError: 'A database error occurred. Please try again.',
  ValidationError: 'Please check your input and try again.',
  UnauthorizedError: 'You are not authorized to perform this action.',
  ForbiddenError: 'Access denied.',
  NotFoundError: 'The requested resource was not found.',
};

export function sanitizeErrorForUser(error: unknown): string {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : String(error);
  }

  if (error instanceof Error) {
    for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
      if (error.name.includes(key) || error.message.includes(key)) {
        return message;
      }
    }

    logger.error('Unexpected error', { category: 'general', error });
    return 'An unexpected error occurred. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}
