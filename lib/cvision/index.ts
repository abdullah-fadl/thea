/**
 * CVision (HR OS) - Module Index
 * 
 * Re-exports all CVision types, constants, and utilities.
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Paths
export * from './paths';

// Validation Schemas
export * from './validation';

// Database Helpers
export * from './db';

// Audit Logging
export * from './audit';

// Auth Helpers (excluding duplicates from policy)
export {
  withAuthTenant,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  canViewCVision,
  canManageEmployees,
  // Note: canChangeEmployeeStatus and canManageRecruitment are exported from policy.ts
} from './auth';

// Tenant Helpers
export * from './tenant';

// Roles (excluding duplicates from types)
export {
  CVISION_ROLES,
  HR_SPECIALIST,
  ROLE_HIERARCHY,
  hasEqualOrHigherRole,
  isAdminRole,
  isHRRole,
  hasTenantWideAccess,
  isCandidateRole,
  ROLE_CAPABILITIES,
  getRoleCapabilities,
  PLATFORM_TO_CVISION_ROLE,
  getCVisionRole,
  hasMinimumRole,
} from './roles';
export type { RoleCapabilities } from './roles';

// Policy (ABAC)
export * from './policy';

// Middleware
export * from './middleware';

// Auth Risk Scoring
export * from './auth-risk';

// Feature Flags
export * from './featureFlags';
