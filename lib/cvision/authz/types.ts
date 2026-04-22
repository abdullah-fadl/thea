/**
 * CVision Authorization Types
 * 
 * Type definitions for authorization context (client-safe, no MongoDB dependencies)
 */

export interface AuthzContext {
  tenantId: string;
  userId: string;
  roles: string[];
  /** Primary CVision role (derived from platform role) */
  cvisionRole: string;
  employeeId?: string;
  departmentIds: string[];
  branchIds?: string[];
  employeeStatus?: string;
  /** Platform superuser - bypasses all RBAC/ABAC checks (when enabled via env) */
  isOwner?: boolean;
}
