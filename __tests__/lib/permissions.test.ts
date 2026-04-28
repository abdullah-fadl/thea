import { describe, it, expect } from 'vitest'
import {
  hasRoutePermission,
  getPermissionsByCategory,
  getDefaultPermissionsForRole,
  PERMISSIONS,
  ROUTE_PERMISSIONS,
  getMergedPermissions,
} from '@/lib/permissions'

describe('hasRoutePermission()', () => {
  // ─── Positive cases ───────────────────────────────────────

  it('returns true when user has the required permission', () => {
    expect(hasRoutePermission(['dashboard.view'], '/dashboard')).toBe(true)
  })

  it('returns true for ER board with er.board.view permission', () => {
    expect(hasRoutePermission(['er.board.view'], '/er/board')).toBe(true)
  })

  it('returns true for admin users with admin.users.view permission', () => {
    expect(hasRoutePermission(['admin.users.view'], '/admin/users')).toBe(true)
  })

  // ─── Admin bypass ─────────────────────────────────────────

  it('admin.users permission grants access to any mapped route', () => {
    expect(hasRoutePermission(['admin.users'], '/dashboard')).toBe(true)
    expect(hasRoutePermission(['admin.users'], '/er/board')).toBe(true)
    expect(hasRoutePermission(['admin.users'], '/account')).toBe(true)
  })

  // ─── Negative cases ───────────────────────────────────────

  it('returns false when user lacks the required permission', () => {
    expect(hasRoutePermission(['dashboard.view'], '/er/board')).toBe(false)
  })

  it('returns false for an empty permissions array', () => {
    expect(hasRoutePermission([], '/dashboard')).toBe(false)
  })

  // ─── Unmapped routes → deny (fail secure) ─────────────────

  it('returns false for routes not in the ROUTE_PERMISSIONS map', () => {
    expect(hasRoutePermission(['dashboard.view'], '/unknown-route')).toBe(false)
  })

  it('returns false for undefined route without admin bypass', () => {
    expect(hasRoutePermission(['some.perm'], '/totally-new-page')).toBe(false)
  })

  // ─── OPD routes ───────────────────────────────────────────

  it('OPD dashboard requires opd.dashboard.view', () => {
    expect(hasRoutePermission(['opd.dashboard.view'], '/opd/dashboard')).toBe(true)
    expect(hasRoutePermission(['dashboard.view'], '/opd/dashboard')).toBe(false)
  })

  it('visit registration requires opd.visit.create', () => {
    expect(hasRoutePermission(['opd.visit.create'], '/opd/registration')).toBe(true)
    expect(hasRoutePermission(['opd.visit.view'], '/opd/registration')).toBe(false)
  })
})

describe('getPermissionsByCategory()', () => {
  const grouped = getPermissionsByCategory()

  it('groups permissions by category', () => {
    expect(grouped).toHaveProperty('Dashboard')
    expect(grouped).toHaveProperty('ER')
    expect(grouped).toHaveProperty('Admin')
    expect(grouped).toHaveProperty('Account')
  })

  it('Dashboard category contains dashboard.view', () => {
    const dashboardPerms = grouped['Dashboard']
    expect(dashboardPerms.some(p => p.key === 'dashboard.view')).toBe(true)
  })

  it('all permissions are assigned to a category', () => {
    const totalGrouped = Object.values(grouped).flat().length
    expect(totalGrouped).toBe(PERMISSIONS.length)
  })
})

