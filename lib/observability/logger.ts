/**
 * Phase 8.6 — Structured logging baseline.
 *
 * A thin JSON-line logger that ops can ship to Datadog / Loki / CloudWatch
 * without any wrapper. Every line is a single JSON object on stdout/stderr,
 * which is the lowest-common-denominator format every modern log aggregator
 * understands.
 *
 * Why a new wrapper instead of reusing `lib/monitoring/logger.ts`:
 *   - The monitoring logger emits pretty-printed colored output in dev and
 *     JSON in prod. That's fine for human ops but inconsistent for log
 *     ingestion pipelines, which need a stable schema across environments.
 *   - This logger ALWAYS emits JSON, ALWAYS includes the phase-8.6 context
 *     fields (tenantId, userId, category, requestId), and never adds ANSI
 *     color codes that break log parsers.
 *
 * Migration policy (per Phase 8.6 plan):
 *   - Add this wrapper as the canonical observability hook.
 *   - Do NOT refactor existing `console.log` / `lib/monitoring/logger`
 *     callers in this phase. They keep working. New code added in 8.6+
 *     should prefer this logger.
 *
 * Usage:
 *   import { obs } from '@/lib/observability/logger';
 *
 *   obs.info('encounter.created', { tenantId, userId, category: 'opd', encounterId });
 *
 *   // Request-scoped child binds the per-request fields once:
 *   const log = obs.child({ tenantId, userId, requestId, category: 'opd' });
 *   log.warn('queue.full', { queueDepth: 42 });
 *   log.error('encounter.persist_failed', { error: err });
 *
 * Silencing in tests:
 *   - LOG_LEVEL=silent  → no output
 *   - NODE_ENV=test     → defaults to 'silent' unless LOG_LEVEL is set
 *   - Tests that want to assert on log lines should override LOG_LEVEL
 *     before importing this module (or call `obs.__setLevelForTest()`).
 */

export type ObsLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_PRIORITY: Record<ObsLevel | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
  silent: 999,
};

export interface ObsContext {
  tenantId?: string;
  userId?: string;
  category?: string;
  requestId?: string;
  [extra: string]: unknown;
}

interface ObsRecord {
  timestamp: string;
  level: ObsLevel;
  message: string;
  tenantId?: string;
  userId?: string;
  category?: string;
  requestId?: string;
  [extra: string]: unknown;
}

function resolveMinLevel(): number {
  const raw = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
  if (raw && raw in LEVEL_PRIORITY) {
    return LEVEL_PRIORITY[raw as ObsLevel | 'silent'];
  }
  if (process.env.NODE_ENV === 'test') return LEVEL_PRIORITY.silent;
  if (process.env.NODE_ENV === 'production') return LEVEL_PRIORITY.info;
  return LEVEL_PRIORITY.debug;
}

let minLevel = resolveMinLevel();

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function buildRecord(
  level: ObsLevel,
  message: string,
  context: ObsContext | undefined,
): ObsRecord {
  const rec: ObsRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (!context) return rec;

  for (const [key, value] of Object.entries(context)) {
    // Never log credentials.
    if (/password|secret|token|authorization|cookie|api[_-]?key/i.test(key)) continue;
    if (key === 'error') {
      rec.error = serializeError(value);
    } else {
      rec[key] = value;
    }
  }
  return rec;
}

function emit(level: ObsLevel, message: string, context?: ObsContext): void {
  if (LEVEL_PRIORITY[level] < minLevel) return;

  const line = JSON.stringify(buildRecord(level, message, context));
  // stderr for warn+ so log shippers can split severity cheaply.
  if (level === 'debug' || level === 'info') {
    process.stdout.write(line + '\n');
  } else {
    process.stderr.write(line + '\n');
  }
}

export interface ObsLogger {
  debug(message: string, context?: ObsContext): void;
  info(message: string, context?: ObsContext): void;
  warn(message: string, context?: ObsContext): void;
  error(message: string, context?: ObsContext): void;
  fatal(message: string, context?: ObsContext): void;
  child(bound: ObsContext): ObsLogger;
}

function makeLogger(bound?: ObsContext): ObsLogger {
  const merge = (ctx?: ObsContext): ObsContext | undefined => {
    if (!bound && !ctx) return undefined;
    return { ...(bound || {}), ...(ctx || {}) };
  };
  return {
    debug: (m, c) => emit('debug', m, merge(c)),
    info:  (m, c) => emit('info',  m, merge(c)),
    warn:  (m, c) => emit('warn',  m, merge(c)),
    error: (m, c) => emit('error', m, merge(c)),
    fatal: (m, c) => emit('fatal', m, merge(c)),
    child: (extraBound) => makeLogger({ ...(bound || {}), ...extraBound }),
  };
}

export const obs: ObsLogger & {
  /** Test hook — override the minimum level at runtime. */
  __setLevelForTest: (level: ObsLevel | 'silent') => void;
  /** Test hook — re-read LOG_LEVEL / NODE_ENV from env. */
  __resetLevelForTest: () => void;
} = Object.assign(makeLogger(), {
  __setLevelForTest: (level: ObsLevel | 'silent') => {
    minLevel = LEVEL_PRIORITY[level];
  },
  __resetLevelForTest: () => {
    minLevel = resolveMinLevel();
  },
});
