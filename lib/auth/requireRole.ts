import { NextRequest, NextResponse } from 'next/server';
import { Role, requireRole as checkRole } from '@/lib/rbac';
import { prisma } from '@/lib/db/prisma';
import { User } from '@/lib/models/User';
import { validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { logger } from '@/lib/monitoring/logger';

export interface AuthContext {
  userId: string;
  userRole: Role;
  userEmail?: string;
  employeeId?: string;
  departmentKey?: string;
  department?: string;
}

/**
 * Extract auth context from request headers
 * Also validates session for single active session enforcement
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  // Always verify from token — never trust request headers for auth
  let userId: string | null = null;
  let userRole: Role | null = null;
  let userEmail: string | null = null;
  let tokenPayload: any = null;

  const token = request.cookies.get('auth-token')?.value;

  if (token) {
    try {
      const payload = await verifyTokenEdge(token);
      if (payload && payload.userId && payload.role) {
        userId = payload.userId;
        userRole = payload.role as Role;
        userEmail = payload.email || null;
        tokenPayload = payload;
      }
    } catch (tokenError) {
      logger.error('Token verification failed', { category: 'auth', error: tokenError });
      return null;
    }
  }

  if (!userId || !userRole) {
    // Debug: log why authentication failed
    logger.warn('Missing auth info', { category: 'auth', hasUserId: !!userId, hasUserRole: !!userRole, hasUserEmail: !!userEmail });
    return null;
  }

  // Validate session — revoked sessions must be blocked
  if (tokenPayload?.sessionId && tokenPayload.userId) {
    try {
      const sessionValidation = await validateSession(tokenPayload.userId, tokenPayload.sessionId);
      if (!sessionValidation.valid) {
        logger.warn('Session revoked — blocking access', { category: 'auth', userId: tokenPayload.userId, message: sessionValidation.message });
        return null;
      }
    } catch (sessionError) {
      logger.error('Session validation failed — blocking access (fail-closed)', { category: 'auth', error: sessionError });
      return null;
    }
  }

  // Fetch user details for employeeId and department
  // Search in multiple places: platform DB, tenant DBs, legacy DB (same as requireAuth)
  // Note: If DB fetch fails, we still return context from headers (middleware verified token)
  let user: User | null = null;
  
  try {
    // Get session data to find activeTenantId
    const { getSessionData } = await import('./sessionHelpers');
    const sessionData = await getSessionData(request);
    const activeTenantId = sessionData?.activeTenantId || sessionData?.tenantId;

    // Find user in PostgreSQL (single DB)
    try {
      const dbUser = await prisma.user.findFirst({
        where: { id: userId },
      });
      if (dbUser) {
        user = {
          ...dbUser,
          role: normalizeRole(dbUser.role),
          tenantId: dbUser.tenantId || undefined,
        } as unknown as User;
      }
    } catch (error) {
      // Will be handled below
    }

    if (user && user.isActive) {
      // Extract employeeId from user (if stored) or try to match by email/name
      // Note: User model may not have employeeId directly - may need to look up in staff/nurse collections
      const employeeId = (user as unknown as Record<string, unknown>).employeeId as string | undefined || (user as unknown as Record<string, unknown>).staffId as string | undefined || undefined;
      
      // For departmentKey: if user has department (string), try to find matching departmentKey
      let departmentKey: string | undefined = (user as unknown as Record<string, unknown>).departmentKey as string | undefined;
      if (!departmentKey && user.department) {
        // Try to find departmentKey from department name
        // This is a fallback - ideally users should have departmentKey stored
        // For now, we'll use the department string as a hint
      }
      const department = user.department || undefined;

      return {
        userId,
        userRole,
        userEmail: userEmail || undefined,
        employeeId,
        departmentKey,
        department,
      };
    } else {
      // User not found or inactive - but middleware verified token is valid
      // Return context from headers (middleware guarantees token validity)
      if (process.env.DEBUG_AUTH === '1') {
        logger.warn('User not found or inactive, using headers only', { category: 'auth', userId });
      }
      return {
        userId,
        userRole,
        userEmail: userEmail || undefined,
      };
    }
  } catch (error) {
    // DB error - but middleware verified token is valid
    // Return context from headers (middleware guarantees token validity)
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Error fetching user context (non-blocking)', { category: 'auth', error });
    }
    return {
      userId,
      userRole,
      userEmail: userEmail || undefined,
    };
  }
}

/**
 * Require specific roles — verifies from JWT token (never trusts headers).
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<AuthContext | NextResponse> {
  // Always verify from JWT token — never trust request headers
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userId: string | null = null;
  let userRole: Role | null = null;
  let userEmail: string | null = null;

  try {
    const payload = await verifyTokenEdge(token);
    if (payload && payload.userId && payload.role) {
      userId = payload.userId;
      userRole = payload.role as Role;
      userEmail = payload.email || null;
    }
  } catch (tokenError) {
    logger.error('Token verification failed in requireRole', { category: 'auth', error: tokenError });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!userId || !userRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRole(userRole, allowedRoles)) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  return {
    userId,
    userRole,
    userEmail: userEmail || undefined,
  } as AuthContext;
}

/**
 * Require role with async context (includes employeeId, departmentKey)
 */
export async function requireRoleAsync(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<AuthContext | NextResponse> {
  const authContext = await getAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRole(authContext.userRole, allowedRoles)) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  return authContext;
}

/**
 * Require department scope - supervisor can only access their department
 * Admin has full access (no scope restriction)
 */
export function requireScope(
  authContext: AuthContext,
  targetDepartmentKey?: string
): boolean {
  // Admin has full access
  if (authContext.userRole === 'admin') {
    return true;
  }

  // Supervisor must match department
  if (authContext.userRole === 'supervisor') {
    if (!targetDepartmentKey) {
      // If no target specified, allow (will be filtered by departmentKey in query)
      return true;
    }
    return authContext.departmentKey === targetDepartmentKey;
  }

  // Staff can only access their own data (handled separately)
  return true;
}

/**
 * Build query filter based on role and scope
 */
export function buildScopeFilter(authContext: AuthContext, fieldName: string = 'departmentKey'): Record<string, any> {
  if (authContext.userRole === 'admin') {
    return {}; // No filter - admin sees all
  }

  if (authContext.userRole === 'supervisor' && authContext.departmentKey) {
    return { [fieldName]: authContext.departmentKey };
  }

  // Staff: will be filtered by createdByEmployeeId separately
  return {};
}

/**
 * Build filter for staff to see only their own visits
 */
export function buildStaffFilter(authContext: AuthContext, employeeIdField: string = 'staffId'): Record<string, any> {
  if (authContext.userRole !== 'staff') {
    return {}; // Not staff, no filter needed
  }

  if (!authContext.employeeId) {
    // Staff without employeeId cannot see any visits
    return { [employeeIdField]: '__NO_ACCESS__' }; // Will return empty results
  }

  return { [employeeIdField]: authContext.employeeId };
}
