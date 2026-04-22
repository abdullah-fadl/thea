/**
 * Unified Authorization Guard System
 * Centralized authentication and authorization for all API routes
 * Enforces tenant isolation and scope-based access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { User } from '@/lib/models/User';
import { Role } from '@/lib/rbac';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { validateSecureSession } from './sessions';
import { getSessionData } from '@/lib/auth/sessionHelpers';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { logger } from '@/lib/monitoring/logger';

export interface AuthenticatedUser {
  userId: string;
  userRole: Role;
  userEmail: string;
  user: User;
  tenantId: string; // ALWAYS from session.tenantId, never from user/body/query
  sessionId: string;
  groupId?: string;
  hospitalId?: string;
}

function isValidTenantId(value: string | null | undefined): value is string {
  const normalized = String(value || '').trim();
  return !!normalized && normalized !== 'default' && normalized !== '__skip__';
}

/**
 * Require authentication - reads ONLY from cookies
 * Returns authenticated user context or 401 response
 * This is the foundation for all authorization checks
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  // Read token ONLY from cookies
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'No authentication token found' },
      { status: 401 }
    );
  }

  // Verify token
  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.userId) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Token verification failed - no payload or userId', { category: 'auth' });
    }
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  // Token verification successful - only log if DEBUG_AUTH is enabled
  // (removed verbose logging to reduce console noise)

  // Validate session with enhanced security checks
  if (payload.sessionId) {
    const sessionValidation = await validateSecureSession(payload.userId, payload.sessionId);
    if (!sessionValidation.valid) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.error('Session validation failed', { category: 'auth', userId: payload.userId, sessionId: payload.sessionId, message: sessionValidation.message });
      }
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: sessionValidation.message || 'Session expired',
        },
        { status: 401 }
      );
    }
  }

  // Get session data for tenantId (MUST come from session, not user/body/query)
  const sessionData = await getSessionData(request);

  if (process.env.DEBUG_AUTH === '1') {
    logger.debug('Session data', { category: 'auth', hasSessionData: !!sessionData, activeTenantId: sessionData?.activeTenantId, tenantId: sessionData?.tenantId, sessionId: sessionData?.sessionId });
  }

  // For owner roles, sessionData might be null or tenantId might be empty
  // We'll check user role first before requiring sessionData
  const activeTenantId = isValidTenantId(sessionData?.activeTenantId)
    ? sessionData?.activeTenantId
    : isValidTenantId(sessionData?.tenantId)
      ? sessionData?.tenantId
      : undefined;

  // Get user from PostgreSQL — single database, single query
  let user: User | null = null;
  let userTenantKey: string | undefined;

  try {
    const dbUser = await prisma.user.findFirst({
      where: { id: payload.userId },
    });

    if (dbUser) {
      // Resolve tenant business key from tenant UUID if the user has a tenantId
      if (dbUser.tenantId) {
        const tenant = await prisma.tenant.findFirst({
          where: { id: dbUser.tenantId },
          select: { tenantId: true },
        });
        userTenantKey = tenant?.tenantId || undefined;
      }

      user = {
        ...dbUser,
        role: normalizeRole(dbUser.role) as Role,
        tenantId: userTenantKey || undefined,
      } as unknown as User;

      if (process.env.DEBUG_AUTH === '1') {
        logger.debug('Found user via Prisma', { category: 'auth', userId: payload.userId, tenantKey: userTenantKey || 'none' });
      }
    }

    if (!user || user.isActive === false) {
      if (process.env.DEBUG_AUTH === '1') {
        logger.error('User not found or inactive', { category: 'auth', userId: payload.userId, found: !!user, active: user?.isActive });
      }
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found or inactive' },
        { status: 401 }
      );
    }

    if (process.env.DEBUG_AUTH === '1') {
      logger.debug('User found', { category: 'auth', userId: user.id, role: user.role, tenantId: user.tenantId || 'none' });
    }

    // Determine final tenantId:
    // 1. For owner roles: allow empty tenantId
    // 2. For other users: use activeTenantId from session, or user.tenantId from DB as fallback
    // 3. If user has tenantId in DB, use it as fallback (for backward compatibility)
    let finalTenantId: string;

    if (user.role === 'thea-owner') {
      // Owner roles can work without tenant
      finalTenantId = activeTenantId || (isValidTenantId(sessionData?.tenantId) ? sessionData?.tenantId : '') || '';
    } else {
      // For other users, try activeTenantId from session first
      // If not available, use user.tenantId from DB (backward compatibility)
      finalTenantId = activeTenantId || (isValidTenantId(sessionData?.tenantId) ? sessionData?.tenantId : '') || user.tenantId || '';

      // Only require tenantId if user doesn't have one in DB
      if (!finalTenantId && !user.tenantId) {
        if (process.env.DEBUG_AUTH === '1') {
          logger.error('Tenant required but not found', { category: 'auth', userId: user.id, role: user.role, activeTenantId, userTenantId: user.tenantId });
        }
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Tenant not selected. Please log in again.' },
          { status: 401 }
        );
      }

      // Use user.tenantId if session doesn't have one
      if (!finalTenantId && user.tenantId) {
        finalTenantId = user.tenantId;
        if (process.env.DEBUG_AUTH === '1') {
          logger.debug('Using user.tenantId from DB as fallback', { category: 'auth', tenantId: finalTenantId });
        }
      }
    }

    return {
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      user,
      tenantId: finalTenantId || '',
      sessionId: sessionData?.sessionId || '',
      groupId: user.groupId,
      hospitalId: user.hospitalId,
    };
  } catch (error) {
    logger.error('Error fetching user in requireAuth', { category: 'auth', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Require specific roles
 * Returns authenticated user context or 403 response
 * 
 * @param request - NextRequest object
 * @param allowedRoles - Array of allowed roles
 * @param authResult - Optional pre-authenticated result (to avoid double auth check)
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: Role[],
  authResult?: AuthenticatedUser | NextResponse
): Promise<AuthenticatedUser | NextResponse> {
  // Use provided auth result if available, otherwise authenticate
  const auth = authResult || await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Role auth failed', { category: 'auth', status: auth.status });
    }
    return auth; // Already an error response
  }

  if (!allowedRoles.includes(auth.userRole)) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Role check failed', { category: 'auth', userRole: auth.userRole, allowed: allowedRoles.join(', ') });
    }
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}` 
      },
      { status: 403 }
    );
  }

  if (process.env.DEBUG_AUTH === '1') {
    logger.debug('Role check passed', { category: 'auth', userRole: auth.userRole });
  }

  return auth;
}

/**
 * Require scope access (groupId/hospitalId)
 * Validates that the user can access the requested scope
 * Rules:
 * - Platform Admin: can access any scope
 * - Group Admin: can only access their groupId
 * - Hospital Admin: can only access their groupId and hospitalId
 * - Other roles: inherit from their user.groupId/hospitalId
 */
