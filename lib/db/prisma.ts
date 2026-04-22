import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '@/lib/monitoring/logger';

// =============================================================================
// Prisma Client Singleton (PostgreSQL via Supabase)
// =============================================================================
// Uses lazy initialization via Proxy to avoid crashing during Next.js build
// phase when no database connection is available.
// Prisma v7 requires a driver adapter for the "client" engine type.

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-export';

// ─── Connection Pool Metrics ──────────────────────────────────────────────
// Exposed for health checks and monitoring endpoints
export const poolMetrics = {
  totalConnections: 0,
  idleConnections: 0,
  waitingRequests: 0,
  lastChecked: 0,
};

function createPrismaClient(): PrismaClient {
  // Use DATABASE_URL (transaction pooler port 6543) — only IPv4-compatible option on free tier
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('[PRISMA] DATABASE_URL/DIRECT_URL is not set');
  }

  // Pool size tuning:
  // - Supabase free tier allows ~60 direct connections
  // - Transaction pooler (pgbouncer on 6543) multiplexes, so client-side pool can be moderate
  // - Too many client-side connections overwhelm pgbouncer
  // - Too few causes queuing under load
  const maxPoolSize = parseInt(process.env.DB_POOL_MAX || '15', 10);
  const minPoolSize = parseInt(process.env.DB_POOL_MIN || '2', 10);

  const adapter = new PrismaPg(
    {
      connectionString,
      max: maxPoolSize,
      min: minPoolSize,
      idleTimeoutMillis: 30_000,       // close idle connections after 30s
      connectionTimeoutMillis: 10_000,  // fail if can't connect in 10s
      allowExitOnIdle: false,           // keep pool alive in long-running server
    },
    {
      onPoolError: (err) => {
        logger.error('PG pool error', { category: 'db', error: err.message });
      },
      onConnectionError: (err) => {
        logger.error('PG connection error', { category: 'db', error: err.message });
      },
    }
  );

  const logLevel = process.env.NODE_ENV === 'development'
    ? (['warn', 'error'] as const)
    : (['error'] as const);

  const client = new PrismaClient({
    adapter,
    log: [...logLevel],
  });

  logger.info('PostgreSQL client initialized', {
    category: 'db',
    poolMax: maxPoolSize,
    poolMin: minPoolSize,
  });
  return client;
}

function getPrismaClient(): PrismaClient {
  if (globalThis.__prismaClient) return globalThis.__prismaClient;

  const client = createPrismaClient();
  // Always cache so we reuse one connection pool (avoids "Too many database connections" in production).
  globalThis.__prismaClient = client;
  return client;
}

/**
 * Lazy PrismaClient singleton.
 * Uses a Proxy to defer initialization until first property access at runtime.
 * This prevents PrismaClient from being instantiated during Next.js build phase.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    // During build phase, return safe no-ops for common operations
    if (isBuildPhase) {
      if (prop === '$connect' || prop === '$disconnect') {
        return async () => {};
      }
      if (prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
        return async () => [];
      }
      if (prop === '$transaction') {
        return async (fn: any) => {
          if (typeof fn === 'function') return fn(prisma);
          return [];
        };
      }
      // For model access during build, return a proxy that returns empty results
      if (typeof prop === 'string' && !prop.startsWith('$') && prop !== 'then') {
        return new Proxy({}, {
          get() {
            return async () => null;
          }
        });
      }
    }
    const client = getPrismaClient();
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/** Type-safe accessor for Prisma delegates not yet in the generated schema. */
export type PrismaModelDelegate = { create: (args: Record<string, unknown>) => Promise<unknown>; findMany: (args?: Record<string, unknown>) => Promise<unknown[]>; findFirst: (args?: Record<string, unknown>) => Promise<unknown | null>; update: (args: Record<string, unknown>) => Promise<unknown>; aggregate: (args?: Record<string, unknown>) => Promise<unknown>; count: (args?: Record<string, unknown>) => Promise<number>; delete: (args: Record<string, unknown>) => Promise<unknown>; upsert: (args: Record<string, unknown>) => Promise<unknown> };

/** Access a Prisma model delegate that may not be in generated types yet. */
export function prismaModel(name: string): PrismaModelDelegate {
  return (prisma as unknown as Record<string, PrismaModelDelegate>)[name];
}

export default prisma;
