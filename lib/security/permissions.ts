/**
 * Permission-based Authorization
 * 
 * Provides functions to check user permissions for specific operations
 * This is the core of the permission system - all permission checks should go through here
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from './auth';
import { ROUTE_PERMISSIONS, PERMISSIONS } from '@/lib/permissions';
import { logger } from '@/lib/monitoring/logger';

/**
 * Require specific permission(s)
 * Returns authenticated user context or 403 response
 * 
 * @param request - NextRequest object
 * @param requiredPermission - Single permission key or array of permission keys (user needs at least one)
 * @param authResult - Optional pre-authenticated result (to avoid double auth check)
 */
export async function requirePermission(
  request: NextRequest,
  requiredPermission: string | string[],
  authResult?: AuthenticatedUser | NextResponse
): Promise<AuthenticatedUser | NextResponse> {
  // Use provided auth result if available, otherwise authenticate
  const auth = authResult || await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Permission auth failed', { category: 'auth', status: auth.status });
    }
    return auth; // Already an error response
  }

  const userPermissions = auth.user.permissions || [];
  const permissionsArray = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  
  // Check if user has at least one of the required permissions
  const hasPermission = permissionsArray.some(perm => userPermissions.includes(perm));
  
  // Admin users (with admin.users permission) have access to everything
  const isAdmin = userPermissions.includes('admin.users');
  
  if (!hasPermission && !isAdmin) {
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Permission check failed', { category: 'auth', userId: auth.userId, required: permissionsArray.join(' or '), userPermissions: userPermissions.join(', ') });
    }
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: `Insufficient permissions. Required: ${permissionsArray.join(' or ')}` 
      },
      { status: 403 }
    );
  }

  if (process.env.DEBUG_AUTH === '1') {
    logger.debug('Permission check passed', { category: 'auth', userId: auth.userId, permission: permissionsArray.join(' or ') });
  }

  return auth;
}

/**
 * Require permission for a specific route
 * Maps route to permission using ROUTE_PERMISSIONS
 * 
 * @param request - NextRequest object
 * @param route - Route path (e.g., '/dashboard', '/patient-experience/visits')
 * @param authResult - Optional pre-authenticated result (to avoid double auth check)
 */
export async function requireRoutePermission(
  request: NextRequest,
  route: string,
  authResult?: AuthenticatedUser | NextResponse
): Promise<AuthenticatedUser | NextResponse> {
  const requiredPermission = ROUTE_PERMISSIONS[route];
  
  if (!requiredPermission) {
    // If route not in map, deny access (fail secure)
    if (process.env.DEBUG_AUTH === '1') {
      logger.error('Route not in permission map', { category: 'auth', route });
    }
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: `Route ${route} is not configured in the permission system` 
      },
      { status: 403 }
    );
  }
  
  return requirePermission(request, requiredPermission, authResult);
}

/**
 * Check if user has a specific permission
 * Non-blocking check (doesn't return error response)
 * 
 * @param userPermissions - Array of user permission keys
 * @param permission - Permission key to check
 * @returns true if user has permission, false otherwise
 */
export function hasPermission(userPermissions: string[], permission: string): boolean {
  // Admin users have all permissions
  if (userPermissions.includes('admin.users')) {
    return true;
  }
  
  return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 * Non-blocking check (doesn't return error response)
 * 
 * @param userPermissions - Array of user permission keys
 * @param permissions - Array of permission keys to check
 * @returns true if user has at least one permission, false otherwise
 */
export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  // Admin users have all permissions
  if (userPermissions.includes('admin.users')) {
    return true;
  }
  
  return permissions.some(perm => userPermissions.includes(perm));
}

/**
 * Check if user has all of the specified permissions
 * Non-blocking check (doesn't return error response)
 * 
 * @param userPermissions - Array of user permission keys
 * @param permissions - Array of permission keys to check
 * @returns true if user has all permissions, false otherwise
 */
export function hasAllPermissions(userPermissions: string[], permissions: string[]): boolean {
  // Admin users have all permissions
  if (userPermissions.includes('admin.users')) {
    return true;
  }
  
  return permissions.every(perm => userPermissions.includes(perm));
}

/**
 * Get all permissions for a specific category
 * 
 * @param category - Category name (e.g., 'OPD', 'ER', 'Patient Experience')
 * @returns Array of permission keys for that category
 */
export function getPermissionsByCategory(category: string): string[] {
  return PERMISSIONS
    .filter(p => p.category === category)
    .map(p => p.key);
}

