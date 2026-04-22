/**
 * CVision (HR OS) - Role Definitions
 * 
 * Defines CVision-specific roles and their hierarchy.
 * Roles: CVISION_ADMIN, HR_ADMIN, HR_MANAGER, EMPLOYEE, CANDIDATE, AUDITOR
 */

// =============================================================================
// CVision Roles
// =============================================================================

export const CVISION_ROLES = {
  /** Platform superuser - bypasses all RBAC/ABAC checks (when enabled) */
  THEA_OWNER: 'thea-owner',

  /** Tenant super-admin override - unique to main owner only, bypasses all RBAC/ABAC */
  OWNER: 'owner',
  
  /** Full CVision module admin - all permissions */
  CVISION_ADMIN: 'cvision_admin',
  
  /** HR department admin - all HR operations */
  HR_ADMIN: 'hr_admin',
  
  /** HR manager - day-to-day HR operations + team management */
  HR_MANAGER: 'hr_manager',
  
  /** Line manager - sees direct + indirect reports only */
  MANAGER: 'manager',
  
  /** Regular employee - self-service only */
  EMPLOYEE: 'employee',
  
  /** Job candidate - limited access to application status */
  CANDIDATE: 'candidate',
  
  /** Read-only auditor - can view all, cannot modify */
  AUDITOR: 'auditor',
} as const;

export type CVisionRole = typeof CVISION_ROLES[keyof typeof CVISION_ROLES];

/**
 * Normalize a role string for comparison.
 * Platform roles use hyphens (e.g. 'hr-admin') while CVision roles use
 * underscores (e.g. 'hr_admin'). This normalizes both to lowercase with
 * underscores so comparisons work regardless of the source.
 */
export function normalizeRole(role: string | undefined | null): string {
  if (!role) return '';
  return role.toLowerCase().trim().replace(/-/g, '_');
}

// Legacy alias for backwards compatibility
export const HR_SPECIALIST = CVISION_ROLES.HR_MANAGER;

// =============================================================================
// Role Hierarchy
// =============================================================================

/**
 * Role hierarchy - higher level roles inherit permissions from lower levels
 * Index indicates power level (higher = more access)
 */
export const ROLE_HIERARCHY: Record<CVisionRole, number> = {
  [CVISION_ROLES.THEA_OWNER]: 300, // Platform superuser
  [CVISION_ROLES.OWNER]: 200, // Highest level - tenant super-admin
  [CVISION_ROLES.CVISION_ADMIN]: 100,
  [CVISION_ROLES.HR_ADMIN]: 80,
  [CVISION_ROLES.HR_MANAGER]: 60,
  [CVISION_ROLES.AUDITOR]: 40,
  [CVISION_ROLES.MANAGER]: 30,
  [CVISION_ROLES.EMPLOYEE]: 20,
  [CVISION_ROLES.CANDIDATE]: 5,
};

/**
 * Check if roleA has equal or higher privileges than roleB
 */
export function hasEqualOrHigherRole(roleA: string, roleB: string): boolean {
  const normA = normalizeRole(roleA);
  const normB = normalizeRole(roleB);
  const levelA = ROLE_HIERARCHY[normA as CVisionRole] ?? ROLE_HIERARCHY[roleA as CVisionRole] ?? 0;
  const levelB = ROLE_HIERARCHY[normB as CVisionRole] ?? ROLE_HIERARCHY[roleB as CVisionRole] ?? 0;
  return levelA >= levelB;
}

/**
 * Check if role is an admin-level role (CVision Admin, HR Admin, or any owner variant).
 *
 * Normalization converts hyphens to underscores, so 'thea-owner' → 'thea_owner'.
 * CVISION_ROLES.THEA_OWNER is stored as 'thea-owner' (hyphenated), so we must
 * compare against its normalized form ('thea_owner') as well as the raw constant
 * to handle both normalized and un-normalized callers.
 */
export function isAdminRole(role: string): boolean {
  const norm = normalizeRole(role);
  return (
    norm === CVISION_ROLES.OWNER ||
    norm === normalizeRole(CVISION_ROLES.THEA_OWNER) || // 'thea_owner'
    norm === CVISION_ROLES.CVISION_ADMIN ||
    norm === CVISION_ROLES.HR_ADMIN
  );
}

/**
 * Check if role is an HR role (any HR level)
 */
