/**
 * Imdad In-Memory Cache
 *
 * Simple TTL-based in-memory cache used for health checks
 * and short-lived data caching within the SCM platform.
 */

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

class ImdadCache {
  private store = new Map<string, CacheEntry>();

  /** Get a cached value. Returns undefined if missing or expired. */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /** Set a cached value with a TTL in seconds (default 300s / 5 min). */
  set<T = unknown>(key: string, value: T, ttlSeconds = 300): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /** Delete a specific key. */
  del(key: string): void {
    this.store.delete(key);
  }

  /** Clear the entire cache. */
  clear(): void {
    this.store.clear();
  }

  /** Return the number of entries currently in the cache (including expired). */
  size(): number {
    return this.store.size;
  }

  /** Evict expired entries. */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

/** Singleton cache instance used across the Imdad platform */
export const imdadCache = new ImdadCache();
