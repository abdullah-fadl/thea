/**
 * System Permissions Configuration
 *
 * Defines all available permissions for pages/modules in the system
 */

// Re-export types
export type { Permission } from './types';

// Re-export definitions
export { PERMISSIONS } from './definitions';

// Re-export route permissions
export { ROUTE_PERMISSIONS } from './routes';

// Re-export defaults
export { getDefaultPermissionsForRole, expandGroupedPermissions } from './defaults';

// ── Utility functions ──

import type { Permission } from './types';
import { PERMISSIONS } from './definitions';
import { ROUTE_PERMISSIONS } from './routes';

/**
 * Check if user has permission for a route
 * SECURITY: If route is not in map, DENY access (no backward compatibility)
 */
export function hasRoutePermission(userPermissions: string[], route: string): boolean {
  // Admin always has access (users with admin.users permission)
  if (userPermissions.includes('admin.users')) {
    return true;
  }

  const requiredPermission = ROUTE_PERMISSIONS[route];
  if (!requiredPermission) {
    // SECURITY: If route not in map, DENY access (fail secure)
    // This prevents unauthorized access to new routes that haven't been added to the map yet
    return false;
  }

  // User list: allow view or change-password-only (e.g. IT role)
  if (route === '/admin/users' && requiredPermission === 'admin.users.view') {
    return userPermissions.includes('admin.users.view') || userPermissions.includes('admin.users.changePassword');
  }

  // Clinical Infrastructure: allow System Admin or dedicated Clinical Infrastructure permission
  if (route === '/admin/clinical-infra' || route.startsWith('/admin/clinical-infra/')) {
    return userPermissions.includes('admin.data-admin.view') || userPermissions.includes('admin.clinical-infra.view');
  }

  // Scheduling: allow scheduling.view, scheduling.availability.view, or dedicated admin.scheduling.view
  if (route === '/scheduling' || route.startsWith('/scheduling/')) {
    return (
      userPermissions.includes('scheduling.view') ||
      userPermissions.includes('scheduling.availability.view') ||
      userPermissions.includes('admin.scheduling.view')
    );
  }

  return userPermissions.includes(requiredPermission);
}

/**
 * Get permissions grouped by category
 */
export function getPermissionsByCategory(): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};

  PERMISSIONS.forEach(permission => {
    if (!grouped[permission.category]) {
      grouped[permission.category] = [];
    }
    grouped[permission.category].push(permission);
  });

  return grouped;
}

/**
 * Merge visible (UI-editable) permissions with invisible (API-only) ones.
 * Prevents admin UI from accidentally stripping permissions that are
 * not shown in the Edit-User dialog.
 */
export function getMergedPermissions(
  editedPermissions: string[],
  originalPermissions: string[],
  visibleCategories: Record<string, Permission[]>,
): string[] {
  const visibleKeys = new Set(
    Object.values(visibleCategories).flat().map((p) => p.key),
  );
  const invisible = originalPermissions.filter((k) => !visibleKeys.has(k));
  return [...new Set([...editedPermissions, ...invisible])];
}