export function isHRRole(role: string): boolean {
  const norm = normalizeRole(role);
  return (
    norm === CVISION_ROLES.OWNER ||
    norm === CVISION_ROLES.CVISION_ADMIN ||
    norm === CVISION_ROLES.HR_ADMIN ||
    norm === CVISION_ROLES.HR_MANAGER
  );
}

/**
 * Check if role has tenant-wide visibility (not department-scoped)
 */
export function hasTenantWideAccess(role: string): boolean {
  const norm = normalizeRole(role);
  return (
    norm === CVISION_ROLES.OWNER ||
    norm === CVISION_ROLES.CVISION_ADMIN ||
    norm === CVISION_ROLES.HR_ADMIN ||
    norm === CVISION_ROLES.HR_MANAGER ||
    norm === CVISION_ROLES.AUDITOR
  );
}

/**
 * Check if role is a candidate (limited access)
 */
export function isCandidateRole(role: string): boolean {
  return normalizeRole(role) === CVISION_ROLES.CANDIDATE;
}

// =============================================================================
// Role Capabilities
// =============================================================================

export interface RoleCapabilities {
  canReadAllEmployees: boolean;
  canWriteEmployees: boolean;
  canChangeEmployeeStatus: boolean;
  canDeleteEmployees: boolean;
  canReadAllRequests: boolean;
  canWriteRequests: boolean;
  canApproveRequests: boolean;
  canEscalateRequests: boolean;
  canManageRecruitment: boolean;
  canManageOrgStructure: boolean;
  canViewAuditLogs: boolean;
  canManageRoles: boolean;
  canViewOwnApplications: boolean; // For candidates
  departmentScoped: boolean; // true = only sees own department
}

export const ROLE_CAPABILITIES: Record<CVisionRole, RoleCapabilities> = {
  [CVISION_ROLES.THEA_OWNER]: {
    canReadAllEmployees: true,
    canWriteEmployees: true,
    canChangeEmployeeStatus: true,
    canDeleteEmployees: true,
    canReadAllRequests: true,
    canWriteRequests: true,
    canApproveRequests: true,
    canEscalateRequests: true,
    canManageRecruitment: true,
    canManageOrgStructure: true,
    canViewAuditLogs: true,
    canManageRoles: true, // Platform owner can manage all roles
    canViewOwnApplications: false,
    departmentScoped: false,
  },
  [CVISION_ROLES.OWNER]: {
    canReadAllEmployees: true,
    canWriteEmployees: true,
    canChangeEmployeeStatus: true,
    canDeleteEmployees: true,
    canReadAllRequests: true,
    canWriteRequests: true,
    canApproveRequests: true,
    canEscalateRequests: true,
    canManageRecruitment: true,
    canManageOrgStructure: true,
    canViewAuditLogs: true,
    canManageRoles: false, // OWNER cannot grant OWNER (security)
    canViewOwnApplications: false,
    departmentScoped: false,
  },
  [CVISION_ROLES.CVISION_ADMIN]: {
    canReadAllEmployees: true,
    canWriteEmployees: true,
    canChangeEmployeeStatus: true,
    canDeleteEmployees: true,
    canReadAllRequests: true,
    canWriteRequests: true,
    canApproveRequests: true,
    canEscalateRequests: true,
    canManageRecruitment: true,
    canManageOrgStructure: true,
    canViewAuditLogs: true,
    canManageRoles: true,
    canViewOwnApplications: false,
    departmentScoped: false,
  },
  [CVISION_ROLES.HR_ADMIN]: {
    canReadAllEmployees: true,
    canWriteEmployees: true,
    canChangeEmployeeStatus: true,
    canDeleteEmployees: true,
    canReadAllRequests: true,
    canWriteRequests: true,
    canApproveRequests: true,
    canEscalateRequests: true,
    canManageRecruitment: true,
    canManageOrgStructure: true,
    canViewAuditLogs: true,
    canManageRoles: false,
    canViewOwnApplications: false,
    departmentScoped: false,
  },
  [CVISION_ROLES.HR_MANAGER]: {
    canReadAllEmployees: true,
    canWriteEmployees: true,
    canChangeEmployeeStatus: true,
    canDeleteEmployees: false,
    canReadAllRequests: true,
    canWriteRequests: true,
    canApproveRequests: true,
    canEscalateRequests: true,
    canManageRecruitment: true,
    canManageOrgStructure: false,
    canViewAuditLogs: false,
    canManageRoles: false,
    canViewOwnApplications: false,
    departmentScoped: false,
  },
  [CVISION_ROLES.MANAGER]: {
    canReadAllEmployees: false,
    canWriteEmployees: false,
    canChangeEmployeeStatus: false,
    canDeleteEmployees: false,
    canReadAllRequests: false,
    canWriteRequests: true,
    canApproveRequests: true,
    canEscalateRequests: false,
    canManageRecruitment: false,
    canManageOrgStructure: false,
    canViewAuditLogs: false,
    canManageRoles: false,
    canViewOwnApplications: false,
    departmentScoped: true,
  },
  [CVISION_ROLES.EMPLOYEE]: {
    canReadAllEmployees: false,
    canWriteEmployees: false,
    canChangeEmployeeStatus: false,
    canDeleteEmployees: false,
    canReadAllRequests: false,
    canWriteRequests: true,
    canApproveRequests: false,
    canEscalateRequests: false,
    canManageRecruitment: false,
    canManageOrgStructure: false,
    canViewAuditLogs: false,
    canManageRoles: false,
    canViewOwnApplications: false,
    departmentScoped: true,
  },
  [CVISION_ROLES.CANDIDATE]: {
    canReadAllEmployees: false,
    canWriteEmployees: false,
    canChangeEmployeeStatus: false,
    canDeleteEmployees: false,
    canReadAllRequests: false,
    canWriteRequests: false,
    canApproveRequests: false,
    canEscalateRequests: false,
    canManageRecruitment: false,
    canManageOrgStructure: false,
    canViewAuditLogs: false,
    canManageRoles: false,
    canViewOwnApplications: true, // Can see own application status
    departmentScoped: true,
  },
  [CVISION_ROLES.AUDITOR]: {
    canReadAllEmployees: true,
    canWriteEmployees: false,
    canChangeEmployeeStatus: false,
    canDeleteEmployees: false,
    canReadAllRequests: true,
    canWriteRequests: false,
    canApproveRequests: false,
    canEscalateRequests: false,
    canManageRecruitment: false,
    canManageOrgStructure: false,
    canViewAuditLogs: true,
    canManageRoles: false,
    canViewOwnApplications: false,
    departmentScoped: false,
  },
};

