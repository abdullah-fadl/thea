/**
 * CVision (HR OS) - Policy Functions (ABAC)
 * 
 * Attribute-Based Access Control policies for CVision resources.
 * These functions determine if a user can perform actions on specific resources.
 * 
 * Roles: CVISION_ADMIN, HR_ADMIN, HR_MANAGER, EMPLOYEE, CANDIDATE, AUDITOR
 * 
 * Department Visibility Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER, AUDITOR: Tenant-wide access
 * - EMPLOYEE: Department-scoped (own department only) + self-access
 * - CANDIDATE: Application status only
 */

import {
  CVISION_ROLES,
  CVisionRole,
  getRoleCapabilities,
  getCVisionRole,
  isHRRole,
  hasTenantWideAccess,
  isCandidateRole,
  hasMinimumRole,
} from './roles';
import {
  canAccessInternalModules,
  canCreateRequests,
  canViewFinalPayslip,
  hasRestrictedPrivileges,
  getAccessLevel,
  EMPLOYEE_STATUSES,
  type EmployeeStatusType,
} from './statusMachine';

// =============================================================================
// Policy Context
// =============================================================================

export interface PolicyContext {
  /** User's ID */
  userId: string;
  
  /** User's tenant ID */
  tenantId: string;
  
  /** User's platform role (maps to CVision role) */
  role: string;
  
  /** User's CVision-specific role (if set) */
  cvisionRole?: CVisionRole;
  
  /** User's assigned department ID (for department-scoped access) */
  departmentId?: string;
  
  /** User's employee record ID (for self-service checks) */
  employeeId?: string;
}

// =============================================================================
// Resource Types
// =============================================================================

export interface EmployeeResource {
  id: string;
  tenantId: string;
  departmentId: string;
  status?: string | EmployeeStatusType;
  employeeId?: string; // For self-checks
}

export interface RequestResource {
  id: string;
  tenantId: string;
  employeeId: string;
  departmentId?: string;
  status?: string;
  createdBy?: string;
  assignedTo?: string;
  employeeStatus?: EmployeeStatusType;
  type?: string;
  confidentiality?: string;
}

