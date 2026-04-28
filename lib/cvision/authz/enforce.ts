import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Authorization Enforcement Helpers
 * 
 * Provides standardized enforcement and error responses for CVision APIs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthenticatedUser } from '@/lib/cvision/infra/auth';
import { getAuthzContext, isTerminated, isResigned } from './context';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import type { AuthzContext } from './types';
import type { PolicyResult } from './policy';

export interface EnforceContext extends AuthzContext {
  user: AuthenticatedUser['user'];
}

/**
 * Require authentication and build authz context
 * Returns standardized error responses or context
 */
export async function requireCtx(
  request: NextRequest
): Promise<NextResponse | EnforceContext> {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // 401 Unauthorized
    }

    // Build authz context
    const authzCtx = await getAuthzContext(request, authResult);

    // Create enforce context
    const enforceCtx: EnforceContext = {
      ...authzCtx,
      user: authResult.user,
    };

    // Log THEA_OWNER access for audit
    if (authzCtx.isOwner) {
      await logOwnerAccess(request, enforceCtx);
    }

    // Check terminated status (block access to CVision internal routes)
    // Note: THEA_OWNER bypasses this check (already handled in policy functions)
    if (isTerminated(authzCtx) && !authzCtx.isOwner) {
      await logAuthzDeny(
        request,
        enforceCtx,
        'TERMINATED_ACCESS_BLOCKED',
        'Terminated user attempted to access CVision'
      );
      return deny('TERMINATED_ACCESS_BLOCKED', 'Access denied: terminated employee');
    }

    return enforceCtx;
  } catch (error: any) {
    logger.error('[CVision Authz] Error in requireCtx:', error?.message || String(error), error?.stack);
    return NextResponse.json(
      {
        error: 'Authorization error',
        message: error?.message || 'Failed to build authorization context',
      },
      { status: 500 }
    );
  }
}

/**
 * Require tenant (should already be resolved by withAuthTenant, but double-check)
 */
export function requireTenant(ctx: EnforceContext): NextResponse | null {
  if (!ctx.tenantId) {
    return deny('NO_TENANT', 'Tenant ID required');
  }
  return null;
}

/**
 * Require specific role
 */
export async function requireRole(
  ctx: EnforceContext,
  allowedRoles: string[],
  request?: NextRequest
): Promise<NextResponse | null> {
  const hasRole = ctx.roles.some(role => allowedRoles.includes(role));
  if (!hasRole) {
    if (request) {
      await logAuthzDeny(
        request,
        ctx,
        'INSUFFICIENT_ROLE',
        `Required roles: ${allowedRoles.join(', ')}`
      );
    }
    return deny('INSUFFICIENT_ROLE', `Required roles: ${allowedRoles.join(', ')}`);
  }
  return null;
}

/**
 * Enforce a policy check
 * Returns NextResponse if denied, null if allowed
 * 
 * OWNER role override: If ctx.roles includes OWNER, always allow (bypass policy check)
 * This is the CENTRAL override point for OWNER role - all policy checks go through here.
 */
export async function enforce(
  result: PolicyResult,
  request: NextRequest | null,
  ctx: EnforceContext
): Promise<NextResponse | null> {
  // OWNER role: tenant super-admin override - bypass all policy checks
  // This is the CENTRAL override - all CVision endpoints use enforce() for policy checks
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    if (process.env.NODE_ENV === 'development') {
      logger.info('[CVISION_AUTHZ] OWNER override: bypassing policy check', {
        endpoint: request?.url,
        method: request?.method,
        policyResult: result,
        roles: ctx.roles,
      });
    }
    return null; // Allow - OWNER bypasses all restrictions
  }

  if (result.allowed) {
    return null;
  }

  // Log denial
  if (request) {
    await logAuthzDeny(request, ctx, result.reason || 'POLICY_DENIED', 'Policy check failed');
  }

  return deny(result.reason || 'POLICY_DENIED', result.reason || 'Access denied');
}

/**
 * Create standardized deny response
 */
export function deny(code: string, message: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Access denied',
      code,
      message,
    },
    { status: 403 }
  );
}

/**
 * Log THEA_OWNER access for audit
 * All owner requests must be audited
 */
async function logOwnerAccess(
  request: NextRequest,
  ctx: EnforceContext
): Promise<void> {
  try {
    const auditCtx = createCVisionAuditContext(
      {
        userId: ctx.userId,
        role: ctx.roles[0] || 'unknown',
        tenantId: ctx.tenantId,
        user: ctx.user,
      },
      request
    );

    const method = request.method || 'UNKNOWN';
    const url = request.url || 'unknown';
    const pathname = new URL(url).pathname;

    await logCVisionAudit(
      auditCtx as any,
      'owner_access',
      'authz',
      {
        resourceId: ctx.userId,
        changes: {
          after: {
            ownerAccess: true,
            endpoint: pathname,
            method,
            fullUrl: url,
            tenantId: ctx.tenantId,
            roles: ctx.roles,
            employeeId: ctx.employeeId,
            employeeStatus: ctx.employeeStatus,
            timestamp: new Date().toISOString(),
          },
        },
        metadata: {
          isOwner: true,
          bypassedRBAC: true,
          bypassedABAC: true,
        },
      }
    );
  } catch (error) {
    // Don't fail request if audit logging fails, but log error
    logger.error('[CVision Authz] Failed to log owner access:', error);
  }
}

/**
 * Log authorization denial to audit log
 */
async function logAuthzDeny(
  request: NextRequest | null,
  ctx: EnforceContext,
  reason: string,
  details: string
): Promise<void> {
  try {
    const auditCtx = request
      ? createCVisionAuditContext(
          {
            userId: ctx.userId,
            role: ctx.roles[0] || 'unknown',
            tenantId: ctx.tenantId,
            user: ctx.user,
          },
          request
        )
      : {
          userId: ctx.userId,
          role: ctx.roles[0] || 'unknown',
          tenantId: ctx.tenantId,
          user: ctx.user,
        };

    await logCVisionAudit(
      auditCtx as any,
      'authz_deny',
      'authz',
      {
        resourceId: ctx.userId,
        changes: {
          after: {
            reason,
            details,
            endpoint: request?.url || 'unknown',
            roles: ctx.roles,
            employeeId: ctx.employeeId,
            employeeStatus: ctx.employeeStatus,
          },
        },
      }
    );
  } catch (error) {
    // Don't fail request if audit logging fails
    logger.error('[CVision Authz] Failed to log denial:', error);
  }
}
