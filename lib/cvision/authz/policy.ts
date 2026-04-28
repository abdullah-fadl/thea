/**
 * CVision Authorization Policy Functions
 * 
 * Simple, testable policy checks for CVision resources.
 * Each function returns { allowed: boolean, reason?: string }
 */

import type { AuthzContext } from './types';
import { isTerminated, isResigned, hasTenantWideAccess, isCandidate } from './context';
import type { CVisionEmployee, CVisionJobRequisition, CVisionCandidate } from '@/lib/cvision/types';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import { normalizeStatus } from '@/lib/cvision/status';

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

// =============================================================================
// Organization Policies
// =============================================================================

/**
 * Check if user can read organization data (departments, positions, etc.)
 * 
 * Rules:
 * - OWNER: can read all
 * - HR_ADMIN/CVISION_ADMIN/AUDITOR: can read all
 * - HR_MANAGER/MANAGER: can read (department-scoped filtering handled by query)
 * - EMPLOYEE: can read (department-scoped filtering handled by query)
 * - TERMINATED: blocked
 */
export function canReadOrg(ctx: AuthzContext): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Tenant-wide access roles
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // HR_MANAGER/MANAGER can read org data
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) || ctx.roles.includes('manager')) {
    return { allowed: true };
  }

  // EMPLOYEE can read org data (filtering handled by query)
  if (ctx.roles.includes(CVISION_ROLES.EMPLOYEE)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can read departments
 * Alias for canReadOrg (departments are part of org data)
 */
export function canReadDepartments(ctx: AuthzContext): PolicyResult {
  return canReadOrg(ctx);
}

/**
 * Check if user can write organization data (create/update departments, positions, etc.)
 * 
 * Rules:
 * - OWNER: can write all
 * - HR_ADMIN/CVISION_ADMIN: can write all
 * - HR_MANAGER: can write (department-scoped filtering handled by query)
 * - TERMINATED: blocked
 */
export function canWriteOrg(ctx: AuthzContext): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Tenant-wide write access roles
  if (ctx.roles.includes(CVISION_ROLES.HR_ADMIN) || ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN)) {
    return { allowed: true };
  }

  // HR_MANAGER can write org data
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Employee Policies
// =============================================================================

/**
 * Check if user can list employees
 * 
 * Rules:
 * - THEA_OWNER (when enabled): bypasses all checks
 * - HR_ADMIN/CVISION_ADMIN/AUDITOR: can list all
 * - HR_MANAGER/MANAGER: can list employees in their department(s)
 * - EMPLOYEE: can only see self (handled by filter)
 * - CANDIDATE: cannot list employees
 * - TERMINATED: blocked (403)
 */
