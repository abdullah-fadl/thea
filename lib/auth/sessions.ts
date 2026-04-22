import { prisma } from '@/lib/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/utils/logger';

const SESSION_DURATION_DAYS = 7;
const MAX_SESSIONS_PER_USER = 10; // Allow multiple tabs/devices

function isValidTenantId(value: string | null | undefined): value is string {
  const normalized = String(value || '').trim();
  return !!normalized && normalized !== 'default' && normalized !== '__skip__';
}

/**
 * Create a new session for a user
 *
 * @param userId - User ID
 * @param userAgent - User agent string
 * @param ip - IP address
 * @param tenantId - User's identity tenant (from user.tenantId) - kept for backward compatibility
 * @param activeTenantId - SINGLE SOURCE OF TRUTH: Selected tenant at login (required)
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ip?: string,
  tenantId?: string,
  activeTenantId?: string
): Promise<string> {
  const normalizedTenantId = isValidTenantId(tenantId) ? tenantId : undefined;
  const normalizedActiveTenantId = isValidTenantId(activeTenantId) ? activeTenantId : undefined;
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Resolve tenant UUID for FK reference
  let tenantUuid: string | undefined;
  const targetTenantKey = normalizedActiveTenantId || normalizedTenantId;
  if (targetTenantKey) {
    try {
      const tenant = await prisma.tenant.findFirst({
        where: { tenantId: targetTenantKey },
        select: { id: true },
      });
      tenantUuid = tenant?.id;
    } catch {
      // Non-critical — session can be created without tenant FK
    }
  }

  // Resolve activeTenantId to UUID (column is UUID in database despite Prisma schema saying String)
  let activeTenantUuid: string | undefined;
  const activeKey = normalizedActiveTenantId || normalizedTenantId;
  if (activeKey) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeKey)) {
      activeTenantUuid = activeKey;
    } else {
      try {
        const t = await prisma.tenant.findFirst({ where: { tenantId: activeKey }, select: { id: true } });
        activeTenantUuid = t?.id;
      } catch { /* non-critical */ }
    }
  }

  // Create session in PostgreSQL
  await prisma.session.create({
    data: {
      sessionId,
      userId,
      tenantId: tenantUuid || undefined,
      activeTenantId: activeTenantUuid || undefined,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      userAgent,
      ip,
    },
  });

  // Track latest session on user record (for audit — NOT for invalidation)
  try {
    await prisma.user.updateMany({
      where: { id: userId },
      data: {
        activeSessionId: sessionId,
        updatedAt: now,
      },
    });
  } catch {
    // Non-critical — session is still valid
  }

  // Enforce max sessions limit — prune oldest beyond threshold (fire-and-forget)
  pruneOldSessions(userId).catch(() => {});

  return sessionId;
}

/**
 * Session validation cache — avoids 3 DB calls per request.
 * Once validated, session stays valid for 60 seconds. This dramatically
 * reduces Prisma connection pool pressure under concurrent simulator load.
 */
const _sessionValidCache = new Map<string, { result: { valid: boolean; expired?: boolean; message?: string }; expiresAt: number }>();
const SESSION_VALID_CACHE_TTL = 15_000; // 15 seconds — balanced between pool pressure and revocation latency

/**
 * Validate session and check if it's the active session
 */
export async function validateSession(
  userId: string,
  sessionId: string
): Promise<{ valid: boolean; expired?: boolean; message?: string }> {
  // Fast path: recently validated session
  const cacheKey = `${userId}:${sessionId}`;
  const cached = _sessionValidCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  // Find session in PostgreSQL — with retry for transient pool errors
  let session: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      session = await prisma.session.findFirst({
        where: { userId, sessionId },
      });
      break; // success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 0 && (msg.includes('Invalid') || msg.includes('connection') || msg.includes('pool'))) {
        await new Promise((r) => setTimeout(r, 80)); // brief backoff before retry
        continue;
      }
      // Non-retryable or second failure — treat as "session not found"
      logger.error('session.validate.db.error', { category: 'auth', error: msg.substring(0, 200) });
      const errResult = { valid: false, message: 'Session validation failed' } as const;
      return errResult;
    }
  }

  if (!session) {
    const result = { valid: false, message: 'Session not found' } as const;
    return result;
  }

  // Check if session expired
  if (new Date() > session.expiresAt) {
    // Delete expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return { valid: false, expired: true, message: 'Session expired' };
  }

  // Multi-session: any valid, non-expired session is accepted.
  // No activeSessionId check — users can have multiple tabs/devices.
  // Security is maintained by: session expiry, JWT validation, explicit logout.

  // Update lastSeenAt (fire-and-forget, don't block)
  prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => {});

  // Cache the valid result
  const result = { valid: true };
  _sessionValidCache.set(cacheKey, { result, expiresAt: Date.now() + SESSION_VALID_CACHE_TTL });

  return result;
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionId } });
}

/**
 * Delete all sessions for a user (on logout or security action)
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  // Delete all sessions for this user
  await prisma.session.deleteMany({ where: { userId } });

  // Clear activeSessionId on user
  try {
    await prisma.user.updateMany({
      where: { id: userId },
      data: {
        activeSessionId: null,
        updatedAt: new Date(),
      },
    });
    if (process.env.DEBUG_AUTH === '1') logger.debug('session.delete.clear.complete');
  } catch {
    if (process.env.DEBUG_AUTH === '1') logger.debug('session.delete.clear.failed');
  }
}

/**
 * Prune old sessions when a user exceeds MAX_SESSIONS_PER_USER.
 * Deletes the oldest sessions beyond the limit.
 */
async function pruneOldSessions(userId: string): Promise<void> {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: 100,
    });
    if (sessions.length > MAX_SESSIONS_PER_USER) {
      const idsToDelete = sessions.slice(MAX_SESSIONS_PER_USER).map(s => s.id);
      await prisma.session.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      logger.info('Pruned old sessions', {
        category: 'auth',
        userId,
        pruned: idsToDelete.length,
        remaining: MAX_SESSIONS_PER_USER,
      });
    }
  } catch {
    // Non-critical — old sessions will expire naturally
  }
}

/**
 * Ensure sessions have proper indexes
 * Not needed for PostgreSQL — indexes are defined in Prisma schema
 */
export async function ensureSessionIndexes(): Promise<void> {
  // No-op for PostgreSQL — indexes are managed by Prisma migrations
}
