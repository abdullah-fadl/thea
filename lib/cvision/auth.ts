/**
 * CVision (HR OS) - Auth Helpers
 * 
 * Thin wrapper around existing auth primitives.
 * Does NOT duplicate auth logic - just provides CVision-specific helpers.
 */

import { withAuthTenant as baseWithAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from './constants';

// Re-export base auth wrapper for CVision use
export { baseWithAuthTenant as withAuthTenant };

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if a role has a specific CVision permission
 */
export function hasPermission(role: string, permission: string): boolean {
  const rolePermissions = CVISION_ROLE_PERMISSIONS[role];
  if (!rolePermissions) {
    return false;
  }
  return rolePermissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: string, permissions: string[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: string, permissions: string[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: string): string[] {
  return CVISION_ROLE_PERMISSIONS[role] || [];
}

// =============================================================================
// Access Control Helpers
// =============================================================================

/**
 * Check if a user can view CVision module
 */
export function canViewCVision(role: string): boolean {
  return hasPermission(role, CVISION_PERMISSIONS.VIEW);
}

/**
 * Check if a user can manage employees
 */
export function canManageEmployees(role: string): boolean {
  return hasPermission(role, CVISION_PERMISSIONS.EMPLOYEES_WRITE);
}

/**
 * Check if a user can change employee status
 */
export function canChangeEmployeeStatus(role: string): boolean {
  return hasPermission(role, CVISION_PERMISSIONS.EMPLOYEES_STATUS);
}

/**
 * Check if a user can manage recruitment
 */
export function canManageRecruitment(role: string): boolean {
  return hasPermission(role, CVISION_PERMISSIONS.RECRUITMENT_WRITE);
}

/**
 * Check if a user can approve requests
 */
export function canApproveRequests(role: string): boolean {
  return hasPermission(role, CVISION_PERMISSIONS.REQUESTS_APPROVE);
}

/**
 * Check if a user can manage organization config
 */
export function canManageOrgConfig(role: string): boolean {
  return hasPermission(role, CVISION_PERMISSIONS.CONFIG_WRITE);
}

// =============================================================================
// Department-Based Access
// =============================================================================

/**
 * Check if a user can access data for a specific department
 * - Admins and HR Managers: all departments
 * - Supervisors: only their assigned department
 * - Staff: only their own data
 */
export function canAccessDepartment(
  role: string,
  userDepartmentId: string | undefined,
  targetDepartmentId: string
): boolean {
  // Admin and HR Manager have access to all departments
  if (role === 'admin' || role === 'thea-owner' || role === 'hr-manager') {
    return true;
  }
  
  // Supervisors can only access their own department
  if (role === 'supervisor') {
    return userDepartmentId === targetDepartmentId;
  }
  
  // Staff can only access their own department (limited read)
  if (role === 'staff') {
    return userDepartmentId === targetDepartmentId;
  }
  
  return false;
}

/**
 * Build a department filter for queries based on user access
 * Returns undefined if user has access to all departments
 */
export function buildDepartmentFilter(
  role: string,
  userDepartmentId: string | undefined
): { departmentId: string } | undefined {
  // Admin and HR Manager see all
  if (role === 'admin' || role === 'thea-owner' || role === 'hr-manager') {
    return undefined;
  }
  
  // Others are scoped to their department
  if (userDepartmentId) {
    return { departmentId: userDepartmentId };
  }
  
  // No department assigned - return impossible filter to show nothing
  return { departmentId: '__none__' };
}