export interface RequisitionResource {
  id: string;
  tenantId: string;
  departmentId: string;
  status?: string;
  createdBy?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get effective CVision role from context
 */
function getEffectiveRole(ctx: PolicyContext): CVisionRole {
  return ctx.cvisionRole || getCVisionRole(ctx.role);
}

/**
 * Check if user is in the same department as the resource
 */
function isSameDepartment(ctx: PolicyContext, resourceDepartmentId?: string): boolean {
  if (!ctx.departmentId || !resourceDepartmentId) {
    return false;
  }
  return ctx.departmentId === resourceDepartmentId;
}

/**
 * Check if user owns the resource (created it or is assigned to it)
 */
function isResourceOwner(ctx: PolicyContext, resource: { createdBy?: string; employeeId?: string }): boolean {
  if (resource.createdBy && resource.createdBy === ctx.userId) {
    return true;
  }
  if (resource.employeeId && ctx.employeeId && resource.employeeId === ctx.employeeId) {
    return true;
  }
  return false;
}

// =============================================================================
// Employee Policies
// =============================================================================

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if user can read an employee record
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER, AUDITOR: Read all employees in tenant
 * - EMPLOYEE: Read employees in their department + own record
 * - CANDIDATE: Cannot read employee records
 * - Status-based: TERMINATED/RESIGNED employees have restricted access
 */
export function canReadEmployee(ctx: PolicyContext, employee: EmployeeResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  // Candidates cannot read employee records
  if (isCandidateRole(role)) {
    return { allowed: false, reason: 'CANDIDATE_NO_ACCESS' };
  }

  // HR and Auditor roles can read all (tenant-wide access) - bypass status checks
  if (caps.canReadAllEmployees || hasTenantWideAccess(role)) {
    return { allowed: true };
  }

  // Employees can read their own record (even if terminated/resigned)
  if (ctx.employeeId === employee.id || ctx.employeeId === employee.employeeId) {
    return { allowed: true };
  }

  // Check status-based access for reading other employees
  const employeeStatus = employee.status as EmployeeStatusType | undefined;
  if (employeeStatus) {
    // TERMINATED employees cannot access internal modules (except final payslip)
    if (employeeStatus === EMPLOYEE_STATUSES.TERMINATED && role === CVISION_ROLES.EMPLOYEE) {
      return { allowed: false, reason: 'TERMINATED_EMPLOYEE_NO_ACCESS' };
    }
    // RESIGNED employees have limited access
    if (employeeStatus === EMPLOYEE_STATUSES.RESIGNED && role === CVISION_ROLES.EMPLOYEE) {
      return { allowed: false, reason: 'RESIGNED_EMPLOYEE_LIMITED_ACCESS' };
    }
  }

  // Employees can read employees in their department
  if (role === CVISION_ROLES.EMPLOYEE && isSameDepartment(ctx, employee.departmentId)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can write (create/update) an employee record
 * 
 * Rules:
 * - HR roles (Admin, Specialist) can write all employees
 * - Managers cannot write employees
 * - Employees cannot write other employees
 * - TERMINATED/RESIGNED employees cannot be modified (except by HR)
 * - Employees CAN update limited fields on their own record (handled separately)
 */
export function canWriteEmployee(ctx: PolicyContext, employee: EmployeeResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  // HR roles can write all employees (bypass status checks)
  if (caps.canWriteEmployees) {
    return { allowed: true };
  }

  // Check status-based restrictions for non-HR roles
  const employeeStatus = employee.status as EmployeeStatusType | undefined;
  if (employeeStatus) {
    // TERMINATED employees cannot be modified by non-HR roles
    if (employeeStatus === EMPLOYEE_STATUSES.TERMINATED) {
      return { allowed: false, reason: 'TERMINATED_EMPLOYEE_READ_ONLY' };
    }
    // RESIGNED employees have limited write access
    if (employeeStatus === EMPLOYEE_STATUSES.RESIGNED && role === CVISION_ROLES.EMPLOYEE) {
      return { allowed: false, reason: 'RESIGNED_EMPLOYEE_LIMITED_WRITE' };
    }
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can change an employee's status
 * 
 * Rules:
 * - Only HR Admin and CVision Admin can change status
 * - HR Specialist can change status (with some restrictions)
 */
export function canChangeEmployeeStatus(ctx: PolicyContext, employee: EmployeeResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  if (caps.canChangeEmployeeStatus) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can delete (soft delete) an employee
 * 
 * Rules:
 * - Only Admin roles can delete employees
 */
export function canDeleteEmployee(ctx: PolicyContext, employee: EmployeeResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== employee.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  if (caps.canDeleteEmployees) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Request Policies
// =============================================================================

/**
 * Check if user can read a request
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER, AUDITOR: Read all requests in tenant
 * - EMPLOYEE: Read own requests + requests in their department (non-confidential)
 * - CANDIDATE: Cannot read requests
 * - TERMINATED: Can only read final payslip requests
 * - RESIGNED: Limited access to own requests
 */
export function canReadRequest(ctx: PolicyContext, request: RequestResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== request.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  // Candidates cannot read requests
  if (isCandidateRole(role)) {
    return { allowed: false, reason: 'CANDIDATE_NO_ACCESS' };
  }

  // HR and Auditor roles can read all (tenant-wide access) - bypass status checks
  if (caps.canReadAllRequests || hasTenantWideAccess(role)) {
    return { allowed: true };
  }

  // Employees: check status-based access
  if (role === CVISION_ROLES.EMPLOYEE) {
    // Get employee status from context
    const employeeStatus = request.employeeStatus;
    
    // TERMINATED employees can only read final payslip requests
    if (employeeStatus === EMPLOYEE_STATUSES.TERMINATED) {
      const requestType = request.type;
      const isOwnRequest = isResourceOwner(ctx, request);
      // Allow reading own final payslip requests
      if (isOwnRequest && (requestType === 'payroll_issue' || requestType === 'other')) {
        return { allowed: true, reason: 'FINAL_PAYSLIP_ALLOWED' };
      }
      return { allowed: false, reason: 'TERMINATED_EMPLOYEE_NO_ACCESS' };
    }

    // RESIGNED employees have limited access to own requests
    if (employeeStatus === EMPLOYEE_STATUSES.RESIGNED) {
      if (isResourceOwner(ctx, request)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'RESIGNED_EMPLOYEE_LIMITED_ACCESS' };
    }

    // Employees can read their own requests
    if (isResourceOwner(ctx, request)) {
      return { allowed: true };
    }

    // Employees can read non-confidential requests in their department
    if (isSameDepartment(ctx, request.departmentId)) {
      // Check confidentiality - employees can only see 'normal' confidentiality in their dept
      const confidentiality = request.confidentiality;
      if (!confidentiality || confidentiality === 'normal') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'CONFIDENTIAL_REQUEST' };
    }
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can create a request
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER: Create requests for anyone
 * - EMPLOYEE: Create requests for themselves only (if status allows)
 * - CANDIDATE, AUDITOR: Cannot create requests
 * - TERMINATED: Cannot create requests (except final payslip view)
 * - RESIGNED: Limited access (can create final payslip requests)
 * - PROBATION: Restricted privileges (configurable)
 */
export function canCreateRequest(ctx: PolicyContext, request: RequestResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== request.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);

  // Auditors and Candidates cannot create requests
  if (role === CVISION_ROLES.AUDITOR) {
    return { allowed: false, reason: 'AUDITOR_READ_ONLY' };
  }
  if (isCandidateRole(role)) {
    return { allowed: false, reason: 'CANDIDATE_NO_ACCESS' };
  }

  // HR roles can create any request (bypass status checks)
  if (isHRRole(role)) {
    return { allowed: true };
  }

  // Employees: check status-based access
  if (role === CVISION_ROLES.EMPLOYEE) {
    // Check if this is their own request
    if (!isResourceOwner(ctx, request)) {
      return { allowed: false, reason: 'SELF_ONLY' };
    }

    // Get employee status from context or request
    const employeeStatus = request.employeeStatus;
    
    if (employeeStatus) {
      // TERMINATED employees cannot create requests (except final payslip)
      if (employeeStatus === EMPLOYEE_STATUSES.TERMINATED) {
        const requestType = request.type;
        // Allow final payslip requests for terminated employees
        if (requestType === 'payroll_issue' || requestType === 'other') {
          // Check if it's specifically a final payslip request (would need metadata check)
          return { allowed: true, reason: 'FINAL_PAYSLIP_ALLOWED' };
        }
        return { allowed: false, reason: 'TERMINATED_EMPLOYEE_NO_REQUESTS' };
      }

      // RESIGNED employees have limited access
      if (employeeStatus === EMPLOYEE_STATUSES.RESIGNED) {
        // Allow final payslip and essential requests
        const requestType = request.type;
        if (['payroll_issue', 'other'].includes(requestType)) {
          return { allowed: true, reason: 'RESIGNED_LIMITED_REQUESTS' };
        }
        return { allowed: false, reason: 'RESIGNED_EMPLOYEE_LIMITED_ACCESS' };
      }

      // PROBATION employees have restricted privileges (configurable)
      if (employeeStatus === EMPLOYEE_STATUSES.PROBATION) {
        // Allow requests but may have restrictions based on configuration
        // For now, allow all requests for probation employees
        return { allowed: true };
      }
    }

    // Default: allow if own request and status allows
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can approve a request
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER: Approve any request (except own)
 * - EMPLOYEE, CANDIDATE, AUDITOR: Cannot approve requests
 */
export function canApproveRequest(ctx: PolicyContext, request: RequestResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== request.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  if (!caps.canApproveRequests) {
    return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
  }

  // Cannot approve own request (conflict of interest)
  if (isResourceOwner(ctx, request)) {
    return { allowed: false, reason: 'CANNOT_APPROVE_OWN_REQUEST' };
  }

  // HR roles can approve any request
  if (isHRRole(role)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can escalate a request
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER: Escalate any request
 * - EMPLOYEE: Escalate own rejected requests only
 * - CANDIDATE, AUDITOR: Cannot escalate requests
 */
export function canEscalateRequest(ctx: PolicyContext, request: RequestResource): PolicyResult {
  // Tenant isolation check
  if (ctx.tenantId !== request.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  // Candidates and Auditors cannot escalate
  if (isCandidateRole(role) || role === CVISION_ROLES.AUDITOR) {
    return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
  }

  // HR roles can escalate any request
  if (isHRRole(role)) {
    return { allowed: true };
  }

  // Employees can escalate their own rejected requests
  if (role === CVISION_ROLES.EMPLOYEE && isResourceOwner(ctx, request)) {
    if (request.status === 'rejected') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'CAN_ONLY_ESCALATE_REJECTED' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Recruitment Policies
// =============================================================================

/**
 * Check if user can manage recruitment (requisitions, candidates)
 */
export function canManageRecruitment(ctx: PolicyContext): PolicyResult {
  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  if (caps.canManageRecruitment) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

/**
 * Check if user can read a requisition
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER, AUDITOR: Read all requisitions
 * - EMPLOYEE: Read requisitions in their department
 * - CANDIDATE: Read only requisitions they applied to
 */
export function canReadRequisition(ctx: PolicyContext, requisition: RequisitionResource): PolicyResult {
  // Tenant isolation
  if (ctx.tenantId !== requisition.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);

  // HR roles and Auditors can read all (tenant-wide access)
  if (hasTenantWideAccess(role)) {
    return { allowed: true };
  }

  // Employees can see requisitions in their department
  if (role === CVISION_ROLES.EMPLOYEE && isSameDepartment(ctx, requisition.departmentId)) {
    return { allowed: true };
  }

  // Candidates can see requisitions they applied to (handled at API level with candidateId filter)
  if (isCandidateRole(role)) {
    // This check should be done at the API level with the candidate's applications
    return { allowed: false, reason: 'CANDIDATE_LIMITED_ACCESS' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Candidate Policies
// =============================================================================

export interface CandidateResource {
  id: string;
  tenantId: string;
  requisitionId: string;
  email?: string;
  userId?: string;
}

/**
 * Check if user can read a candidate record
 * 
 * Rules:
 * - CVISION_ADMIN, HR_ADMIN, HR_MANAGER, AUDITOR: Read all candidates
 * - EMPLOYEE: Cannot read candidates (unless they have recruitment permission)
 * - CANDIDATE: Read only their own application
 */
export function canReadCandidate(ctx: PolicyContext, candidate: CandidateResource): PolicyResult {
  // Tenant isolation
  if (ctx.tenantId !== candidate.tenantId) {
    return { allowed: false, reason: 'TENANT_MISMATCH' };
  }

  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  // HR roles and Auditors can read all
  if (hasTenantWideAccess(role) || caps.canManageRecruitment) {
    return { allowed: true };
  }

  // Candidates can read their own application
  if (isCandidateRole(role)) {
    // Check if this is the candidate's own record
    if (candidate.userId && candidate.userId === ctx.userId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'CAN_ONLY_VIEW_OWN_APPLICATION' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_PERMISSION' };
}

// =============================================================================
// Utility: Build Query Filter
// =============================================================================

/**
 * Build a MongoDB filter based on user's access level
 * Returns additional filter conditions to apply to queries
 */
export function buildAccessFilter(ctx: PolicyContext): Record<string, any> | null {
  const role = getEffectiveRole(ctx);

  // Tenant-wide access roles don't need additional filtering
  if (hasTenantWideAccess(role)) {
    return null; // No additional filter needed
  }

  // Candidate - can only see own applications
  if (isCandidateRole(role)) {
    return { 
      $or: [
        { userId: ctx.userId },
        { createdBy: ctx.userId },
      ]
    };
  }

  // Employee - department scoped + own records
  if (role === CVISION_ROLES.EMPLOYEE) {
    if (ctx.departmentId) {
      return { 
        $or: [
          { departmentId: ctx.departmentId },
          { id: ctx.employeeId },
          { employeeId: ctx.employeeId },
          { createdBy: ctx.userId },
        ]
      };
    }
    // If no department, only own records
    if (ctx.employeeId) {
      return { 
        $or: [
          { id: ctx.employeeId }, 
          { employeeId: ctx.employeeId }, 
          { createdBy: ctx.userId }
        ]
      };
    }
  }

  // Fallback - show nothing
  return { _impossible: true };
}

/**
 * Build a filter for requests based on user's access level
 * Handles confidentiality rules
 */
export function buildRequestAccessFilter(ctx: PolicyContext): Record<string, any> | null {
  const role = getEffectiveRole(ctx);

  // Tenant-wide access roles can see all requests
  if (hasTenantWideAccess(role)) {
    return null;
  }

  // Candidates cannot see requests
  if (isCandidateRole(role)) {
    return { _impossible: true };
  }

  // Employees can see:
  // 1. Their own requests
  // 2. Non-confidential requests in their department
  if (role === CVISION_ROLES.EMPLOYEE) {
    const filters: any[] = [
      { createdBy: ctx.userId },
      { employeeId: ctx.employeeId },
      { requesterEmployeeId: ctx.employeeId },
    ];

    if (ctx.departmentId) {
      filters.push({
        departmentId: ctx.departmentId,
        confidentiality: { $in: ['normal', null] },
      });
    }

    return { $or: filters };
  }

  return { _impossible: true };
}

/**
 * Build a filter for candidates based on user's access level
 */
export function buildCandidateAccessFilter(ctx: PolicyContext): Record<string, any> | null {
  const role = getEffectiveRole(ctx);
  const caps = getRoleCapabilities(role);

  // HR roles and those with recruitment permission can see all
  if (hasTenantWideAccess(role) || caps.canManageRecruitment) {
    return null;
  }

  // Candidates can only see their own applications
  if (isCandidateRole(role)) {
    return { userId: ctx.userId };
  }

  // Others cannot see candidates
  return { _impossible: true };
}
