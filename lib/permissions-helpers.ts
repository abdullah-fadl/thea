/**
 * Permission Helper Functions
 * 
 * Server-side functions for checking user permissions
 */

import { User } from '@/lib/models/User';
import { hasRoutePermission } from './permissions';

/**
 * Check if a user can access the main Dashboard
 * 
 * @param user - User object with permissions array
 * @returns true if user has dashboard.view permission, false otherwise
 */
export function canAccessMainDashboard(user: User | { permissions?: string[] }): boolean {
  const permissions = user.permissions || [];
  return hasRoutePermission(permissions, '/dashboard');
}

