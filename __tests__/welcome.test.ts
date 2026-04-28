/**
 * Welcome Page & Dashboard Access Tests
 * 
 * Tests for:
 * - canAccessMainDashboard function
 * - Navigation module filtering
 * - Welcome page behavior
 * 
 * Note: These are unit tests for the helper functions.
 * Integration tests for the actual pages would require a test setup.
 */

import { canAccessMainDashboard } from '@/lib/permissions-helpers';
import { getAccessibleModules } from '@/lib/navigation';
import { User } from '@/lib/models/User';

describe('canAccessMainDashboard', () => {
  it('should return true for user with dashboard.view permission', () => {
    const user: Partial<User> = {
      permissions: ['dashboard.view'],
    };
    expect(canAccessMainDashboard(user as User)).toBe(true);
  });

  it('should return true for admin user with admin.users permission', () => {
    const user: Partial<User> = {
      permissions: ['admin.users'],
    };
    expect(canAccessMainDashboard(user as User)).toBe(true);
  });

  it('should return false for user without dashboard.view permission', () => {
    const user: Partial<User> = {
      permissions: ['opd.dashboard.view', 'policies.view'],
    };
    expect(canAccessMainDashboard(user as User)).toBe(false);
  });

  it('should return false for user with empty permissions', () => {
    const user: Partial<User> = {
      permissions: [],
    };
    expect(canAccessMainDashboard(user as User)).toBe(false);
  });

  it('should return false for user without permissions array', () => {
    const user: Partial<User> = {};
    expect(canAccessMainDashboard(user as User)).toBe(false);
  });
});

describe('getAccessibleModules', () => {
  it('should return all modules for admin user with admin.users permission', () => {
    const permissions = ['admin.users'];
    const modules = getAccessibleModules(permissions);
    // Admin should have access to all modules
    expect(modules.length).toBeGreaterThan(0);
    // Check that all modules are included
    const allModuleIds = modules.map(m => m.id);
    expect(allModuleIds).toContain('dashboard');
    expect(allModuleIds).toContain('account');
  });

  it('should return only permitted modules for regular user', () => {
    const permissions = ['account.view'];
    const modules = getAccessibleModules(permissions);

    // Should include account
    const moduleIds = modules.map(m => m.id);
    expect(moduleIds).toContain('account');

    // Should not include dashboard (if not permitted)
    if (!permissions.includes('dashboard.view') && !permissions.includes('admin.users')) {
      expect(moduleIds).not.toContain('dashboard');
    }
  });

  it('should return empty array for user with no permissions', () => {
    const permissions: string[] = [];
    const modules = getAccessibleModules(permissions);
    expect(modules).toEqual([]);
  });

  it('should filter modules correctly based on required permissions', () => {
    const permissions = ['opd.dashboard.view', 'account.view'];
    const modules = getAccessibleModules(permissions);

    const moduleIds = modules.map(m => m.id);
    expect(moduleIds).toContain('opd-home');
    expect(moduleIds).toContain('account');

    // Should not include modules requiring other permissions
    if (!permissions.includes('er.register.view')) {
      expect(moduleIds).not.toContain('er-register');
    }
  });
});

