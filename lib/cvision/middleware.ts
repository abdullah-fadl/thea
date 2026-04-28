import { logger } from '@/lib/monitoring/logger';
/**
 * CVision (HR OS) - Middleware Helpers
 * 
 * API route middleware for session, tenant, role, and policy enforcement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, validateSession, getSessionFromRequest, getTenantDbByKey } from '@/lib/cvision/infra';
import { CVISION_ROLES, CVisionRole, getCVisionRole, getRoleCapabilities } from './roles';
import { PolicyContext, PolicyResult } from './policy';

// =============================================================================
// Types
// =============================================================================

export interface CVisionSessionContext {
  userId: string;
  tenantId: string;
  role: string;
  cvisionRole: CVisionRole;
  departmentId?: string;
  employeeId?: string;
  user?: {
    email?: string;
    name?: string;
  };
}

export interface MiddlewareResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// =============================================================================
// Session Middleware
// =============================================================================

/**
 * Require a valid session for the request
 * Returns session context or error response
 */
export async function requireSession(
  request: NextRequest
): Promise<MiddlewareResult<CVisionSessionContext>> {
  try {
    // Get auth token from request cookies (works in all contexts)
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('token')?.value;

    if (!token) {
      return {
        success: false,
        error: 'Authentication required',
        status: 401,
      };
    }

    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return {
        success: false,
        error: 'Invalid or expired token',
        status: 401,
      };
    }

    // Check JWT expiry claim explicitly.
    // verifyToken only validates the signature; the exp claim must be checked
    // separately to reject tokens that are past their expiry time.
    const nowSeconds = Math.floor(Date.now() / 1000);
    if ((payload as any).exp !== undefined && (payload as any).exp < nowSeconds) {
      return {
        success: false,
        error: 'Token has expired',
        status: 401,
      };
    }

    // Use JWT payload as session — fields are at the top level (userId, email, role)
    const session = payload as any;
    if (!session || !session.userId) {
      return {
        success: false,
        error: 'Session expired or invalid',
        status: 401,
      };
    }

    const tenantId = session.activeTenantId || session.tenantId;
    if (!tenantId) {
      return {
        success: false,
        error: 'No tenant context',
        status: 400,
      };
    }

    const role = session.user?.role || session.role || 'viewer';
    const cvisionRole = getCVisionRole(role);

    return {
      success: true,
      data: {
        userId: session.user?.id || session.userId,
        tenantId,
        role,
        cvisionRole,
        departmentId: session.user?.departmentId || session.departmentId,
        employeeId: session.user?.employeeId || session.employeeId,
        user: {
          email: session.user?.email || session.email,
          name: session.user?.name || session.name || session.email,
        },
      },
    };
  } catch (error: any) {
    logger.error('[CVision Middleware] Session error:', error?.message || error);
    return {
      success: false,
      error: 'Authentication error',
      status: 500,
    };
  }
}

// =============================================================================
// Tenant Middleware
// =============================================================================

/**
 * Require tenant context and verify tenant exists
 */
export async function requireTenant(
  ctx: CVisionSessionContext
): Promise<MiddlewareResult<{ tenantId: string }>> {
  try {
    if (!ctx.tenantId) {
      return {
        success: false,
        error: 'Tenant context required',
        status: 400,
      };
    }

    // Verify tenant database exists/is accessible
    const db = await getTenantDbByKey(ctx.tenantId);
    if (!db) {
      return {
        success: false,
        error: 'Tenant not found',
        status: 404,
      };
    }

    return {
      success: true,
      data: { tenantId: ctx.tenantId },
    };
  } catch (error: any) {
    logger.error('[CVision Middleware] Tenant error:', error?.message || error);
    return {
      success: false,
      error: 'Tenant verification failed',
      status: 500,
    };
  }
}

// =============================================================================
// Role Middleware
// =============================================================================

/**
 * Require one of the specified roles
 */
