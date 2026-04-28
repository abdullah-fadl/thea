/**
 * Centralized authentication helper
 * Reads authentication ONLY from HTTP-only cookies
 * DO NOT rely on headers, query params, or other sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { User } from '@/lib/models/User';
import { validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { AuthContext } from './requireRole';
import { getSessionData } from './sessionHelpers';
import { logger } from '@/lib/utils/logger';
import { normalizeRole } from '@/lib/auth/normalizeRole';

export interface AuthenticatedUser extends AuthContext {
  user: User;
  tenantId: string; // Always from session.tenantId
  sessionId: string;
}

function isValidTenantId(value: string | null | undefined): value is string {
  const normalized = String(value || '').trim();
  return !!normalized && normalized !== 'default' && normalized !== '__skip__';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenantKeyToUuidCache = new Map<string, string>();

/**
 * Tenant status cache — avoids hitting prisma.tenant.findFirst() on every
 * authenticated request just to check if the tenant is BLOCKED.
 * Entries expire after 30 seconds so a block takes effect within 30s.
 */
const _tenantStatusCache = new Map<string, { status: string; expiresAt: number }>();
const TENANT_STATUS_CACHE_TTL = 30_000; // 30 seconds

/**
 * User lookup cache — avoids hitting prisma.user.findFirst() on every
 * authenticated request. Entries expire after 120 seconds.
 */
const _userCache = new Map<string, { user: User; expiresAt: number }>();
const USER_CACHE_TTL = 120_000; // 120 seconds — increased from 30s to reduce pool pressure under concurrent simulator load

/**
 * Resolve a tenant key string (e.g. "thea-owner-dev") to its UUID.
 * If the value is already a UUID, return it as-is.
 * Caches results so the DB lookup only happens once per key per process.
 */
async function resolveTenantKeyToUuid(key: string): Promise<string> {
  if (!key) return key;
  if (UUID_RE.test(key)) return key; // already a UUID
  const cached = tenantKeyToUuidCache.get(key);
  if (cached) return cached;
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { tenantId: key },
      select: { id: true },
    });
    if (tenant?.id) {
      tenantKeyToUuidCache.set(key, tenant.id);
      return tenant.id;
    }
  } catch {
    // If lookup fails, return the key as-is (will fail downstream with a clear error)
  }
  return key;
}