export async function requireScope(
  request: NextRequest,
  requestedScope: {
    groupId?: string;
    hospitalId?: string;
  }
): Promise<AuthenticatedUser | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth; // Already an error response
  }

  // Platform Admin has full access
  if (auth.userRole === 'admin') {
    return auth;
  }

  // Group Admin can only access their group
  if (auth.userRole === 'group-admin') {
    if (requestedScope.groupId && requestedScope.groupId !== auth.groupId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your group' 
        },
        { status: 403 }
      );
    }
    // Group admin cannot access hospital-specific resources
    if (requestedScope.hospitalId && requestedScope.hospitalId !== auth.hospitalId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your hospital' 
        },
        { status: 403 }
      );
    }
    return auth;
  }

  // Hospital Admin can only access their group and hospital
  if (auth.userRole === 'hospital-admin') {
    if (requestedScope.groupId && requestedScope.groupId !== auth.groupId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your group' 
        },
        { status: 403 }
      );
    }
    if (requestedScope.hospitalId && requestedScope.hospitalId !== auth.hospitalId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your hospital' 
        },
        { status: 403 }
      );
    }
    return auth;
  }

  // Other roles inherit scope from their user record
  // Staff/supervisor/viewer can only access their group/hospital
  if (requestedScope.groupId && requestedScope.groupId !== auth.groupId) {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: 'Cannot access resources outside your group' 
      },
      { status: 403 }
    );
  }
  if (requestedScope.hospitalId && requestedScope.hospitalId !== auth.hospitalId) {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: 'Cannot access resources outside your hospital' 
      },
      { status: 403 }
    );
  }

  return auth;
}

/**
 * Extract tenantId from request body/query (for validation)
 * WARNING: This should NEVER be used to set tenantId - it's only for validation
 * tenantId MUST always come from session
 */
export function extractTenantIdFromRequest(request: NextRequest): string | null {
  // DO NOT USE THIS TO SET tenantId
  // This is only for validation/logging purposes
  // Actual tenantId must come from session
  const url = new URL(request.url);
  return url.searchParams.get('tenantId') || null;
}

/**
 * Validate tenant isolation
 * Ensures that tenantId from request matches session tenantId
 * This is a defensive check to prevent tenant isolation violations
 */
export async function validateTenantIsolation(
  auth: AuthenticatedUser,
  requestedTenantId?: string | null
): Promise<boolean> {
  // If no tenantId in request, assume it's for the session tenant (allowed)
  if (!requestedTenantId) {
    return true;
  }

  // Requested tenantId must match session tenantId
  if (requestedTenantId !== auth.tenantId) {
    return false;
  }

  return true;
}

/**
 * Helper to get IP address from request
 */
export function getRequestIP(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip')?.trim() ||
         undefined;
}

/**
 * Helper to get user agent from request
 */
export function getRequestUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