export function requireRole(
  ctx: CVisionSessionContext,
  allowedRoles: CVisionRole[]
): MiddlewareResult {
  if (allowedRoles.includes(ctx.cvisionRole)) {
    return { success: true };
  }

  // Check if user has a higher role than required
  // (e.g., CVISION_ADMIN should pass checks requiring HR_SPECIALIST)
  const caps = getRoleCapabilities(ctx.cvisionRole);
  
  // Admin roles always pass
  if (ctx.cvisionRole === CVISION_ROLES.CVISION_ADMIN) {
    return { success: true };
  }

  return {
    success: false,
    error: `Requires role: ${allowedRoles.join(' or ')}`,
    status: 403,
  };
}

/**
 * Require minimum role level
 */
export function requireMinimumRole(
  ctx: CVisionSessionContext,
  minimumRole: CVisionRole
): MiddlewareResult {
  const roleOrder: CVisionRole[] = [
    CVISION_ROLES.CANDIDATE,
    CVISION_ROLES.EMPLOYEE,
    CVISION_ROLES.AUDITOR,
    CVISION_ROLES.HR_MANAGER,
    CVISION_ROLES.HR_ADMIN,
    CVISION_ROLES.CVISION_ADMIN,
  ];

  const userRoleIndex = roleOrder.indexOf(ctx.cvisionRole);
  const minRoleIndex = roleOrder.indexOf(minimumRole);

  if (userRoleIndex >= minRoleIndex) {
    return { success: true };
  }

  return {
    success: false,
    error: `Requires minimum role: ${minimumRole}`,
    status: 403,
  };
}

// =============================================================================
// Policy Middleware
// =============================================================================

/**
 * Enforce a policy check
 */
export function enforcePolicy(
  policyResult: PolicyResult,
  action: string = 'perform this action'
): MiddlewareResult {
  if (policyResult.allowed) {
    return { success: true };
  }

  return {
    success: false,
    error: `Not authorized to ${action}: ${policyResult.reason || 'policy denied'}`,
    status: 403,
  };
}

/**
 * Convert session context to policy context
 */
export function toPolicyContext(session: CVisionSessionContext): PolicyContext {
  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    cvisionRole: session.cvisionRole,
    departmentId: session.departmentId,
    employeeId: session.employeeId,
  };
}

// =============================================================================
// Combined Middleware
// =============================================================================

/**
 * Require session + tenant in one call
 * Most API routes will use this
 */
export async function requireSessionAndTenant(
  request: NextRequest
): Promise<MiddlewareResult<CVisionSessionContext>> {
  // First, require session
  const sessionResult = await requireSession(request);
  if (!sessionResult.success || !sessionResult.data) {
    return sessionResult;
  }

  // Then, verify tenant
  const tenantResult = await requireTenant(sessionResult.data);
  if (!tenantResult.success) {
    return tenantResult as MiddlewareResult<CVisionSessionContext>;
  }

  return sessionResult;
}

/**
 * Create error response from middleware result
 */
export function middlewareError(result: MiddlewareResult): NextResponse {
  return NextResponse.json(
    { error: result.error || 'Forbidden' },
    { status: result.status || 403 }
  );
}

// =============================================================================
// Capability Checks
// =============================================================================

/**
 * Check if session has a specific capability
 */
export function hasCapability(
  ctx: CVisionSessionContext,
  capability: keyof ReturnType<typeof getRoleCapabilities>
): boolean {
  const caps = getRoleCapabilities(ctx.cvisionRole);
  return caps[capability] === true;
}

/**
 * Require a specific capability
 */
export function requireCapability(
  ctx: CVisionSessionContext,
  capability: keyof ReturnType<typeof getRoleCapabilities>,
  action: string = 'perform this action'
): MiddlewareResult {
  if (hasCapability(ctx, capability)) {
    return { success: true };
  }

  return {
    success: false,
    error: `Not authorized to ${action}`,
    status: 403,
  };
}
