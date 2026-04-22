/**
 * Rate Limiting Infrastructure
 * Per-IP and per-account rate limiting with Redis-backed store (primary)
 * and in-memory fallback (single-instance / no Redis).
 */

import { RATE_LIMIT_CONFIG } from './config';
import { getRedis } from './redis';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

// In-memory store (fallback for single-instance deployments or no Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: {
  ip?: string;
  userId?: string;
}): string {
  // Use userId if available (more accurate), otherwise fall back to IP
  if (request.userId) {
    return `user:${request.userId}`;
  }
  return `ip:${request.ip || 'unknown'}`;
}

/**
 * Check rate limit (in-memory fallback)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);

    // Cleanup old entries periodically (every 1000 checks)
    if (rateLimitStore.size > 10000) {
      cleanupRateLimitStore();
    }

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Check if locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const allowed = entry.count <= maxAttempts;

  return {
    allowed,
    remaining: Math.max(0, maxAttempts - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Check rate limit with Redis (primary) — falls back to in-memory if Redis unavailable
 */
export async function checkRateLimitRedis(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();

  if (!redis) {
    // Fallback to in-memory implementation
    return checkRateLimit(key, maxAttempts, windowMs);
  }

  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;

  try {
    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.pexpire(windowKey, windowMs);
    }

    return {
      allowed: count <= maxAttempts,
      remaining: Math.max(0, maxAttempts - count),
      resetAt: (Math.floor(now / windowMs) + 1) * windowMs,
    };
  } catch {
    // Redis error — fall back to in-memory
    return checkRateLimit(key, maxAttempts, windowMs);
  }
}

/**
 * Lock an account/identifier (for account lockout)
 */
export async function lockAccount(key: string, durationMs: number): Promise<void> {
  // In-memory
  const entry = rateLimitStore.get(key) || {
    count: 0,
    resetAt: Date.now() + durationMs,
  };
  entry.lockedUntil = Date.now() + durationMs;
  rateLimitStore.set(key, entry);

  // Also set in Redis if available
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`lock:${key}`, '1', 'PX', durationMs);
    } catch {
      // Ignore Redis errors — in-memory lock is sufficient fallback
    }
  }
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(key: string): Promise<boolean> {
  // Check Redis first
  const redis = getRedis();
  if (redis) {
    try {
      const locked = await redis.get(`lock:${key}`);
      if (locked) return true;
    } catch {
      // Fall through to in-memory check
    }
  }

  // In-memory fallback
  const entry = rateLimitStore.get(key);
  if (!entry || !entry.lockedUntil) {
    return false;
  }

  const now = Date.now();
  if (now >= entry.lockedUntil) {
    // Lock expired, remove it
    entry.lockedUntil = undefined;
    rateLimitStore.set(key, entry);
    return false;
  }

  return true;
}

/**
 * Clear rate limit for a key (useful for testing or manual unlock)
 */
export async function clearRateLimit(key: string): Promise<void> {
  rateLimitStore.delete(key);

  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`lock:${key}`);
      // Clear all rate limit windows for this key
      const keys = await redis.keys(`rl:${key}:*`);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // Ignore
    }
  }
}

/**
 * Cleanup old entries from in-memory rate limit store
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt && (!entry.lockedUntil || now > entry.lockedUntil)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

/**
 * Rate limit middleware for login endpoint
 */
export async function rateLimitLogin(
  request: { ip?: string; userId?: string }
): Promise<{ allowed: boolean; remaining: number; resetAt: number; locked?: boolean }> {
  const clientId = getClientId(request);

  // Check if account is locked
  if (await isAccountLocked(clientId)) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS,
      locked: true,
    };
  }

  const result = await checkRateLimitRedis(
    clientId,
    RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
    RATE_LIMIT_CONFIG.LOGIN.WINDOW_MS
  );

  // Lock account if max attempts exceeded
  if (!result.allowed && request.userId) {
    await lockAccount(clientId, RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS);
  }

  return result;
}

/**
 * Rate limit middleware for general API endpoints
 */
export async function rateLimitAPI(
  request: { ip?: string; userId?: string }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const clientId = getClientId(request);

  return checkRateLimitRedis(
    clientId,
    RATE_LIMIT_CONFIG.API.MAX_REQUESTS,
    RATE_LIMIT_CONFIG.API.WINDOW_MS
  );
}

/**
 * Track failed login attempt (for account lockout)
 */
export async function trackFailedLogin(userId: string): Promise<void> {
  const key = `user:${userId}`;
  const result = await checkRateLimitRedis(
    key,
    RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS,
    RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS
  );

  if (!result.allowed) {
    await lockAccount(key, RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS);
  }
}

/**
 * Clear failed login attempts (on successful login)
 */
export async function clearFailedLogins(userId: string): Promise<void> {
  await clearRateLimit(`user:${userId}`);
}

// ---------------------------------------------------------------------------
// Category-specific rate limiters
// ---------------------------------------------------------------------------

/** Rate limit for AI/CDS endpoints (per-tenant) */
export async function rateLimitAI(
  request: { ip?: string; userId?: string; tenantId?: string },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = request.tenantId ? `ai:${request.tenantId}` : getClientId(request);
  return checkRateLimitRedis(key, RATE_LIMIT_CONFIG.AI.MAX_REQUESTS, RATE_LIMIT_CONFIG.AI.WINDOW_MS);
}

/** Rate limit for patient search endpoints */
export async function rateLimitSearch(
  request: { ip?: string; userId?: string },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimitRedis(getClientId(request), RATE_LIMIT_CONFIG.SEARCH.MAX_REQUESTS, RATE_LIMIT_CONFIG.SEARCH.WINDOW_MS);
}

/** Rate limit for data export endpoints */
export async function rateLimitExport(
  request: { ip?: string; userId?: string },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimitRedis(getClientId(request), RATE_LIMIT_CONFIG.EXPORT.MAX_REQUESTS, RATE_LIMIT_CONFIG.EXPORT.WINDOW_MS);
}

/** Rate limit for portal (patient-facing) endpoints */
export async function rateLimitPortal(
  request: { ip?: string },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimitRedis(`ip:${request.ip || 'unknown'}`, RATE_LIMIT_CONFIG.PORTAL.MAX_REQUESTS, RATE_LIMIT_CONFIG.PORTAL.WINDOW_MS);
}

/** Rate limit for OTP / SMS endpoints */
export async function rateLimitOTP(
  request: { ip?: string; phone?: string },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = request.phone ? `otp:${request.phone}` : `ip:${request.ip || 'unknown'}`;
  return checkRateLimitRedis(key, RATE_LIMIT_CONFIG.OTP.MAX_REQUESTS, RATE_LIMIT_CONFIG.OTP.WINDOW_MS);
}

/** Rate limit for PDF generation endpoints */
export async function rateLimitPDF(
  request: { ip?: string; userId?: string },
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimitRedis(getClientId(request), RATE_LIMIT_CONFIG.PDF.MAX_REQUESTS, RATE_LIMIT_CONFIG.PDF.WINDOW_MS);
}

// ---------------------------------------------------------------------------
// Next.js middleware helper — extracts IP from request headers
// ---------------------------------------------------------------------------

/**
 * Extract client IP from a Next.js request.
 * Checks X-Forwarded-For, X-Real-IP, then falls back to 'unknown'.
 */
export function getRequestIp(req: { headers: { get(name: string): string | null } }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
