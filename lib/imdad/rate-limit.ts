/**
 * Imdad Rate Limiter
 *
 * In-memory sliding-window rate limiter keyed by tenant + user.
 * Prevents excessive API calls within a rolling 60-second window.
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitOptions {
  maxPerMinute?: number;
}

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

const DEFAULT_MAX_PER_MINUTE = 60;

/**
 * Check whether the given tenant + user is within the rate limit.
 * Returns { allowed, remaining, resetAt }.
 */
export function checkRateLimit(
  tenantId: string,
  userId: string,
  options?: RateLimitOptions,
): RateLimitResult {
  const max = options?.maxPerMinute ?? DEFAULT_MAX_PER_MINUTE;
  const key = `${tenantId}:${userId}`;
  const now = Date.now();
  const windowMs = 60_000;
  const cutoff = now - windowMs;

  let entry = windows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }

  // Prune old timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= max) {
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: max - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}
