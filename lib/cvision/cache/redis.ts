import { logger } from '@/lib/monitoring/logger';
/**
 * Caching layer with Redis primary / in-memory fallback.
 *
 * When REDIS_HOST is set the module connects via ioredis;
 * otherwise it uses a simple Map-based LRU to keep the app
 * fully functional in dev environments without Redis.
 */

/* ── In-Memory Fallback ────────────────────────────────────────────── */

class MemoryCache {
  private store = new Map<string, { data: string; expiresAt: number }>();
  private maxSize = 5000;

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.data;
  }

  set(key: string, value: string, ttlSeconds: number) {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { data: value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string) { this.store.delete(key); }

  keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return [...this.store.keys()].filter(k => regex.test(k));
  }

  flushall() { this.store.clear(); }
}

/* ── Adapter interface ─────────────────────────────────────────────── */

interface CacheAdapter {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<void>;
}

/* ── Redis adapter (lazy-connected) ────────────────────────────────── */

let _redisAdapter: CacheAdapter | null = null;

async function getRedisAdapter(): Promise<CacheAdapter> {
  if (_redisAdapter) return _redisAdapter;

  const host = process.env.REDIS_HOST;
  if (host) {
    try {
      // eslint-disable-next-line
      const { default: Redis } = await (import('ioredis') as Promise<{ default: new (...args: any[]) => any }>);
      const client = new Redis({
        host,
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        keyPrefix: 'cvision:',
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
      });
      await client.connect();
      _redisAdapter = {
        get: (k) => client.get(k),
        setex: (k, t, v) => client.setex(k, t, v).then(() => {}),
        del: (k) => client.del(k).then(() => {}),
        keys: (p) => client.keys(p),
        publish: (c, m) => client.publish(c, m).then(() => {}),
      };
      logger.info('[Cache] Connected to Redis');
      return _redisAdapter;
    } catch {
      logger.warn('[Cache] Redis connection failed — falling back to in-memory');
    }
  }

  // Fallback
  const mem = new MemoryCache();
  _redisAdapter = {
    get: async (k) => mem.get(k),
    setex: async (k, t, v) => mem.set(k, v, t),
    del: async (k) => mem.del(k),
    keys: async (p) => mem.keys(p),
    publish: async () => {},
  };
  return _redisAdapter;
}

/* ── Public API ────────────────────────────────────────────────────── */

export async function cacheGet<T>(key: string): Promise<T | null> {
  const adapter = await getRedisAdapter();
  const data = await adapter.get(key);
  if (!data) return null;
  try { return JSON.parse(data) as T; } catch { return null; }
}

export async function cacheSet(key: string, data: any, ttlSeconds = 300): Promise<void> {
  const adapter = await getRedisAdapter();
  await adapter.setex(key, ttlSeconds, JSON.stringify(data));
}

export async function cacheDelete(key: string): Promise<void> {
  const adapter = await getRedisAdapter();
  await adapter.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const adapter = await getRedisAdapter();
  const keys = await adapter.keys(pattern);
  for (const k of keys) await adapter.del(k);
}

/* ── Cache Config (TTL by key pattern) ─────────────────────────────── */

export const CACHE_CONFIG: Record<string, number> = {
  'tenant:settings':       3600,
  'tenant:roles':          3600,
  'salary:structure':      3600,
  'insurance:providers':   3600,
  'policies:list':         1800,
  'employees:list':        300,
  'employees:count':       300,
  'employees:byDepartment': 300,
  'org:chart':             600,
  'directory:search':      120,
  'attendance:today':      60,
  'dashboard:stats':       60,
  'notifications:unread':  30,
  'approvals:pending':     30,
};

/* ── Invalidation Helpers ──────────────────────────────────────────── */

export async function invalidateEmployeeCache(tenantId: string, _employeeId?: string) {
  await cacheDeletePattern(`cvision:employees:*:${tenantId}*`);
  await cacheDeletePattern(`cvision:org:chart:${tenantId}`);
  await cacheDeletePattern(`cvision:directory:*:${tenantId}*`);
  await cacheDeletePattern(`cvision:dashboard:stats:${tenantId}`);
}

export async function invalidateAttendanceCache(tenantId: string) {
  await cacheDeletePattern(`cvision:attendance:*:${tenantId}*`);
  await cacheDeletePattern(`cvision:dashboard:stats:${tenantId}`);
}

/* ── Cached Query Pattern ──────────────────────────────────────────── */

export async function cachedQuery<T>(
  cacheKey: string,
  ttl: number,
  queryFn: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(cacheKey);
  if (cached !== null) return cached;
  const result = await queryFn();
  await cacheSet(cacheKey, result, ttl);
  return result;
}

/* ── Session Store ─────────────────────────────────────────────────── */

export const sessionStore = {
  async get(sessionId: string) { return cacheGet(`session:${sessionId}`); },
  async set(sessionId: string, data: any, ttl = 86400) { await cacheSet(`session:${sessionId}`, data, ttl); },
  async destroy(sessionId: string) { await cacheDelete(`session:${sessionId}`); },
};

/* ── Pub/Sub (Redis only — noop on memory) ─────────────────────────── */

export async function publishNotification(tenantId: string, userId: string, notification: any) {
  const adapter = await getRedisAdapter();
  await adapter.publish(`notifications:${tenantId}:${userId}`, JSON.stringify(notification));
}