describe('getDefaultPermissionsForRole()', () => {
  // ─── Admin role ───────────────────────────────────────────

  it('admin role gets all permissions', () => {
    const perms = getDefaultPermissionsForRole('admin')
    // Admin should have at least as many as the PERMISSIONS array
    expect(perms.length).toBeGreaterThanOrEqual(PERMISSIONS.length)
  })

  // ─── Staff role ───────────────────────────────────────────

  it('staff role gets dashboard.view and account.view', () => {
    const perms = getDefaultPermissionsForRole('staff')
    expect(perms).toContain('dashboard.view')
    expect(perms).toContain('account.view')
  })

  it('staff role does NOT get admin permissions', () => {
    const perms = getDefaultPermissionsForRole('staff')
    expect(perms).not.toContain('admin.users.view')
    expect(perms).not.toContain('er.board.view')
  })

  // ─── Viewer role ──────────────────────────────────────────

  it('viewer role gets minimal permissions', () => {
    const perms = getDefaultPermissionsForRole('viewer')
    expect(perms).toContain('dashboard.view')
    expect(perms).toContain('policies.view')
    expect(perms).toContain('account.view')
    expect(perms).not.toContain('admin.users.view')
  })

  // ─── Group expansion ──────────────────────────────────────

  it('supervisor gets expanded ER permissions from er.nursing.view', () => {
    const perms = getDefaultPermissionsForRole('supervisor')
    expect(perms).toContain('er.nursing.view')
    expect(perms).toContain('er.nursing.edit') // expanded from group
  })

  it('er-nurse gets triage edit from triage view group', () => {
    const perms = getDefaultPermissionsForRole('er-nurse')
    expect(perms).toContain('er.triage.view')
    expect(perms).toContain('er.triage.edit')
  })

  it('er-doctor gets disposition update from doctor view group', () => {
    const perms = getDefaultPermissionsForRole('er-doctor')
    expect(perms).toContain('er.doctor.view')
    expect(perms).toContain('er.disposition.update')
  })

  it('opd-nurse gets nursing edit and flow from nursing view', () => {
    const perms = getDefaultPermissionsForRole('opd-nurse')
    expect(perms).toContain('opd.nursing.view')
    expect(perms).toContain('opd.nursing.edit')
    expect(perms).toContain('opd.nursing.flow')
  })

  it('opd-reception gets scheduling expansion from scheduling.create', () => {
    const perms = getDefaultPermissionsForRole('opd-reception')
    expect(perms).toContain('scheduling.create')
    expect(perms).toContain('scheduling.edit')
    expect(perms).toContain('scheduling.delete')
  })

  // ─── Notifications expansion ──────────────────────────────

  it('clinical roles automatically get notifications.view', () => {
    const erNurse = getDefaultPermissionsForRole('er-nurse')
    expect(erNurse).toContain('notifications.view')

    const opdDoctor = getDefaultPermissionsForRole('opd-doctor')
    expect(opdDoctor).toContain('notifications.view')
  })

  // ─── Unknown role ─────────────────────────────────────────

  it('returns empty array for unknown role', () => {
    const perms = getDefaultPermissionsForRole('nonexistent-role')
    expect(perms).toEqual([])
  })
})

describe('getMergedPermissions()', () => {
  it('preserves invisible permissions from original set', () => {
    const visibleCategories = {
      Dashboard: [{ key: 'dashboard.view', label: 'View', category: 'Dashboard' }],
    }
    const original = ['dashboard.view', 'hidden.perm.1', 'hidden.perm.2']
    const edited = ['dashboard.view']

    const merged = getMergedPermissions(edited, original, visibleCategories)
    expect(merged).toContain('dashboard.view')
    expect(merged).toContain('hidden.perm.1')
    expect(merged).toContain('hidden.perm.2')
  })

  it('adds new visible permissions', () => {
    const visibleCategories = {
      Dashboard: [
        { key: 'dashboard.view', label: 'View', category: 'Dashboard' },
        { key: 'notifications.view', label: 'Notifs', category: 'Dashboard' },
      ],
    }
    const original = ['dashboard.view']
    const edited = ['dashboard.view', 'notifications.view']

    const merged = getMergedPermissions(edited, original, visibleCategories)
    expect(merged).toContain('notifications.view')
  })

  it('deduplicates merged permissions', () => {
    const visibleCategories = {
      D: [{ key: 'a', label: 'A', category: 'D' }],
    }
    const merged = getMergedPermissions(['a', 'a'], ['a', 'b'], visibleCategories)
    const aCount = merged.filter(p => p === 'a').length
    expect(aCount).toBe(1)
  })
})

describe('ROUTE_PERMISSIONS mapping', () => {
  it('has entries for dashboard', () => {
    expect(ROUTE_PERMISSIONS['/dashboard']).toBe('dashboard.view')
  })

  it('has entries for account', () => {
    expect(ROUTE_PERMISSIONS['/account']).toBe('account.view')
  })

  it('all mapped permission keys exist in PERMISSIONS', () => {
    const allPermKeys = new Set(PERMISSIONS.map(p => p.key))
    for (const [route, permKey] of Object.entries(ROUTE_PERMISSIONS)) {
      expect(allPermKeys.has(permKey), `Route ${route} maps to ${permKey} which is not in PERMISSIONS`).toBe(true)
    }
  })
})
