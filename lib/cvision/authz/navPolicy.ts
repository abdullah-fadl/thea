/**
 * CVision Navigation Policy
 * 
 * Defines which navigation items are visible based on user's authorization context.
 * Uses the same authz context builder as API routes for consistency.
 */

import type { AuthzContext } from './types';
import { CVISION_ROLES } from '@/lib/cvision/roles';

/**
 * Check if user is terminated (client-safe version)
 */
function isTerminated(ctx: AuthzContext): boolean {
  return ctx.employeeStatus === 'terminated';
}

/**
 * Check if user is resigned (client-safe version)
 */
function isResigned(ctx: AuthzContext): boolean {
  return ctx.employeeStatus === 'resigned';
}

/**
 * Check if user is a candidate (client-safe version)
 */
function isCandidate(ctx: AuthzContext): boolean {
  return ctx.roles.includes(CVISION_ROLES.CANDIDATE);
}

/**
 * Check if user has tenant-wide access (client-safe version)
 */
function hasTenantWideAccess(ctx: AuthzContext): boolean {
  return ctx.roles.some(role => 
    role === CVISION_ROLES.CVISION_ADMIN ||
    role === CVISION_ROLES.HR_ADMIN ||
    role === CVISION_ROLES.AUDITOR ||
    role === 'admin' ||
    role === 'thea-owner'
  );
}

/**
 * Check if user can see Recruitment section in navigation
 * Uses same logic as canListRequisitions policy
 */
export function canSeeRecruitment(ctx: AuthzContext): boolean {
  // Owner bypass (when enabled)
  if (ctx.isOwner) {
    return true;
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return false;
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return false;
  }

  // Tenant-wide access (HR_ADMIN, CVISION_ADMIN, AUDITOR)
  if (hasTenantWideAccess(ctx)) {
    return true;
  }

  // HR_MANAGER/MANAGER/EMPLOYEE: department access
  if (
    ctx.roles.includes(CVISION_ROLES.HR_MANAGER) ||
    ctx.roles.includes('manager') ||
    ctx.roles.includes(CVISION_ROLES.EMPLOYEE)
  ) {
    // Allow if user has department scope (filtering happens server-side)
    return ctx.departmentIds.length > 0;
  }

  return false;
}

/**
 * Check if user can see CV Inbox navigation item
 * CV Inbox requires HR roles (HR_ADMIN, HR_MANAGER) or CVISION_ADMIN
 * Same as Recruitment but more restrictive (no EMPLOYEE access)
 */
export function canSeeCvInbox(ctx: AuthzContext): boolean {
  // Owner bypass (when enabled)
  if (ctx.isOwner) {
    return true;
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return false;
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return false;
  }

  // Resigned users: read-only (CV Inbox requires write access)
  if (isResigned(ctx)) {
    return false;
  }

  // Tenant-wide access (HR_ADMIN, CVISION_ADMIN)
  if (hasTenantWideAccess(ctx)) {
    return true;
  }

  // HR_MANAGER: department access
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) || ctx.roles.includes('manager')) {
    // Allow if user has department scope
    return ctx.departmentIds.length > 0;
  }

  return false;
}

/**
 * Check if user can see Manpower Plans section in navigation
 * Manpower requires HR roles (HR_ADMIN, HR_MANAGER) or CVISION_ADMIN
 * Similar to Recruitment but focused on budget/utilization
 */
export function canSeeManpower(ctx: AuthzContext): boolean {
  // Owner bypass (when enabled)
  if (ctx.isOwner) {
    return true;
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return false;
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return false;
  }

  // Tenant-wide access (HR_ADMIN, CVISION_ADMIN, AUDITOR)
  if (hasTenantWideAccess(ctx)) {
    return true;
  }

  // HR_MANAGER/MANAGER: department access
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) || ctx.roles.includes('manager')) {
    // Allow if user has department scope (filtering happens server-side)
    return ctx.departmentIds.length > 0;
  }

  return false;
}

/**
 * Get reason why navigation item is hidden (for debugging)
 */
export function getNavHideReason(ctx: AuthzContext, itemName: string): string | null {
  if (ctx.employeeStatus === 'terminated') {
    return `TERMINATED_ACCESS_BLOCKED`;
  }
  
  if (itemName === 'CV_INBOX') {
    const allowedRoles = [
      CVISION_ROLES.CVISION_ADMIN,
      CVISION_ROLES.HR_ADMIN,
      CVISION_ROLES.HR_MANAGER,
    ];
    
    const hasAllowedRole = ctx.roles.some(role => allowedRoles.includes(role as any));

    if (!hasAllowedRole) {
      return `INSUFFICIENT_ROLE: requires one of [${allowedRoles.join(', ')}], got [${ctx.roles.join(', ')}]`;
    }

    if (ctx.employeeStatus === 'resigned') {
      return `RESIGNED_READONLY`;
    }
  }

  if (itemName === 'MANPOWER') {
    const allowedRoles = [
      CVISION_ROLES.CVISION_ADMIN,
      CVISION_ROLES.HR_ADMIN,
      CVISION_ROLES.HR_MANAGER,
      CVISION_ROLES.AUDITOR,
    ];

    const hasAllowedRole = ctx.roles.some(role => allowedRoles.includes(role as any) || role === 'manager');
    
    if (!hasAllowedRole) {
      return `INSUFFICIENT_ROLE: requires one of [${allowedRoles.join(', ')}, manager], got [${ctx.roles.join(', ')}]`;
    }
  }
  
  return null;
}
