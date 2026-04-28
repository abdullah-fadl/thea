/**
 * Enhanced Session Management
 * Includes idle timeout, absolute lifetime, and session rotation
 *
 * Migrated from MongoDB to Prisma (PostgreSQL).
 */

import { prisma } from '@/lib/db/prisma';
import { Session } from '@/lib/models/Session';
import { v4 as uuidv4 } from 'uuid';
import { SESSION_CONFIG } from './config';
import { logger } from '@/lib/monitoring/logger';

/**
 * Resolve a tenant key (e.g. 'hmg-whh') to its UUID primary key.
 * Returns null if the key is already a UUID or not found.
 */
async function resolveTenantId(tenantKey?: string): Promise<string | null> {
  if (!tenantKey) return null;

  // If it already looks like a UUID, return it directly
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantKey)) {
    return tenantKey;
  }

  const tenant = await prisma.tenant.findFirst({ where: { tenantId: tenantKey } });
  return tenant?.id ?? null;
}

/**
 * Create a new session with enhanced security features
 */
export async function createSecureSession(
  userId: string,
  userAgent?: string,
  ip?: string,
  tenantId?: string
): Promise<string> {
  const sessionId = uuidv4();
  const now = new Date();

  // Calculate expiration times
  const idleExpiresAt = new Date(now.getTime() + SESSION_CONFIG.IDLE_TIMEOUT_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS);

  // Use the earlier expiration time
  const expiresAt = idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt;

  // Resolve tenant key to UUID if needed
  const resolvedTenantId = await resolveTenantId(tenantId);

  await prisma.session.create({
    data: {
      sessionId,
      userId,
      tenantId: resolvedTenantId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      idleExpiresAt,
      absoluteExpiresAt,
      lastActivityAt: now,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    },
  });

  // Update user's activeSessionId
  await prisma.user.update({
    where: { id: userId },
    data: {
      activeSessionId: sessionId,
      updatedAt: new Date(),
    },
  });

  return sessionId;
}

/**
 * Validate session with idle timeout and absolute lifetime checks
 */
export async function validateSecureSession(
  userId: string,
  sessionId: string
): Promise<{
  valid: boolean;
  expired?: boolean;
  idleExpired?: boolean;
  absoluteExpired?: boolean;
  message?: string;
  shouldRotate?: boolean;
}> {
  const session = await prisma.session.findFirst({
    where: { userId, sessionId },
  });

  if (!session) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Session not found', { category: 'auth', userId, sessionId });
    }
    return { valid: false, message: 'Session not found' };
  }

  const now = new Date();

  // Check enhanced timeouts if present, otherwise fall back to expiresAt
  if (!session.idleExpiresAt && !session.absoluteExpiresAt) {
    // Old session format - use expiresAt
    if (now > session.expiresAt) {
      await prisma.session.delete({ where: { sessionId } });
      return { valid: false, expired: true, message: 'Session expired' };
    }
  } else {
    // New session format - check enhanced timeouts
    const effectiveAbsoluteExpiresAt = session.absoluteExpiresAt ??
      new Date(session.createdAt.getTime() + SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS);

    if (now > effectiveAbsoluteExpiresAt) {
      await prisma.session.delete({ where: { sessionId } });
      return {
        valid: false,
        expired: true,
        absoluteExpired: true,
        message: 'Session expired (absolute lifetime exceeded)',
      };
    }

    // Check idle timeout
    const lastActivityAt = session.lastActivityAt ?? session.lastSeenAt;
    const effectiveIdleExpiresAt = session.idleExpiresAt ??
      new Date(lastActivityAt.getTime() + SESSION_CONFIG.IDLE_TIMEOUT_MS);

    if (now > effectiveIdleExpiresAt) {
      await prisma.session.delete({ where: { sessionId } });
      return {
        valid: false,
        expired: true,
        idleExpired: true,
        message: 'Session expired (idle timeout)',
      };
    }
  }

  // Check if this is the active session
  const user = await prisma.user.findFirst({ where: { id: userId } });

  if (!user) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('User not found during session validation', { category: 'auth', userId });
    }
    return { valid: false, message: 'User not found' };
  }

  if (user.activeSessionId !== sessionId) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.warn('Session mismatch', { category: 'auth', activeSessionId: user.activeSessionId, sessionId });
    }
    return {
      valid: false,
      message: 'Session expired (logged in elsewhere)',
    };
  }

  // Update last activity
  if (session.idleExpiresAt || session.absoluteExpiresAt) {
    // New format - update enhanced fields
    const effectiveAbsoluteExpiresAt = session.absoluteExpiresAt ??
      new Date(session.createdAt.getTime() + SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS);
    const newIdleExpiresAt = new Date(now.getTime() + SESSION_CONFIG.IDLE_TIMEOUT_MS);

    await prisma.session.update({
      where: { sessionId },
      data: {
        lastSeenAt: now,
        lastActivityAt: now,
        idleExpiresAt: newIdleExpiresAt,
        expiresAt: newIdleExpiresAt < effectiveAbsoluteExpiresAt ? newIdleExpiresAt : effectiveAbsoluteExpiresAt,
      },
    });
  } else {
    // Old format - just update lastSeenAt
    await prisma.session.update({
      where: { sessionId },
      data: { lastSeenAt: now },
    });
  }

  return { valid: true };
}

/**
 * Rotate session (create new session, invalidate old)
 * Used on login, privilege changes, etc.
 */
export async function rotateSession(
  userId: string,
  oldSessionId: string,
  userAgent?: string,
  ip?: string
): Promise<string> {
  // Get current session to preserve tenantId
  const oldSession = await prisma.session.findFirst({
    where: { sessionId: oldSessionId },
  });
  const tenantId = oldSession?.tenantId ?? undefined;

  // Delete old session
  await deleteSession(oldSessionId);

  // Create new session (pass UUID directly since it's already resolved)
  return createSecureSession(userId, userAgent, ip, tenantId);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionId } });
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });

  // Clear activeSessionId
  await prisma.user.update({
    where: { id: userId },
    data: {
      activeSessionId: null,
    },
  });
}

/**
 * Ensure sessions collection has proper indexes.
 * No-op with Prisma — indexes are declared in the schema.
 */
export async function ensureSecureSessionIndexes(): Promise<void> {
  // Prisma handles indexes via schema — nothing to do at runtime.
}