/**
 * Require authentication - reads ONLY from cookies
 * Returns authenticated user context or 401 response
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  // Read token ONLY from cookies
  const token = request.cookies.get('auth-token')?.value;

  const debugAuth = process.env.DEBUG_AUTH === '1';
  if (debugAuth || !token) {
    logger.debug('auth.token.check', { hasToken: !!token });
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'No authentication token found' },
      { status: 401 }
    );
  }

  // Verify token
  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.userId) {
    if (debugAuth) logger.debug('auth.token.invalid');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  // Validate session — enforce single active session
  if (payload.sessionId) {
    const sessionValidation = await validateSession(payload.userId, payload.sessionId);
    if (!sessionValidation.valid) {
      if (debugAuth) logger.debug('auth.session.invalid');
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: sessionValidation.message || 'Session expired',
        },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV !== 'development') {
    // In production: tokens without sessionId are suspicious (old token or bypass attempt)
    // Check if user has active sessions — if yes, this token is likely stale
    try {
      const activeSessionCount = await prisma.session.count({
        where: { userId: payload.userId, expiresAt: { gt: new Date() } },
      });
      if (activeSessionCount > 0) {
        logger.warn('Token without sessionId while user has active sessions', {
          category: 'security',
          userId: payload.userId,
        });
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Session expired. Please log in again.' },
          { status: 401 }
        );
      }
    } catch {
      // If session table check fails, allow (graceful degradation)
    }
  }

  // Get session data for activeTenantId (SINGLE SOURCE OF TRUTH)
  const sessionData = await getSessionData(request);
  if (debugAuth) {
    logger.debug('auth.session.data', { hasSessionData: !!sessionData });
  }

  const activeTenantId = isValidTenantId(sessionData?.activeTenantId)
    ? sessionData?.activeTenantId
    : isValidTenantId(sessionData?.tenantId)
      ? sessionData?.tenantId
      : undefined;

  // Find user in PostgreSQL (single DB, no multi-DB search needed)
  // Uses a 120-second cache to reduce connection pool pressure under concurrent load
  let user: User | null = null;

  const cachedUser = _userCache.get(payload.userId);
  if (cachedUser && Date.now() < cachedUser.expiresAt) {
    user = cachedUser.user;
    if (debugAuth) logger.debug('auth.user.cached');
  } else {
    // Retry once on transient Prisma pool/connection errors
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const dbUser = await prisma.user.findFirst({
          where: { id: payload.userId },
        });
        if (dbUser) {
          // Map Prisma user to the User model type
          // normalizeRole converts Prisma enum (THEA_OWNER) to app format (thea-owner)
          user = {
            ...dbUser,
            role: normalizeRole(dbUser.role) as User['role'],
            tenantId: dbUser.tenantId || undefined,
          } as unknown as User;
          _userCache.set(payload.userId, { user, expiresAt: Date.now() + USER_CACHE_TTL });
          if (debugAuth) logger.debug('auth.user.found');
        }
        break; // success — exit retry loop
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (attempt === 0 && (msg.includes('Invalid') || msg.includes('connection') || msg.includes('pool'))) {
          await new Promise((r) => setTimeout(r, 80)); // brief backoff
          continue;
        }
        logger.error('auth.user.lookup.failed', { category: 'auth', error: msg.substring(0, 200) });
      }
    }
  }

  // For owner roles, activeTenantId is optional
  // For other users, activeTenantId is required
  if (!activeTenantId) {
    const userTenantId = isValidTenantId(user?.tenantId) ? String(user.tenantId) : '';
    if (!user || ((user.role !== 'thea-owner') && !userTenantId)) {
      if (debugAuth) logger.debug('auth.tenant.missing');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Tenant not selected. Please log in again.' },
        { status: 401 }
      );
    }
  }

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'User not found or inactive' },
      { status: 401 }
    );
  }

  if (user.isActive === false) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'User not found or inactive' },
      { status: 401 }
    );
  }

  // Check tenant status (blocked tenants cannot access)
  // Uses a 30-second cache to avoid hitting the DB on every request
  if (activeTenantId) {
    let tenantStatus: string | null = null;
    const cached = _tenantStatusCache.get(activeTenantId);
    if (cached && Date.now() < cached.expiresAt) {
      tenantStatus = cached.status;
    } else {
      // Retry once on transient Prisma pool/connection errors
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const tenant = await prisma.tenant.findFirst({
            where: { tenantId: activeTenantId },
            select: { status: true },
          });
          if (tenant) {
            tenantStatus = tenant.status;
            _tenantStatusCache.set(activeTenantId, {
              status: tenant.status,
              expiresAt: Date.now() + TENANT_STATUS_CACHE_TTL,
            });
          }
          break; // success
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (attempt === 0 && (msg.includes('Invalid') || msg.includes('connection') || msg.includes('pool'))) {
            await new Promise((r) => setTimeout(r, 80));
            continue;
          }
          if (debugAuth) logger.debug('auth.tenant.status.check.failed');
          // On error, allow through (graceful degradation) — the downstream
          // getTenantDbByKey call will catch a truly broken tenant
        }
      }
    }
    if (tenantStatus === 'BLOCKED') {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'This tenant account has been blocked. Please contact support.'
        },
        { status: 403 }
      );
    }
  }

  // Extract employeeId and departmentKey
  const employeeId = (user as unknown as Record<string, unknown>).employeeId as string | undefined || user.staffId || undefined;
  const departmentKey = (user as unknown as Record<string, unknown>).departmentKey as string | undefined;
  const department = user.department || undefined;

  // Resolve tenant key string (e.g. "thea-owner-dev") to UUID
  // This is critical: all Prisma models expect UUID in tenantId column,
  // but sessions/JWT store the human-readable tenant key string.
  const rawTenantId = activeTenantId || (isValidTenantId(user?.tenantId) ? user.tenantId! : '');
  const resolvedTenantId = rawTenantId ? await resolveTenantKeyToUuid(rawTenantId) : '';

  return {
    userId: user.id,
    userRole: user.role,
    userEmail: user.email,
    employeeId,
    departmentKey,
    department,
    user,
    tenantId: resolvedTenantId,
    sessionId: sessionData?.sessionId || '',
  };
}
