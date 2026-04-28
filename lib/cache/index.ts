/**
 * Caching Layer for Thea EHR
 *
 * Dual-provider cache with automatic fallback:
 * 1. If REDIS_URL is set and Redis is reachable → uses RedisCache
 * 2. Otherwise → uses in-memory MemoryCache
 *
 * The provider is resolved lazily on first access and upgraded to Redis
 * asynchronously when a REDIS_URL is configured. Until the probe completes,
 * the in-memory cache serves requests so there is never a cold-start delay.
 *
 * Usage:
 * ```ts
 * import { cache, cached } from '@/lib/cache';
 *
 * // Direct usage
 * await cache.set('key', value, 300); // 5 min TTL
 * const val = await cache.get<MyType>('key');
 *
 * // Get-or-set pattern
 * const data = await cached('key', () => fetchExpensiveData(), 300);
 * ```
 */

import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

/** Provider interface that both Memory and Redis implementations satisfy. */
export interface CacheProvider {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  clear(): Promise<void>;
  readonly size: number;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

class MemoryCache implements CacheProvider {
  private store = new Map<string, CacheEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run periodic cleanup every 60 seconds to evict expired entries.
    // Using `unref()` so this timer does not prevent the Node process from exiting.
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanup(), 60_000);
      if (typeof timer === 'object' && 'unref' in timer) {
        timer.unref();
      }
      this.cleanupInterval = timer;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Delete all keys matching a wildcard pattern.
   * Supports `*` as a wildcard (e.g. `opd:dashboard:*`).
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`, { category: 'system' });
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// ---------------------------------------------------------------------------
// Singleton — auto-upgrades to Redis when available
// ---------------------------------------------------------------------------

/**
 * The active cache provider. Starts as MemoryCache and is asynchronously
 * upgraded to RedisCache when REDIS_URL is set and the connection is healthy.
 */
let _provider: CacheProvider = new MemoryCache();
let _probeStarted = false;

/**
 * Kick off a non-blocking Redis probe. If Redis is reachable the singleton is
 * swapped to RedisCache. The probe runs at most once per process lifetime.
 */
function ensureProbed(): void {
  if (_probeStarted) return;
  _probeStarted = true;

  // Only probe if REDIS_URL is configured
  if (!process.env.REDIS_URL) return;

  // Dynamic import to avoid pulling ioredis into bundles that don't need it
  import('./redis')
    .then(async ({ RedisCache, isRedisAvailable }) => {
      const available = await isRedisAvailable();
      if (available) {
        _provider = new RedisCache();
        logger.info('Cache upgraded to Redis', { category: 'system' });
      } else {
        logger.info('Redis not reachable — staying with in-memory cache', { category: 'system' });
      }
    })
    .catch(() => {
      // Import or probe failed — stay on MemoryCache silently
    });
}

/**
 * Proxy object that delegates to whichever provider is currently active.
 * This means callers always use the same `cache` reference and automatically
 * get Redis once the probe succeeds.
 */
export const cache: CacheProvider = {
  get<T = unknown>(key: string): Promise<T | null> {
    ensureProbed();
    return _provider.get<T>(key);
  },
  set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    ensureProbed();
    return _provider.set(key, value, ttlSeconds);
  },
  delete(key: string): Promise<void> {
    ensureProbed();
    return _provider.delete(key);
  },
  deletePattern(pattern: string): Promise<number> {
    ensureProbed();
    return _provider.deletePattern(pattern);
  },
  clear(): Promise<void> {
    ensureProbed();
    return _provider.clear();
  },
  get size(): number {
    ensureProbed();
    return _provider.size;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get-or-set helper. Returns cached value if present; otherwise calls `fetcher`,
 * stores the result with the given TTL, and returns it.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const existing = await cache.get<T>(key);
  if (existing !== null) {
    logger.debug('Cache hit', { category: 'system', key });
    return existing;
  }
  logger.debug('Cache miss', { category: 'system', key });
  const value = await fetcher();
  await cache.set(key, value, ttlSeconds);
  return value;
}
