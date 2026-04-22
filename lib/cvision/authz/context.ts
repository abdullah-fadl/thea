import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Authorization Context Builder
 * 
 * Resolves user's authz context including:
 * - tenantId, userId, roles
 * - employeeId (if user is linked to employee record)
 * - departmentIds (user's department scope)
 * - employeeStatus (if user is an employee)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { type AuthenticatedUser } from '@/lib/cvision/infra/auth';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionEmployee } from '@/lib/cvision/types';
import { CVISION_ROLES, getCVisionRole } from '@/lib/cvision/roles';
import { normalizeStatus } from '@/lib/cvision/status';
import type { AuthzContext } from './types';

// Re-export for backwards compatibility
export type { AuthzContext } from './types';

/**
 * Get authz context - overloaded function signatures
 */
export async function getAuthzContext(): Promise<AuthzContext>;
export async function getAuthzContext(
  request: NextRequest,
  authResult: AuthenticatedUser
): Promise<AuthzContext>;
export async function getAuthzContext(
  request?: NextRequest,
  authResult?: AuthenticatedUser
): Promise<AuthzContext> {
  // If no parameters, use cookies from Next.js headers
  if (!request || !authResult) {
    const { requireAuth } = await import('@/lib/auth/requireAuth');
    
    // Get cookies from Next.js headers
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value || cookieStore.get('token')?.value;
    
    if (!authToken) {
      throw new Error('Unauthorized');
    }
    
    // Build cookie string from all cookies
    const cookiePairs: string[] = [];
    cookieStore.getAll().forEach(cookie => {
      cookiePairs.push(`${cookie.name}=${cookie.value}`);
    });
    const cookieHeader = cookiePairs.join('; ');
    
    // Create request object for requireAuth
    // We need to construct a NextRequest from the current request context
    // Since we're in an API route, we can use a dummy URL - requireAuth only reads cookies
    const req = new NextRequest('http://localhost/api', {
      headers: {
        cookie: cookieHeader,
      },
    });
    
    const authRes = await requireAuth(req);
    
    if (authRes instanceof NextResponse) {
      throw new Error('Unauthorized');
    }
    
    return getAuthzContextWithParams(req, authRes);
  }
  
  // If parameters provided, use them directly
  return getAuthzContextWithParams(request, authResult);
}

/**
 * Internal implementation of authz context building
 */
