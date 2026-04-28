import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Brute Force Protection & Suspicious Login Detection
 *
 * Adds actual blocking on top of the existing audit-only auth-risk system:
 *   - Per-IP rate limiting
 *   - Account locking after repeated failures
 *   - Suspicious activity detection (odd hours, rapid attempts, multi-user IP)
 *
 * Uses platform DB collections so checks work before a tenant is resolved.
 */

import { getPlatformCollection } from '@/lib/db/platformDb';

// ─── Types ───────────────────────────────────────────────────

export interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failReason?: 'INVALID_PASSWORD' | 'USER_NOT_FOUND' | 'ACCOUNT_LOCKED' | 'RATE_LIMITED' | 'INACTIVE_USER';
  tenantId?: string;
  timestamp: Date;
}

export interface AccountLock {
  email: string;
  lockedAt: Date;
  lockedUntil: Date;
  reason: string;
  attempts: number;
}

export interface SuspiciousActivity {
  type: 'BRUTE_FORCE' | 'NEW_DEVICE' | 'NEW_LOCATION' | 'ODD_HOURS' | 'RAPID_ATTEMPTS' | 'MULTIPLE_USERS_SAME_IP';
  email: string;
  ipAddress: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tenantId?: string;
  timestamp: Date;
  resolved: boolean;
}

// ─── Configuration ───────────────────────────────────────────

export const SECURITY_CONFIG = {
  maxFailedAttempts: 5,
  lockDurationMinutes: 30,
  attemptWindowMinutes: 15,
  rateLimitPerMinute: 10,
  suspiciousHoursStart: 0,  // midnight
  suspiciousHoursEnd: 5,    // 5 AM
  maxUsersPerIP: 3,
  cleanupDays: 90,
};

// ─── Helpers ─────────────────────────────────────────────────

async function attemptsCol() {
  return getPlatformCollection('cvision_login_attempts');
}
async function locksCol() {
  return getPlatformCollection('cvision_account_locks');
}
async function alertsCol() {
  return getPlatformCollection('cvision_suspicious_activity');
}

// ─── Account Lock ────────────────────────────────────────────

export async function isAccountLocked(email: string): Promise<{
  locked: boolean;
  lockedUntil?: Date;
  remainingMinutes?: number;
}> {
  try {
    const col = await locksCol();
    const lock = await col.findOne({
      email: email.toLowerCase(),
      lockedUntil: { $gt: new Date() },
    });
    if (lock) {
      const remaining = Math.ceil(((lock as Record<string, Date>).lockedUntil.getTime() - Date.now()) / 60000);
      return { locked: true, lockedUntil: (lock as Record<string, Date>).lockedUntil, remainingMinutes: remaining };
    }
  } catch (err) {
    logger.warn('[Security] isAccountLocked check failed (non-blocking):', err);
  }
  return { locked: false };
}

async function lockAccount(email: string, attempts: number, ipAddress: string): Promise<void> {
  const lockedUntil = new Date(Date.now() + SECURITY_CONFIG.lockDurationMinutes * 60 * 1000);
  try {
    const col = await locksCol();
    await col.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          email: email.toLowerCase(),
          lockedAt: new Date(),
          lockedUntil,
          reason: `${attempts} failed login attempts`,
          attempts,
        },
      },
      { upsert: true },
    );

    const ac = await alertsCol();
    await ac.insertOne({
      type: 'BRUTE_FORCE',
      email: email.toLowerCase(),
      ipAddress,
      description: `Account locked after ${attempts} failed attempts`,
      severity: 'HIGH',
      timestamp: new Date(),
      resolved: false,
    });
  } catch (err) {
    logger.warn('[Security] lockAccount failed (non-blocking):', err);
  }
}

export async function unlockAccount(email: string): Promise<void> {
  try {
    const col = await locksCol();
    await col.deleteMany({ email: email.toLowerCase() });
  } catch (err) {
    logger.warn('[Security] unlockAccount failed:', err);
  }
}

