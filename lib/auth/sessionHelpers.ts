import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyTokenEdge } from './edge';
import { logger, maskValue } from '@/lib/utils/logger';

/**
 * Get session data including activeTenantId from the request
 * SINGLE SOURCE OF TRUTH: Reads activeTenantId from session (selected at login)
 * Falls back to tenantId for backward compatibility
 */
export async function getSessionData(request: NextRequest): Promise<{ sessionId: string; tenantId: string; activeTenantId?: string } | null> {
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.sessionId) {
    return null;
  }

  try {
    // Find session in PostgreSQL
    const session = await prisma.session.findUnique({
      where: { sessionId: payload.sessionId },
      select: {
        sessionId: true,
        tenantId: true,
        activeTenantId: true,
        tenant: { select: { tenantId: true } },
      },
    });

    if (!session) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.debug('session.lookup.miss', { sessionId: maskValue(payload.sessionId) });
      }
      return null;
    }

    // activeTenantId column stores a UUID (FK to tenants.id).
    // We need the tenant *key* string (e.g. 'thea-owner-dev', 'hmg-whh')
    // because the rest of the codebase expects the key, not the UUID.
    let resolvedTenantKey: string | undefined;

    // 1. If tenant FK is populated, use its tenantId key directly (most reliable)
    if (session.tenant?.tenantId) {
      resolvedTenantKey = session.tenant.tenantId;
    }

    // 2. If activeTenantId is set and looks like a UUID, resolve it to key
    if (!resolvedTenantKey && session.activeTenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.activeTenantId);
      if (isUuid) {
        try {
          const tenant = await prisma.tenant.findFirst({
            where: { id: session.activeTenantId },
            select: { tenantId: true },
          });
          resolvedTenantKey = tenant?.tenantId || undefined;
        } catch { /* non-critical */ }
      } else {
        // Already a key string (shouldn't happen with current code, but be safe)
        resolvedTenantKey = session.activeTenantId;
      }
    }

    if (!resolvedTenantKey) {
      logger.warn('session.lookup.missing.tenant', { sessionId: maskValue(payload.sessionId) });
      // For owner roles, activeTenantId can be empty - allow it
      return {
        sessionId: session.sessionId,
        tenantId: '', // Empty for owner without tenant
        activeTenantId: undefined,
      };
    }

    return {
      sessionId: session.sessionId,
      tenantId: resolvedTenantKey,
      activeTenantId: resolvedTenantKey,
    };
  } catch (error) {
    logger.error('session.lookup.failed');
    return null;
  }
}

/**
 * Get active tenant ID from session (SINGLE SOURCE OF TRUTH)
 * Returns activeTenantId if set, otherwise falls back to tenantId
 */
export async function getActiveTenantId(request: NextRequest): Promise<string | null> {
  const sessionData = await getSessionData(request);
  return sessionData?.activeTenantId || sessionData?.tenantId || null;
}