async function getAuthzContextWithParams(
  request: NextRequest,
  authResult: AuthenticatedUser
): Promise<AuthzContext> {
  const { user, tenantId } = authResult;
  const userId = user.id;
  
  // Get CVision role from platform role
  const cvisionRole = getCVisionRole(user.role);
  let roles = [user.role, cvisionRole].filter(Boolean);
  
  // Check if user.role is 'owner' or 'thea-owner' (CVision-specific OWNER role)
  const userRole = user.role as string;
  if (userRole === 'owner' ||
      userRole === CVISION_ROLES.OWNER ||
      userRole === 'thea-owner') {
    if (!roles.includes(CVISION_ROLES.OWNER)) {
      roles = [...roles, CVISION_ROLES.OWNER];
    }
  }
  
  // Dev-only logging
  if (process.env.NODE_ENV === 'development') {
    logger.info('[CVISION_AUTHZ]', {
      tenantId,
      userId,
      platformRole: user.role,
      cvisionRole,
      roles,
      hasOwner: roles.includes(CVISION_ROLES.OWNER),
      employeeId: null, // Will be set below
      deptScope: [], // Will be set below
    });
  }

  // Check if owner bypass is enabled (default: enabled in dev, disabled in prod unless set)
  const ownerEnabled = process.env.CVISION_OWNER_ENABLED === '1' ||
    (process.env.NODE_ENV === 'development' && process.env.CVISION_OWNER_ENABLED !== '0');

  // Check if user is OWNER and bypass is enabled
  const isOwner = ownerEnabled && roles.includes(CVISION_ROLES.OWNER);

  // Check for developer override impersonation (DEV-ONLY)
  const devOverrideEnabled = process.env.CVISION_DEV_OVERRIDE === '1' && process.env.NODE_ENV !== 'production';
  let impersonation: { role: string; departmentIds?: string[]; employeeId?: string } | null = null;
  
  if (devOverrideEnabled && isOwner) {
    try {
      const cookieStore = await cookies();
      const overrideCookie = cookieStore.get(`cvision_dev_override_${tenantId}`);

      if (overrideCookie) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(overrideCookie.value);
        } catch {
          logger.warn('[CVision Authz] Impersonation cookie contains malformed JSON — ignoring and falling back to normal auth');
          parsed = null;
        }

        // Validate the parsed object has the minimum required fields (role is mandatory,
        // userId is expected for audit purposes). Any other shape is silently discarded.
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          typeof (parsed as Record<string, unknown>).role === 'string' &&
          (parsed as Record<string, unknown>).role !== '' &&
          typeof (parsed as Record<string, unknown>).userId === 'string' &&
          (parsed as Record<string, unknown>).userId !== ''
        ) {
          impersonation = parsed as { role: string; departmentIds?: string[]; employeeId?: string };
        } else if (parsed !== null) {
          logger.warn(
            '[CVision Authz] Impersonation cookie has unexpected shape (missing userId/role) — ignoring',
            { tenantId }
          );
        }
      }
    } catch (error) {
      // If cookie read fails for any other reason, continue without impersonation
      logger.warn('[CVision Authz] Failed to read dev override cookie:', error);
    }
  }

  // Initialize context
  const context: AuthzContext = {
    tenantId,
    userId,
    roles: impersonation ? [impersonation.role, getCVisionRole(impersonation.role)].filter(Boolean) : roles,
    cvisionRole: impersonation ? getCVisionRole(impersonation.role) : cvisionRole,
    departmentIds: impersonation?.departmentIds || [],
    isOwner: impersonation ? false : isOwner, // When impersonating, don't use owner bypass
    employeeId: impersonation?.employeeId,
  };

  // If impersonating with employeeId, resolve employee status
  if (impersonation?.employeeId) {
    try {
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await employeeCollection.findOne(
        createTenantFilter(tenantId, {
          id: impersonation.employeeId,
          isArchived: { $ne: true },
        })
      );

      if (employee) {
        // Normalize status to canonical (prevents "status: undefined" logs)
        context.employeeStatus = normalizeStatus(employee.status);
        // If departmentIds not set in impersonation, use employee's department
        if (!impersonation.departmentIds || impersonation.departmentIds.length === 0) {
          if (employee.departmentId) {
            context.departmentIds = [employee.departmentId];
          }
        }
      }
    } catch (error: any) {
      logger.warn('[CVision Authz] Failed to resolve impersonated employee:', error?.message || String(error));
    }
  } else {
    // Resolve employee record if user is linked to one (only when not impersonating)
    try {
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      // Try to find employee by email matching user.email
      // Note: CVisionEmployee doesn't have userId field, so we match by email
      if (user.email) {
        const employee = await employeeCollection.findOne(
          createTenantFilter(tenantId, {
            email: user.email,
            isArchived: { $ne: true },
          })
        );

        if (employee) {
          context.employeeId = employee.id;
          // Normalize status to canonical (prevents "status: undefined" logs)
          context.employeeStatus = normalizeStatus(employee.status);

          // Get department IDs (only if not already set by impersonation)
          if (employee.departmentId && (!impersonation || !impersonation.departmentIds || impersonation.departmentIds.length === 0)) {
            context.departmentIds = [employee.departmentId];
          }

          // If employee has manager chain, include manager's departments
          // For now, just use direct department
        }
      }
    } catch (error: any) {
      // If employee lookup fails, continue without employee context
      // Don't throw - authz context can work without employee link
      logger.warn('[CVision Authz] Failed to resolve employee:', error?.message || String(error));
    }
  }
  
  // Dev-only logging: final context
  if (process.env.NODE_ENV === 'development') {
    logger.info('[CVISION_AUTHZ] Final context:', {
      tenantId: context.tenantId,
      userId: context.userId,
      roles: context.roles,
      employeeId: context.employeeId,
      departmentIds: context.departmentIds,
      employeeStatus: context.employeeStatus,
      isOwner: context.isOwner,
      hasOwnerRole: context.roles.includes(CVISION_ROLES.OWNER),
      deptScope: context.departmentIds,
    });
  }

  return context;
}

/**
 * Get authz context from request (convenience wrapper)
 * Uses requireAuth internally and builds context
 */
export async function getAuthzContextFromRequest(request: NextRequest): Promise<AuthzContext> {
  const { requireAuth } = await import('@/lib/auth/requireAuth');
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    throw new Error('Unauthorized');
  }
  
  return getAuthzContext(request, authResult);
}

/**
 * Check if user is terminated (should be blocked from CVision)
 */
export function isTerminated(context: AuthzContext): boolean {
  return context.employeeStatus === 'terminated';
}

/**
 * Check if user is resigned (read-only access)
 */
export function isResigned(context: AuthzContext): boolean {
  return context.employeeStatus === 'resigned';
}

/**
 * Check if user is on probation (restricted access)
 */
export function isOnProbation(context: AuthzContext): boolean {
  return context.employeeStatus === 'probation';
}

/**
 * Check if user has tenant-wide access (OWNER, HR_ADMIN, CVISION_ADMIN, AUDITOR)
 */
export function hasTenantWideAccess(context: AuthzContext): boolean {
  // OWNER role bypasses all ABAC checks
  if (context.roles.includes(CVISION_ROLES.OWNER)) {
    return true;
  }
  
  return context.roles.some(role =>
    role === CVISION_ROLES.CVISION_ADMIN ||
    role === CVISION_ROLES.HR_ADMIN ||
    role === CVISION_ROLES.AUDITOR ||
    role === 'admin' ||
    role === 'thea-owner'
  );
}

/**
 * Check if user is a candidate (should only access public portal)
 */
export function isCandidate(context: AuthzContext): boolean {
  return context.roles.includes(CVISION_ROLES.CANDIDATE);
}
