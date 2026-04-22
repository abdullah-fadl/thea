/**
 * Redis-backed Cache Provider for Thea EHR
 *
 * Implements the same CacheProvider interface as MemoryCache but stores data
 * in Redis for cross-instance consistency. Falls back gracefully if the Redis
 * connection is unavailable — the caller (lib/cache/index.ts) decides which
 * provider to use.
 *
 * Key format: `${prefix}${key}` — e.g. `thea:cache:opd:dashboard:tenant123`
 *
 * All values are JSON-serialised so complex objects survive the round-trip.
 */

import type { CacheProvider } from './index';
import { getRedis } from '@/lib/security/redis';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Redis Cache Implementation
// ---------------------------------------------------------------------------

export class RedisCache implements CacheProvider {
  private prefix: string;

  constructor(prefix = 'thea:cache:') {
    this.prefix = prefix;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  private getClient() {
    return getRedis();
  }

  // -----------------------------------------------------------------------
  // CacheProvider interface
  // -----------------------------------------------------------------------

  async get<T = unknown>(key: string): Promise<T | null> {
    const redis = this.getClient();
    if (!redis) return null;

    try {
      const raw = await redis.get(this.key(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn('RedisCache.get failed', { category: 'system', key, error: err });
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = this.getClient();
    if (!redis) return;

    try {
      const serialised = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await redis.setex(this.key(key), ttlSeconds, serialised);
      } else {
        await redis.set(this.key(key), serialised);
      }
    } catch (err) {
      logger.warn('RedisCache.set failed', { category: 'system', key, error: err });
    }
  }

  async delete(key: string): Promise<void> {
    const redis = this.getClient();
    if (!redis) return;

    try {
      await redis.del(this.key(key));
    } catch (err) {
      logger.warn('RedisCache.delete failed', { category: 'system', key, error: err });
    }
  }

  /**
   * Delete all keys matching a wildcard pattern.
   *
   * Uses SCAN so we never block the Redis server with a full KEYS command.
   * The `pattern` uses `*` as a wildcard (same convention as MemoryCache).
   */
  async deletePattern(pattern: string): Promise<number> {
    const redis = this.getClient();
    if (!redis) return 0;

    try {
      const fullPattern = this.key(pattern);
      let count = 0;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          const pipeline = redis.pipeline();
          for (const k of keys) {
            pipeline.del(k);
          }
          await pipeline.exec();
          count += keys.length;
        }
      } while (cursor !== '0');

      return count;
    } catch (err) {
      logger.warn('RedisCache.deletePattern failed', { category: 'system', pattern, error: err });
      return 0;
    }
  }

  /**
   * Clear ALL keys that belong to this cache prefix.
   *
   * Uses SCAN + pipeline delete to avoid blocking Redis.
   */
  async clear(): Promise<void> {
    const redis = this.getClient();
    if (!redis) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${this.prefix}*`,
          'COUNT',
          200,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          const pipeline = redis.pipeline();
          for (const k of keys) {
            pipeline.del(k);
          }
          await pipeline.exec();
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn('RedisCache.clear failed', { category: 'system', error: err });
    }
  }

  /**
   * Has — check if a key exists without deserialising.
   */
  async has(key: string): Promise<boolean> {
    const redis = this.getClient();
    if (!redis) return false;

    try {
      const exists = await redis.exists(this.key(key));
      return exists === 1;
    } catch {
      return false;
    }
  }

  /**
   * Approximate size — uses DBSIZE which covers the whole DB, not just our
   * prefix. For monitoring only, not exact.
   */
  get size(): number {
    // Redis doesn't have a synchronous size for a prefix.
    // Return -1 to indicate "unknown" — callers that care about size should
    // use the MemoryCache path.
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Probe utility — check if Redis is reachable
// ---------------------------------------------------------------------------

/**
 * Returns true if a Redis connection can be established and responds to PING.
 * Used by lib/cache/index.ts to decide which provider to use.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
