/**
 * OPD API Logger
 * Logs request/response details for debugging and monitoring
 */

import { logger } from '@/lib/monitoring/logger';

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  tenantId?: string;
  userId?: string;
  statusCode: number;
  durationMs: number;
  error?: string;
}

export function logOpdRequest(entry: LogEntry): void {
  const marker = entry.statusCode >= 500 ? '[FAIL]' : entry.statusCode >= 400 ? '[WARN]' : '[OK]';
  const slow = entry.durationMs > 2000 ? ' [WARN] SLOW' : '';

  const level = entry.statusCode >= 500 ? 'error' : entry.statusCode >= 400 ? 'warn' : 'info';
  logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](
    `OPD ${entry.method} ${entry.path} → ${entry.statusCode}`,
    { category: 'opd', durationMs: entry.durationMs, tenantId: entry.tenantId, userId: entry.userId, error: entry.error }
  );

  // Log slow queries
  if (entry.durationMs > 5000) {
    logger.warn('OPD slow request', { category: 'opd', method: entry.method, path: entry.path, durationMs: entry.durationMs });
  }
}

/**
 * Wrap a Next.js API handler with logging
 */
export function withOpdLogging<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  path: string
): T {
  return (async (...args: any[]) => {
    const start = Date.now();
    try {
      const response = await handler(...args);
      logOpdRequest({
        timestamp: new Date().toISOString(),
        method: 'API',
        path,
        statusCode: response.status,
        durationMs: Date.now() - start,
      });
      return response;
    } catch (err: any) {
      logOpdRequest({
        timestamp: new Date().toISOString(),
        method: 'API',
        path,
        statusCode: 500,
        durationMs: Date.now() - start,
        error: err.message,
      });
      throw err;
    }
  }) as T;
}
