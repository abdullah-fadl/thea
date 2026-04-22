/**
 * Structured Logger for Thea EHR
 *
 * - Development: pretty-printed colored output
 * - Production: JSON format (ready for log aggregation — e.g. Datadog, CloudWatch)
 *
 * Usage:
 * ```ts
 * import { logger } from '@/lib/monitoring/logger';
 * logger.info('Encounter created', { tenantId, encounterId });
 * logger.error('Failed to save', { error, tenantId, userId });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'auth'
  | 'opd'
  | 'er'
  | 'ipd'
  | 'billing'
  | 'db'
  | 'api'
  | 'backup'
  | 'clinical'
  | 'quality'
  | 'system'
  | 'general'
  | 'integration'
  | 'obgyn'
  | 'portal';

export interface LogContext {
  /** Log category for filtering */
  category?: LogCategory;
  /** Tenant identifier */
  tenantId?: string;
  /** User identifier */
  userId?: string;
  /** API route or action name */
  route?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Error object */
  error?: unknown;
  /** Any additional metadata */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): number {
  const envLevel = String(process.env.LOG_LEVEL || '')
    .trim()
    .toLowerCase();
  if (envLevel in LEVELS) return LEVELS[envLevel as LogLevel];
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

const minLevel = resolveMinLevel();
const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

function sanitiseContext(ctx?: any): Record<string, unknown> | undefined {
  if (ctx == null) return undefined;

  // Handle non-object contexts (string, number, Error passed directly)
  if (typeof ctx !== 'object' || Array.isArray(ctx)) {
    return { detail: ctx };
  }
  if (ctx instanceof Error) {
    return { error: { message: ctx.message, name: ctx.name, stack: ctx.stack } };
  }

  const entries = Object.entries(ctx);
  if (entries.length === 0) return undefined;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    // Never log passwords, tokens, or secrets
    if (/password|secret|token|authorization|cookie/i.test(key)) continue;

    if (key === 'error' && value instanceof Error) {
      clean.error = { message: value.message, name: value.name, stack: value.stack };
    } else if (key === 'error' && value && typeof value === 'object' && 'message' in value) {
      clean.error = { message: (value as Error).message };
    } else {
      clean[key] = value;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function formatJson(level: LogLevel, message: string, ctx?: Record<string, unknown>): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...ctx,
  });
}

function formatPretty(level: LogLevel, message: string, ctx?: Record<string, unknown>): string {
  const color = COLORS[level];
  const tag = `${color}[${level.toUpperCase()}]${RESET}`;
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const meta = ctx ? ` ${JSON.stringify(ctx)}` : '';
  return `${ts} ${tag} ${message}${meta}`;
}

// ---------------------------------------------------------------------------
// Core log function
// ---------------------------------------------------------------------------

function log(level: LogLevel, message: string, context?: any): void {
  if (LEVELS[level] < minLevel) return;

  const ctx = sanitiseContext(context);
  const formatted = isProd ? formatJson(level, message, ctx) : formatPretty(level, message, ctx);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

// ---------------------------------------------------------------------------
// Exported logger
// ---------------------------------------------------------------------------

function mergeArgs(args: any[]): any {
  if (args.length === 0) return undefined;
  if (args.length === 1) return args[0];
  // Multiple extra args — wrap them in a details array
  return { details: args };
}

export const logger = {
  debug(message: string, ...args: any[]) {
    log('debug', message, mergeArgs(args));
  },
  info(message: string, ...args: any[]) {
    log('info', message, mergeArgs(args));
  },
  warn(message: string, ...args: any[]) {
    log('warn', message, mergeArgs(args));
  },
  error(message: string, ...args: any[]) {
    log('error', message, mergeArgs(args));
  },

  /**
   * Create a child logger with pre-filled context.
   * Useful for request-scoped logging:
   * ```ts
   * const log = logger.child({ tenantId, userId, route: '/api/opd/queue' });
   * log.info('Fetching queue');
   * ```
   */
  child(defaultContext: LogContext) {
    return {
      debug: (msg: string, ...args: any[]) => log('debug', msg, { ...defaultContext, ...mergeArgs(args) }),
      info: (msg: string, ...args: any[]) => log('info', msg, { ...defaultContext, ...mergeArgs(args) }),
      warn: (msg: string, ...args: any[]) => log('warn', msg, { ...defaultContext, ...mergeArgs(args) }),
      error: (msg: string, ...args: any[]) => log('error', msg, { ...defaultContext, ...mergeArgs(args) }),
    };
  },
};
