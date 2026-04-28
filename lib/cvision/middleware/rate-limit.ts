/**
 * In-memory sliding-window rate limiter.
 *
 * Production-ready: no external dependencies required.
 * For horizontal scaling with multiple instances, swap the store
 * for Redis via the cache adapter in lib/cvision/cache/redis.ts.
 */

/* ── Types ─────────────────────────────────────────────────────────── */

interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  points: number;
  /** Window duration in seconds */
  duration: number;
  /** Seconds to block after limit is hit (0 = just reject) */
  blockDuration?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/* ── Store ─────────────────────────────────────────────────────────── */

const store = new Map<string, { points: number; resetAt: number; blockedUntil?: number }>();

/**
 * Hard cap on the number of keys. When exceeded the oldest half of entries
 * (Map insertion order) are evicted before a new key is inserted.
 */
const MAX_STORE_SIZE = 10_000;

function evictOldest(count: number): void {
  let evicted = 0;
  for (const key of store.keys()) {
    if (evicted >= count) break;
    store.delete(key);
    evicted++;
  }
}

const _cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt && (!entry.blockedUntil || now > entry.blockedUntil)) {
      store.delete(key);
    }
  }
}, 60_000);

// Allow the Node.js process to exit even if this timer is active
if (_cleanupTimer && typeof _cleanupTimer === 'object' && 'unref' in _cleanupTimer) {
  (_cleanupTimer as ReturnType<typeof setInterval> & { unref(): void }).unref();
}

/* ── Configurations ────────────────────────────────────────────────── */

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  general:     { points: 100, duration: 60 },
  login:       { points: 5,   duration: 900, blockDuration: 900 },
  search:      { points: 30,  duration: 60 },
  export:      { points: 10,  duration: 3600 },
  webhook:     { points: 1000, duration: 3600 },
  bulkAction:  { points: 5,   duration: 300 },
};

/* ── Core ──────────────────────────────────────────────────────────── */

export function rateLimit(type: keyof typeof RATE_LIMITS, key: string): RateLimitResult {
  const config = RATE_LIMITS[type];
  if (!config) return { allowed: true, remaining: 999 };

  const storeKey = `${type}:${key}`;
  const now = Date.now();
  let entry = store.get(storeKey);

  // Blocked?
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  // Reset window if expired (or first-time insert)
  if (!entry || now > entry.resetAt) {
    if (!entry && store.size >= MAX_STORE_SIZE) {
      evictOldest(Math.floor(MAX_STORE_SIZE / 2));
    }
    entry = { points: 0, resetAt: now + config.duration * 1000 };
    store.set(storeKey, entry);
  }

  entry.points++;

  if (entry.points > config.points) {
    if (config.blockDuration) {
      entry.blockedUntil = now + config.blockDuration * 1000;
    }
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: config.points - entry.points };
}

/* ── Next.js Middleware Helper ──────────────────────────────────────── */

import { NextResponse } from 'next/server';

export function rateLimitResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) return null;
  return NextResponse.json(
    { ok: false, error: 'Too many requests', retryAfter: result.retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter ?? 60),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

/* ── API Versioning Helper ─────────────────────────────────────────── */

export function apiVersion(pathname: string): number {
  const match = pathname.match(/\/api\/v(\d+)\//);
  return match ? parseInt(match[1]) : 1;
}