// ─── Rate Limiting ───────────────────────────────────────────

export async function checkRateLimit(ipAddress: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  try {
    const col = await attemptsCol();
    const count = await col.countDocuments({
      ipAddress,
      timestamp: { $gt: new Date(Date.now() - 60_000) },
    });
    if (count >= SECURITY_CONFIG.rateLimitPerMinute) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
  } catch (err) {
    logger.warn('[Security] checkRateLimit failed (non-blocking):', err);
  }
  return { allowed: true };
}

// ─── Record Attempt ──────────────────────────────────────────

export async function recordLoginAttempt(attempt: LoginAttempt): Promise<void> {
  try {
    const col = await attemptsCol();
    await col.insertOne({
      ...attempt,
      email: attempt.email.toLowerCase(),
      timestamp: attempt.timestamp || new Date(),
    });

    if (!attempt.success) {
      const failCount = await col.countDocuments({
        email: attempt.email.toLowerCase(),
        success: false,
        timestamp: { $gt: new Date(Date.now() - SECURITY_CONFIG.attemptWindowMinutes * 60_000) },
      });
      if (failCount >= SECURITY_CONFIG.maxFailedAttempts) {
        await lockAccount(attempt.email, failCount, attempt.ipAddress);
      }
    } else {
      // Successful login clears any existing lock
      const lc = await locksCol();
      await lc.deleteMany({ email: attempt.email.toLowerCase() });
    }

    await detectSuspiciousPatterns(attempt);
    await pruneOldRecords();
  } catch (err) {
    logger.warn('[Security] recordLoginAttempt failed (non-blocking):', err);
  }
}

// ─── Suspicious Activity Detection ───────────────────────────