export function canListEmployees(ctx: AuthzContext): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return { allowed: false, reason: 'CANDIDATE_NO_INTERNAL_ACCESS' };
  }

  // Tenant-wide access roles
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // HR_MANAGER/MANAGER can list their department
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) || ctx.roles.includes('manager')) {
    if (ctx.departmentIds.length > 0) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'NO_DEPARTMENT_ASSIGNED' };
  }

  // EMPLOYEE can list (but filter will restrict to self)
  if (ctx.roles.includes(CVISION_ROLES.EMPLOYEE)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can read a specific employee
 * 
 * Rules:
 * - HR_ADMIN/CVISION_ADMIN/AUDITOR: can read all
 * - HR_MANAGER/MANAGER: can read employees in their department
 * - EMPLOYEE: can read self only
 * - CANDIDATE: cannot read employees
 * - TERMINATED: blocked
 */
export function canReadEmployee(ctx: AuthzContext, employee: CVisionEmployee): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Tenant isolation
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return { allowed: false, reason: 'CANDIDATE_NO_INTERNAL_ACCESS' };
  }

  // Tenant-wide access
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // Self-access (always allowed)
  if (ctx.employeeId === employee.id) {
    return { allowed: true };
  }

  // HR_MANAGER/MANAGER: department access
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) || ctx.roles.includes('manager')) {
    if (employee.departmentId && ctx.departmentIds.includes(employee.departmentId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'DEPARTMENT_MISMATCH' };
  }

  // EMPLOYEE: only self
  if (ctx.roles.includes(CVISION_ROLES.EMPLOYEE)) {
    return { allowed: false, reason: 'SELF_ONLY' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can write (create/update) an employee
 * 
 * Rules:
 * - HR_ADMIN/CVISION_ADMIN: can write all
 * - HR_MANAGER: can write employees in their department
 * - EMPLOYEE: cannot write (self-service handled separately)
 * - RESIGNED: read-only (403 on write)
 * - TERMINATED: blocked
 */
export function canWriteEmployee(ctx: AuthzContext, employee: CVisionEmployee): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Tenant isolation
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Resigned users: read-only
  if (isResigned(ctx)) {
    return { allowed: false, reason: 'RESIGNED_READONLY' };
  }

  // OWNER / HR_ADMIN / CVISION_ADMIN: full write access
  if (ctx.roles.includes(CVISION_ROLES.OWNER) || 
      ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN) || 
      ctx.roles.includes(CVISION_ROLES.HR_ADMIN)) {
    return { allowed: true };
  }

  // HR_MANAGER: can write employees in their department
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER)) {
    if (employee.departmentId && ctx.departmentIds.includes(employee.departmentId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'DEPARTMENT_MISMATCH' };
  }

  // EMPLOYEE: cannot write other employees
  if (ctx.roles.includes(CVISION_ROLES.EMPLOYEE)) {
    // Self-service edits handled separately (not here)
    return { allowed: false, reason: 'EMPLOYEE_NO_WRITE' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can edit a specific profile section for an employee
 * 
 * Rules:
 * - HR_ADMIN / CVISION_ADMIN: can edit all sections for any employee (within tenant)
 * - HR_MANAGER: can edit PERSONAL/EMPLOYMENT/CONTRACT for employees in scoped departments; FINANCIAL is read-only
 * - EMPLOYEE: can edit PERSONAL only for self; all other sections read-only
 * - OWNER: read-only unless also has HR_ADMIN role
 * - TERMINATED/RESIGNED employees: blocked (except HR roles)
 */
export function canEditProfileSection(
  ctx: AuthzContext,
  employee: CVisionEmployee,
  sectionKey: string
): PolicyResult {
  // OWNER role: tenant super-admin override - can edit all sections
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled) - but check if they have HR_ADMIN role
  if (ctx.isOwner) {
    // OWNER without HR role is read-only
    // Since thea-owner maps to cvision_admin, this check will pass for thea-owner
    // But if OWNER somehow doesn't have the mapped role, they're read-only
    if (!ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN) && !ctx.roles.includes(CVISION_ROLES.HR_ADMIN)) {
      return { allowed: false, reason: 'OWNER_READ_ONLY' };
    }
  }

  // Tenant isolation
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Resigned users: read-only
  if (isResigned(ctx)) {
    return { allowed: false, reason: 'RESIGNED_READONLY' };
  }

  // Check if target employee is terminated/resigned (blocked except HR roles and OWNER)
  // Normalize status for comparison (handles legacy lowercase values)
  const normalizedEmployeeStatus = normalizeStatus(employee.status);
  if (normalizedEmployeeStatus === 'TERMINATED' || normalizedEmployeeStatus === 'RESIGNED') {
    const hasHRRole = ctx.roles.includes(CVISION_ROLES.OWNER) ||
                      ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN) || 
                      ctx.roles.includes(CVISION_ROLES.HR_ADMIN) || 
                      ctx.roles.includes(CVISION_ROLES.HR_MANAGER);
    if (!hasHRRole) {
      return { allowed: false, reason: 'EMPLOYEE_STATUS_BLOCKED' };
    }
  }

  // OWNER / HR_ADMIN / CVISION_ADMIN: can edit all sections
  if (ctx.roles.includes(CVISION_ROLES.OWNER) || 
      ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN) || 
      ctx.roles.includes(CVISION_ROLES.HR_ADMIN)) {
    return { allowed: true };
  }

  // HR_MANAGER: can edit PERSONAL/EMPLOYMENT/CONTRACT for employees in their departments; FINANCIAL is read-only
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER)) {
    // FINANCIAL section is read-only for HR_MANAGER
    if (sectionKey === 'FINANCIAL') {
      return { allowed: false, reason: 'SECTION_READONLY' };
    }
    
    // Check department access for other sections
    if (!employee.departmentId || !ctx.departmentIds.includes(employee.departmentId)) {
      return { allowed: false, reason: 'FORBIDDEN_SCOPE' };
    }
    
    // PERSONAL, EMPLOYMENT, CONTRACT are allowed if in scope
    if (['PERSONAL', 'EMPLOYMENT', 'CONTRACT'].includes(sectionKey)) {
      return { allowed: true };
    }
    
    return { allowed: false, reason: 'FORBIDDEN_SECTION' };
  }

  // EMPLOYEE: can edit PERSONAL only for self
  if (ctx.roles.includes(CVISION_ROLES.EMPLOYEE)) {
    // Must be editing own profile
    if (ctx.employeeId !== employee.id && ctx.employeeId !== employee.employeeNo) {
      return { allowed: false, reason: 'FORBIDDEN_EMPLOYEE' };
    }
    // Only PERSONAL section allowed
    if (sectionKey !== 'PERSONAL') {
      return { allowed: false, reason: 'FORBIDDEN_SECTION' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Recruitment Policies
// =============================================================================

/**
 * Check if user can list requisitions
 * 
 * Rules:
 * - HR_ADMIN/CVISION_ADMIN/AUDITOR: can list all
 * - HR_MANAGER: can list requisitions in their department
 * - EMPLOYEE: can list requisitions in their department
 * - CANDIDATE: cannot access internal CVision
 * - TERMINATED: blocked
 */
export function canListRequisitions(ctx: AuthzContext): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return { allowed: false, reason: 'CANDIDATE_NO_INTERNAL_ACCESS' };
  }

  // Tenant-wide access
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // HR_MANAGER/MANAGER/EMPLOYEE: department access
  if (
    ctx.roles.includes(CVISION_ROLES.HR_MANAGER) ||
    ctx.roles.includes('manager') ||
    ctx.roles.includes(CVISION_ROLES.EMPLOYEE)
  ) {
    if (ctx.departmentIds.length > 0) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'NO_DEPARTMENT_ASSIGNED' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can access CV Inbox
 * 
 * Rules:
 * - HR_ADMIN/CVISION_ADMIN: can access all
 * - HR_MANAGER: can access if has department scope
 * - EMPLOYEE: cannot access (CV Inbox requires HR role)
 * - CANDIDATE: cannot access internal CVision
 * - TERMINATED: blocked
 * - RESIGNED: blocked (read-only, CV Inbox requires write)
 */
export function canAccessCvInbox(ctx: AuthzContext): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return { allowed: false, reason: 'CANDIDATE_NO_INTERNAL_ACCESS' };
  }

  // Resigned users: read-only (CV Inbox requires write access)
  if (isResigned(ctx)) {
    return { allowed: false, reason: 'RESIGNED_READONLY' };
  }

  // Tenant-wide access (HR_ADMIN, CVISION_ADMIN)
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // HR_MANAGER: department access
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) || ctx.roles.includes('manager')) {
    if (ctx.departmentIds.length > 0) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'NO_DEPARTMENT_ASSIGNED' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can read a requisition
 */
export function canReadRequisition(ctx: AuthzContext, requisition: CVisionJobRequisition): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Tenant isolation
  if (ctx.tenantId !== requisition.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Candidates cannot access internal CVision
  if (isCandidate(ctx)) {
    return { allowed: false, reason: 'CANDIDATE_NO_INTERNAL_ACCESS' };
  }

  // Tenant-wide access
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // Department access
  if (requisition.departmentId && ctx.departmentIds.includes(requisition.departmentId)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'DEPARTMENT_MISMATCH' };
}

/**
 * Check if user can read a candidate
 * 
 * Rules:
 * - HR_ADMIN/CVISION_ADMIN/AUDITOR: can read all
 * - HR_MANAGER: can read candidates for requisitions in their department
 * - EMPLOYEE: cannot read candidates
 * - CANDIDATE: can read own application only
 * - TERMINATED: blocked
 */
export function canReadCandidate(ctx: AuthzContext, candidate: CVisionCandidate): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Tenant isolation
  if (ctx.tenantId !== candidate.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Tenant-wide access
  if (hasTenantWideAccess(ctx)) {
    return { allowed: true };
  }

  // HR_MANAGER: can read candidates (department check done at API level via requisition)
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER)) {
    return { allowed: true };
  }

  // CANDIDATE: can read own application
  if (isCandidate(ctx)) {
    // Check if this is the candidate's own record (by userId or email)
    // This is handled at API level with filter
    return { allowed: true };
  }

  // EMPLOYEE: cannot read candidates
  if (ctx.roles.includes(CVISION_ROLES.EMPLOYEE)) {
    return { allowed: false, reason: 'EMPLOYEE_NO_CANDIDATE_ACCESS' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can write (create/update) a candidate
 */
export function canWriteCandidate(ctx: AuthzContext, candidate: CVisionCandidate): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Tenant isolation
  if (ctx.tenantId !== candidate.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Resigned users: read-only
  if (isResigned(ctx)) {
    return { allowed: false, reason: 'RESIGNED_READONLY' };
  }

  // HR_ADMIN/CVISION_ADMIN: full write access
  if (ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN) || ctx.roles.includes(CVISION_ROLES.HR_ADMIN)) {
    return { allowed: true };
  }

  // HR_MANAGER: can write candidates
  if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER)) {
    return { allowed: true };
  }

  // CANDIDATE: can write own application (handled at API level)
  if (isCandidate(ctx)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Payroll Policies
// =============================================================================

/**
 * Check if user can access payroll
 * 
 * Rules:
 * - HR_ADMIN/CVISION_ADMIN only
 * - All others: blocked
 */
export function canAccessPayroll(ctx: AuthzContext): PolicyResult {
  // OWNER role: tenant super-admin override
  if (ctx.roles.includes(CVISION_ROLES.OWNER)) {
    return { allowed: true };
  }
  
  // THEA_OWNER bypass (when enabled)
  if (ctx.isOwner) {
    return { allowed: true };
  }

  // Terminated users blocked
  if (isTerminated(ctx)) {
    return { allowed: false, reason: 'TERMINATED_ACCESS_BLOCKED' };
  }

  // Only HR_ADMIN/CVISION_ADMIN
  if (
    ctx.roles.includes(CVISION_ROLES.CVISION_ADMIN) ||
    ctx.roles.includes(CVISION_ROLES.HR_ADMIN)
  ) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'PAYROLL_ADMIN_ONLY' };
}
