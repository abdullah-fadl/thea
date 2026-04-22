// ─── CVision Rate Limiter ────────────────────────────────────────────────────
// In-memory sliding-window rate limiting middleware for CVision API protection.
// No Redis dependency — uses a Map with per-key timestamp arrays.
// Supports preset profiles, bilingual 429 responses, standard rate-limit
// headers, and a composable withRateLimit wrapper for API route handlers.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Function to extract a rate-limit key from the request (default: tenant+user or IP) */
  keyGenerator?: (req: Request) => string;
  /** If true, successful responses (2xx) don't count against the limit */
  skipSuccessfulRequests?: boolean;
  /** Custom English error message for 429 responses */
  message?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Maximum requests allowed per window */
  limit: number;
  /** When the current window resets */
  resetAt: Date;
  /** Seconds until the client should retry (only when allowed=false) */
  retryAfter?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Pre-configured rate limit profiles for common endpoint categories.
 *
 * - **strict**:   Auth endpoints (login, password reset)
 * - **standard**: Normal CRUD API routes
 * - **relaxed**:  Read-heavy / listing endpoints
 * - **ai**:       AI inference endpoints (expensive operations)
 * - **upload**:   File upload endpoints (5 min window)
 */
export const RATE_LIMIT_PRESETS = {
  strict:   { windowMs: 60_000,  maxRequests: 20  },
  standard: { windowMs: 60_000,  maxRequests: 60  },
  relaxed:  { windowMs: 60_000,  maxRequests: 120 },
  ai:       { windowMs: 60_000,  maxRequests: 10  },
  upload:   { windowMs: 300_000, maxRequests: 10  },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

const DEFAULT_MESSAGE = 'Too many requests. Please try again later.';

// ─── In-Memory Sliding Window Store ──────────────────────────────────────────

interface StoreEntry {
  timestamps: number[];
}

const store = new Map<string, StoreEntry>();

/**
 * Periodic cleanup: remove entries whose newest timestamp is older than
 * the largest possible window (5 minutes = upload preset). Runs every 5 min.
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_WINDOW_MS = 300_000; // matches the upload preset

/**
 * Hard cap on the number of keys in the store. When exceeded, the oldest
 * half of entries (by insertion order, which Map preserves) are evicted
 * before a new key is inserted. This prevents unbounded memory growth
 * under heavy traffic or a large number of distinct clients.
 */
const MAX_STORE_SIZE = 10_000;

/**
 * Evict the oldest `count` entries from the store (Map iteration order ==
 * insertion order, so the first entries are the oldest).
 */
function evictOldest(count: number): void {
  let evicted = 0;
  for (const key of store.keys()) {
    if (evicted >= count) break;
    store.delete(key);
    evicted++;
  }
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer !== null) return;
  if (typeof setInterval === 'undefined') return;

  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - MAX_WINDOW_MS;
    const keysToDelete: string[] = [];

    store.forEach((entry, key) => {
      // If the newest timestamp is older than the cutoff, the whole entry is stale
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the process to exit even if the timer is running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// Start the periodic cleanup on module load (server-side only)
startCleanupTimer();

// ─── Default Key Generator ───────────────────────────────────────────────────

/**
 * Extracts a rate-limit key from a request. Priority:
 * 1. x-tenant-id + x-user-id headers (set by withAuthTenant)
 * 2. x-forwarded-for (client IP behind proxy)
 * 3. 'anonymous' fallback
 */
function defaultKeyGenerator(req: Request): string {
  const headers = req.headers;

  const tenantId = headers.get('x-tenant-id');
  const userId = headers.get('x-user-id');
  if (tenantId && userId) {
    return `tenant:${tenantId}:user:${userId}`;
  }

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (client IP) from the comma-separated list
    const ip = forwarded.split(',')[0].trim();
    return `ip:${ip}`;
  }

  return 'anonymous';
}

// ─── Core: checkRateLimit ────────────────────────────────────────────────────

/**
 * Check whether a request identified by `key` is within the rate limit.
 *
 * Uses a **sliding window** algorithm: keeps an array of request timestamps
 * per key and counts only those that fall within `[now - windowMs, now]`.
 *
 * If allowed, the current timestamp is appended to the window.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests } = config;
  const windowStart = now - windowMs;

  // Get or create entry
  let entry = store.get(key);
  if (!entry) {
    // Evict the oldest half when we're at the hard cap to make room
    if (store.size >= MAX_STORE_SIZE) {
      evictOldest(Math.floor(MAX_STORE_SIZE / 2));
    }
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Slide the window: keep only timestamps within the current window
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  if (entry.timestamps.length < maxRequests) {
    // Allowed — record this request
    entry.timestamps.push(now);

    // The window resets when the oldest timestamp in the window expires
    const oldestInWindow = entry.timestamps[0];
    const resetAt = new Date(oldestInWindow + windowMs);

    return {
      allowed: true,
      remaining: maxRequests - entry.timestamps.length,
      limit: maxRequests,
      resetAt,
    };
  }

  // Denied — calculate when the oldest request in the window will expire
  const oldestTimestamp = entry.timestamps[0];
  const resetAtMs = oldestTimestamp + windowMs;
  const retryAfter = Math.ceil((resetAtMs - now) / 1000);

  return {
    allowed: false,
    remaining: 0,
    limit: maxRequests,
    resetAt: new Date(resetAtMs),
    retryAfter: Math.max(1, retryAfter),
  };
}

// ─── Rate Limit Headers ──────────────────────────────────────────────────────

function setRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): void {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));

  if (!result.allowed && result.retryAfter != null) {
    response.headers.set('Retry-After', String(result.retryAfter));
  }
}

function build429Response(config: RateLimitConfig, result: RateLimitResult): NextResponse {
  const body = {
    error: config.message || DEFAULT_MESSAGE,
  };

  const response = NextResponse.json(body, { status: 429 });
  setRateLimitHeaders(response, result);
  return response;
}

// ─── rateLimitMiddleware ─────────────────────────────────────────────────────

/**
 * Create a rate-limit check function for use inside route handlers.
 *
 * Returns `null` when the request is allowed (continue to handler logic),
 * or a pre-built 429 `NextResponse` when the limit is exceeded.
 *
 * ```ts
 * const limiter = rateLimitMiddleware({ windowMs: 60000, maxRequests: 30 });
 *
 * export const POST = withAuthTenant(async (request, ctx) => {
 *   const blocked = await limiter(request);
 *   if (blocked) return blocked;
 *   // ... handler logic
 * }, { platformKey: 'cvision', permissionKey: 'employees.write' });
 * ```
 */
export function rateLimitMiddleware(
  config: RateLimitConfig,
): (req: Request) => Promise<NextResponse | null> {
  const keyGen = config.keyGenerator || defaultKeyGenerator;

  return async (req: Request): Promise<NextResponse | null> => {
    const key = keyGen(req);
    const result = checkRateLimit(key, config);

    if (result.allowed) {
      return null;
    }

    return build429Response(config, result);
  };
}

// ─── withRateLimit ───────────────────────────────────────────────────────────

type RouteHandler = (...args: any[]) => Promise<NextResponse>;

/**
 * Wrap an API route handler with rate limiting.
 *
 * Accepts either a preset name (`'strict'`, `'standard'`, etc.) or a full
 * `RateLimitConfig` object. The rate-limit check runs before the handler;
 * rate-limit headers are added to both successful and rejected responses.
 *
 * If `skipSuccessfulRequests` is enabled and the handler returns a 2xx status,
 * the request timestamp is removed so it doesn't count against the limit.
 *
 * ```ts
 * export const GET = withRateLimit(
 *   withAuthTenant(async (request, ctx) => {
 *     return NextResponse.json({ data: [] });
 *   }, { platformKey: 'cvision', permissionKey: 'employees.read' }),
 *   'relaxed',
 * );
 * ```
 */
export function withRateLimit(
  handler: RouteHandler,
  presetOrConfig: RateLimitPreset | RateLimitConfig,
): RouteHandler {
  // Resolve preset to config
  const baseConfig: RateLimitConfig =
    typeof presetOrConfig === 'string'
      ? { ...RATE_LIMIT_PRESETS[presetOrConfig] }
      : { ...presetOrConfig };

  const keyGen = baseConfig.keyGenerator || defaultKeyGenerator;

  return async (...args: any[]): Promise<NextResponse> => {
    // The first argument is always the Request object
    const request: Request = args[0];
    const key = keyGen(request);
    const result = checkRateLimit(key, baseConfig);

    // Blocked — return 429
    if (!result.allowed) {
      return build429Response(baseConfig, result);
    }

    // Allowed — call the actual handler
    const response: NextResponse = await handler(...args);

    // If skipSuccessfulRequests, remove the timestamp we just added for 2xx responses
    if (baseConfig.skipSuccessfulRequests && response.status >= 200 && response.status < 300) {
      const entry = store.get(key);
      if (entry && entry.timestamps.length > 0) {
        // Remove the most recently added timestamp (the one we just pushed)
        entry.timestamps.pop();
      }
    }

    // Add rate-limit headers to the successful response
    setRateLimitHeaders(response, result);

    return response;
  };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Clear rate-limit data for a specific key, or all keys if no key is provided.
 * Useful for testing and admin operations.
 */
export function clearRateLimit(key?: string): void {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}

/**
 * Return diagnostic statistics about the rate-limiter's in-memory store.
 */
export function getRateLimitStats(): {
  totalKeys: number;
  activeKeys: number;
  memoryEstimate: string;
} {
  const now = Date.now();
  let activeKeys = 0;
  let totalTimestamps = 0;

  store.forEach((entry) => {
    // An entry is "active" if it has at least one timestamp within the max window
    const hasActive = entry.timestamps.some(ts => ts > now - MAX_WINDOW_MS);
    if (hasActive) activeKeys++;
    totalTimestamps += entry.timestamps.length;
  });

  // Rough memory estimate:
  //   Each key: ~100 bytes (string avg)
  //   Each timestamp: 8 bytes (number)
  //   Map overhead per entry: ~80 bytes
  const bytesEstimate = store.size * (100 + 80) + totalTimestamps * 8;
  const kb = (bytesEstimate / 1024).toFixed(1);
  const memoryEstimate = bytesEstimate < 1024 * 1024
    ? `${kb} KB`
    : `${(bytesEstimate / (1024 * 1024)).toFixed(2)} MB`;

  return {
    totalKeys: store.size,
    activeKeys,
    memoryEstimate,
  };
}