async function detectSuspiciousPatterns(attempt: LoginAttempt): Promise<void> {
  try {
    const ac = await alertsCol();
    const col = await attemptsCol();

    // Odd-hours login
    const hour = new Date().getHours();
    if (hour >= SECURITY_CONFIG.suspiciousHoursStart && hour < SECURITY_CONFIG.suspiciousHoursEnd && attempt.success) {
      await ac.insertOne({
        type: 'ODD_HOURS',
        email: attempt.email.toLowerCase(),
        ipAddress: attempt.ipAddress,
        description: `Successful login at ${String(hour).padStart(2, '0')}:00 (unusual hours)`,
        severity: 'LOW',
        tenantId: attempt.tenantId,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Rapid attempts (5+ in 2 min)
    const rapidCount = await col.countDocuments({
      email: attempt.email.toLowerCase(),
      timestamp: { $gt: new Date(Date.now() - 2 * 60_000) },
    });
    if (rapidCount >= 5) {
      const existing = await ac.findOne({
        type: 'RAPID_ATTEMPTS',
        email: attempt.email.toLowerCase(),
        timestamp: { $gt: new Date(Date.now() - 5 * 60_000) },
        resolved: false,
      });
      if (!existing) {
        await ac.insertOne({
          type: 'RAPID_ATTEMPTS',
          email: attempt.email.toLowerCase(),
          ipAddress: attempt.ipAddress,
          description: `${rapidCount} login attempts in 2 minutes`,
          severity: 'MEDIUM',
          tenantId: attempt.tenantId,
          timestamp: new Date(),
          resolved: false,
        });
      }
    }

    // Multiple users from same IP
    const usersFromIP = await col.distinct('email', {
      ipAddress: attempt.ipAddress,
      timestamp: { $gt: new Date(Date.now() - 60 * 60_000) },
    });
    if (usersFromIP.length >= SECURITY_CONFIG.maxUsersPerIP) {
      const existing = await ac.findOne({
        type: 'MULTIPLE_USERS_SAME_IP',
        ipAddress: attempt.ipAddress,
        timestamp: { $gt: new Date(Date.now() - 60 * 60_000) },
        resolved: false,
      });
      if (!existing) {
        await ac.insertOne({
          type: 'MULTIPLE_USERS_SAME_IP',
          email: attempt.email.toLowerCase(),
          ipAddress: attempt.ipAddress,
          description: `${usersFromIP.length} different accounts attempted from same IP in 1 hour`,
          severity: 'HIGH',
          tenantId: attempt.tenantId,
          timestamp: new Date(),
          resolved: false,
        });
      }
    }
  } catch (err) {
    logger.warn('[Security] detectSuspiciousPatterns failed (non-blocking):', err);
  }
}

// ─── Cleanup ─────────────────────────────────────────────────

async function pruneOldRecords(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - SECURITY_CONFIG.cleanupDays * 24 * 60 * 60_000);
    const col = await attemptsCol();
    await col.deleteMany({ timestamp: { $lt: cutoff } });
  } catch { /* best-effort */ }
}

// ─── Query Helpers (for Security API) ────────────────────────

export async function getLoginHistory(email: string, limit = 20): Promise<any[]> {
  const col = await attemptsCol();
  return col.find({ email: email.toLowerCase() }).sort({ timestamp: -1 }).limit(limit).toArray();
}

export async function getSuspiciousActivities(resolved = false): Promise<any[]> {
  const ac = await alertsCol();
  return ac.find({ resolved }).sort({ timestamp: -1 }).limit(100).toArray();
}

export async function resolveActivity(activityId: string): Promise<void> {
  const { ObjectId } = await import('mongodb');
  const ac = await alertsCol();
  await ac.updateOne(
    { _id: new ObjectId(activityId) },
    { $set: { resolved: true, resolvedAt: new Date() } },
  );
}

export async function getLockedAccounts(): Promise<any[]> {
  const col = await locksCol();
  return col.find({ lockedUntil: { $gt: new Date() } }).sort({ lockedAt: -1 }).toArray();
}

export async function getSecurityStats(): Promise<{
  totalAttempts24h: number;
  failedAttempts24h: number;
  lockedAccounts: number;
  unresolvedAlerts: number;
  topFailedEmails: { email: string; count: number }[];
  topFailedIPs: { ip: string; count: number }[];
}> {
  const since24h = new Date(Date.now() - 24 * 60 * 60_000);
  const col = await attemptsCol();
  const lc = await locksCol();
  const ac = await alertsCol();

  const [totalAttempts24h, failedAttempts24h, lockedAccounts, unresolvedAlerts] = await Promise.all([
    col.countDocuments({ timestamp: { $gt: since24h } }),
    col.countDocuments({ timestamp: { $gt: since24h }, success: false }),
    lc.countDocuments({ lockedUntil: { $gt: new Date() } }),
    ac.countDocuments({ resolved: false }),
  ]);

  const topEmails = await col.aggregate([
    { $match: { success: false, timestamp: { $gt: since24h } } },
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]).toArray();

  const topIPs = await col.aggregate([
    { $match: { success: false, timestamp: { $gt: since24h } } },
    { $group: { _id: '$ipAddress', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]).toArray();

  return {
    totalAttempts24h,
    failedAttempts24h,
    lockedAccounts,
    unresolvedAlerts,
    topFailedEmails: topEmails.map((e: any) => ({ email: e._id, count: e.count })),
    topFailedIPs: topIPs.map((e: any) => ({ ip: e._id, count: e.count })),
  };
}

// ─── Index Hints ─────────────────────────────────────────────
// Run once in MongoDB shell or during deployment:
//   db.cvision_login_attempts.createIndex({ email: 1, timestamp: -1 })
//   db.cvision_login_attempts.createIndex({ ipAddress: 1, timestamp: -1 })
//   db.cvision_login_attempts.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }) // 90 day TTL
//   db.cvision_account_locks.createIndex({ email: 1 })
//   db.cvision_suspicious_activity.createIndex({ resolved: 1, timestamp: -1 })