/**
 * Get capabilities for a role
 */
export function getRoleCapabilities(role: string): RoleCapabilities {
  const norm = normalizeRole(role);
  return ROLE_CAPABILITIES[norm as CVisionRole] ?? ROLE_CAPABILITIES[role as CVisionRole] ?? ROLE_CAPABILITIES[CVISION_ROLES.EMPLOYEE];
}

// =============================================================================
// Role Mapping from Platform Roles
// =============================================================================

/**
 * Map platform roles to CVision roles
 * This allows using existing platform roles with CVision
 */
export const PLATFORM_TO_CVISION_ROLE: Record<string, CVisionRole> = {
  'thea-owner': CVISION_ROLES.CVISION_ADMIN,
  'admin': CVISION_ROLES.CVISION_ADMIN,
  'group-admin': CVISION_ROLES.HR_ADMIN,
  'hospital-admin': CVISION_ROLES.HR_ADMIN,
  'hr-manager': CVISION_ROLES.HR_MANAGER,
  'hr-admin': CVISION_ROLES.HR_ADMIN,
  'supervisor': CVISION_ROLES.HR_MANAGER,
  'manager': CVISION_ROLES.MANAGER,
  'staff': CVISION_ROLES.EMPLOYEE,
  'viewer': CVISION_ROLES.AUDITOR,
  'candidate': CVISION_ROLES.CANDIDATE,
};

/**
 * Get CVision role from platform role
 */
export function getCVisionRole(platformRole: string): CVisionRole {
  return PLATFORM_TO_CVISION_ROLE[platformRole] ?? PLATFORM_TO_CVISION_ROLE[normalizeRole(platformRole)] ?? CVISION_ROLES.EMPLOYEE;
}

/**
 * Check if user has minimum access level
 */
export function hasMinimumRole(userRole: string, requiredRole: CVisionRole): boolean {
  const norm = normalizeRole(userRole);
  const userLevel = ROLE_HIERARCHY[norm as CVisionRole] ?? ROLE_HIERARCHY[userRole as CVisionRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}
