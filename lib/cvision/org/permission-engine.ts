/**
 * CVision Manager Permission Engine
 *
 * Resolves what a user can see and do based on their role and position in
 * the org hierarchy. Provides filtering functions that API routes call to
 * scope queries appropriately.
 *
 * Access hierarchy:
 *   OWNER / CVISION_ADMIN / HR_ADMIN / HR_MANAGER / AUDITOR → tenant-wide
 *   MANAGER → direct + indirect reports
 *   EMPLOYEE → self only
 */

import { getCVisionCollection } from '@/lib/cvision/db';
import type { CVisionEmployee } from '@/lib/cvision/types';
import { CVISION_ROLES, hasTenantWideAccess, getRoleCapabilities } from '@/lib/cvision/roles';
import type { AuthzContext } from '@/lib/cvision/authz/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManagerScope {
  managerId: string;
  managerName: string;
  role: string;
  directReports: string[];
  allReports: string[];
  departments: string[];
  branches: string[];
  canViewAllEmployees: boolean;
  canEditAllEmployees: boolean;
  canApproveLeaves: boolean;
  canReviewPerformance: boolean;
  canViewPayroll: boolean;
  canViewReports: boolean;
  canManageRecruitment: boolean;
}

// In-memory cache: userId → { scope, timestamp }
const scopeCache = new Map<string, { scope: ManagerScope; ts: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// Core: build manager scope
// ---------------------------------------------------------------------------

export async function getManagerScope(
  tenantId: string,
  userId: string,
  employeeId?: string,
  cvisionRole?: string,
): Promise<ManagerScope> {
  const cacheKey = `${tenantId}:${userId}`;
  const cached = scopeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.scope;
  }

  const role = cvisionRole || CVISION_ROLES.EMPLOYEE;
  const caps = getRoleCapabilities(role);
  const isWide = hasTenantWideAccess(role);

  // For admin/HR/auditor: full access
  if (isWide) {
    const scope: ManagerScope = {
      managerId: employeeId || userId,
      managerName: '',
      role,
      directReports: [],
      allReports: [],
      departments: [],
      branches: [],
      canViewAllEmployees: true,
      canEditAllEmployees: caps.canWriteEmployees,
      canApproveLeaves: caps.canApproveRequests,
      canReviewPerformance: true,
      canViewPayroll: caps.canReadAllEmployees,
      canViewReports: true,
      canManageRecruitment: caps.canManageRecruitment,
    };
    scopeCache.set(cacheKey, { scope, ts: Date.now() });
    return scope;
  }

  // For MANAGER / EMPLOYEE: resolve org tree
  const empColl = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  const allEmps = await empColl.find({
    tenantId,
    isArchived: { $ne: true },
  } as Record<string, unknown>).toArray();

  // Find this user's employee record
  let myEmp: CVisionEmployee | undefined;
  if (employeeId) {
    myEmp = allEmps.find(e => e.id === employeeId);
  }
  if (!myEmp) {
    myEmp = allEmps.find(e => e.userId === userId);
  }

  const myId = myEmp?.id || '';
  const myName = myEmp ? `${myEmp.firstName} ${myEmp.lastName}`.trim() : '';

  // Build children map
  const childrenOf = new Map<string, string[]>();
  for (const emp of allEmps) {
    if (emp.managerEmployeeId) {
      const arr = childrenOf.get(emp.managerEmployeeId) || [];
      arr.push(emp.id);
      childrenOf.set(emp.managerEmployeeId, arr);
    }
  }

  // Collect all reports (BFS)
  const directReports = childrenOf.get(myId) || [];
  const allReports: string[] = [];
  const queue = [...directReports];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    allReports.push(cur);
    const kids = childrenOf.get(cur) || [];
    queue.push(...kids);
  }

  // Departments and branches from reports
  const deptSet = new Set<string>();
  const branchSet = new Set<string>();
  for (const rid of allReports) {
    const emp = allEmps.find(e => e.id === rid);
    if (emp?.departmentId) deptSet.add(emp.departmentId);
    if ((emp as any)?.branchId) branchSet.add((emp as any).branchId);
  }
  if (myEmp?.departmentId) deptSet.add(myEmp.departmentId);
  if ((myEmp as any)?.branchId) branchSet.add((myEmp as any).branchId);

  const isManager = role === CVISION_ROLES.MANAGER || directReports.length > 0;

  const scope: ManagerScope = {
    managerId: myId,
    managerName: myName,
    role,
    directReports,
    allReports,
    departments: Array.from(deptSet),
    branches: Array.from(branchSet),
    canViewAllEmployees: false,
    canEditAllEmployees: false,
    canApproveLeaves: isManager,
    canReviewPerformance: isManager,
    canViewPayroll: false,
    canViewReports: isManager,
    canManageRecruitment: false,
  };

  scopeCache.set(cacheKey, { scope, ts: Date.now() });
  return scope;
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Returns a MongoDB filter condition to restrict employee queries.
 * Admin/HR roles: null (no filter needed — see everything).
 * Manager: { id: { $in: [...selfAndReports] } }
 * Employee: { id: selfEmployeeId }
 */
export async function getEmployeeScopeFilter(
  tenantId: string,
  userId: string,
  employeeId?: string,
  cvisionRole?: string,
): Promise<Record<string, any> | null> {
  const scope = await getManagerScope(tenantId, userId, employeeId, cvisionRole);

  if (scope.canViewAllEmployees) return null;

  // Manager with reports → self + all reports
  if (scope.allReports.length > 0) {
    const ids = [scope.managerId, ...scope.allReports].filter(Boolean);
    return { id: { $in: ids } };
  }

  // Employee → self only
  if (scope.managerId) {
    return { id: scope.managerId };
  }

  // Fallback: block all (shouldn't reach here)
  return { id: '__blocked__' };
}

/**
 * Convenience: filter an in-memory array of employees.
 */
export async function filterEmployeesByScope(
  tenantId: string,
  userId: string,
  employees: any[],
  employeeId?: string,
  cvisionRole?: string,
): Promise<any[]> {
  const scope = await getManagerScope(tenantId, userId, employeeId, cvisionRole);
  if (scope.canViewAllEmployees) return employees;

  const allowedIds = new Set([scope.managerId, ...scope.allReports].filter(Boolean));
  return employees.filter(e => allowedIds.has(e.id));
}

/**
 * Check if a specific user can access a specific employee's data.
 */
export async function canAccessEmployee(
  tenantId: string,
  userId: string,
  targetEmployeeId: string,
  employeeId?: string,
  cvisionRole?: string,
): Promise<boolean> {
  const scope = await getManagerScope(tenantId, userId, employeeId, cvisionRole);
  if (scope.canViewAllEmployees) return true;
  if (scope.managerId === targetEmployeeId) return true;
  return scope.allReports.includes(targetEmployeeId);
}

/**
 * Invalidate cache for a specific user (call after org changes).
 */
export function invalidateScopeCache(tenantId: string, userId?: string) {
  if (userId) {
    scopeCache.delete(`${tenantId}:${userId}`);
  } else {
    for (const key of scopeCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) scopeCache.delete(key);
    }
  }
}
