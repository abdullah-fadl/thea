/**
 * Data Scope Model
 * 
 * Defines data access scopes for authorization:
 * - ALL_TENANT: Access to all tenant data
 * - DEPARTMENT_ONLY: Access limited to specific departments
 * - UNIT_ONLY: Access limited to specific units
 * - SELF_ONLY: Access only to own data
 */

export type DataScope = 'ALL_TENANT' | 'DEPARTMENT_ONLY' | 'UNIT_ONLY' | 'SELF_ONLY';

export interface DataScopeConfig {
  scope: DataScope;
  departmentIds?: string[]; // For DEPARTMENT_ONLY
  unitIds?: string[]; // For UNIT_ONLY
  userId?: string; // For SELF_ONLY
}

/**
 * Check if a data scope allows access to a resource
 */
export function checkDataScope(
  userScope: DataScopeConfig,
  resourceTenantId: string,
  resourceDepartmentId?: string,
  resourceUnitId?: string,
  resourceUserId?: string,
  userTenantId?: string,
  userDepartmentIds?: string[],
  userUnitIds?: string[],
  userId?: string
): boolean {
  // Tenant isolation is always enforced
  if (userTenantId && resourceTenantId !== userTenantId) {
    return false;
  }
  
  switch (userScope.scope) {
    case 'ALL_TENANT':
      return true;
    
    case 'DEPARTMENT_ONLY':
      if (!resourceDepartmentId || !userScope.departmentIds) {
        return false;
      }
      return userScope.departmentIds.includes(resourceDepartmentId);
    
    case 'UNIT_ONLY':
      if (!resourceUnitId || !userScope.unitIds) {
        return false;
      }
      return userScope.unitIds.includes(resourceUnitId);
    
    case 'SELF_ONLY':
      if (!resourceUserId || !userScope.userId) {
        return false;
      }
      return resourceUserId === userScope.userId;
    
    default:
      return false;
  }
}
