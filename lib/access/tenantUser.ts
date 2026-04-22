import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { logger } from '@/lib/monitoring/logger';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const AREA_KEYS = [
  'ER',
  'OPD',
  'IPD',
  'ORDERS',
  'BILLING',
  'REGISTRATION',
  'MORTUARY',
  'RESULTS',
  'HANDOVER',
  'TASKS',
  'NOTIFICATIONS',
] as const;

export type AreaKey = typeof AREA_KEYS[number];

export function normalizeRoles(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((r: any) => String(r || '').trim().toLowerCase()).filter(Boolean)));
}

export function normalizeAreas(input: any): AreaKey[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((a: any) => String(a || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((a: string) => AREA_KEYS.includes(a as AreaKey));
  return Array.from(new Set(normalized)) as AreaKey[];
}

export function normalizeDepartments(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((d: any) => String(d || '').trim()).filter(Boolean)));
}


function deriveRolesFromUserRole(role: string): string[] {
  const normalized = String(role || '').trim().toLowerCase();
  const roles = new Set<string>();
  if (!normalized) return [];

  if (normalized.includes('admin')) roles.add('admin');
  if (normalized.includes('dev')) roles.add('dev');
  if (normalized.includes('charge')) roles.add('charge');
  if (normalized.includes('nurse')) roles.add('nurse');
  if (normalized.includes('doctor') || normalized.includes('consultant')) roles.add('doctor');
  if (normalized.includes('reception') || normalized.includes('front')) {
    roles.add('reception');
    roles.add('front_desk');
  }
  if (normalized.includes('finance') || normalized.includes('billing')) roles.add('finance');
  if (normalized.includes('orders')) roles.add('orders');
  if (normalized.includes('security')) roles.add('security');
  if (normalized === 'staff') roles.add('staff');

  return Array.from(roles);
}

function deriveAreasFromPermissions(permissions: string[]): AreaKey[] {
  const areas = new Set<AreaKey>();
  for (const permission of permissions) {
    if (permission.startsWith('er.')) areas.add('ER');
    else if (permission.startsWith('opd.')) areas.add('OPD');
    else if (permission.startsWith('ipd.')) areas.add('IPD');
    else if (permission.startsWith('orders.')) areas.add('ORDERS');
    else if (permission.startsWith('billing.')) areas.add('BILLING');
    else if (
      permission.startsWith('registration.') ||
      permission.startsWith('patients.') ||
      permission.startsWith('encounters.')
    ) {
      areas.add('REGISTRATION');
    } else if (permission.startsWith('results.')) areas.add('RESULTS');
    else if (permission.startsWith('tasks.')) areas.add('TASKS');
    else if (permission.startsWith('handover.')) areas.add('HANDOVER');
    else if (permission.startsWith('notifications.')) areas.add('NOTIFICATIONS');
    else if (permission.startsWith('mortuary.')) areas.add('MORTUARY');
  }
  return Array.from(areas);
}

/**
 * Resolve tenant UUID from tenantId key string or UUID.
 * Auth flow passes UUID (Tenant.id); some callers pass key (Tenant.tenantId).
 */
async function resolveTenantUuid(tenantId: string): Promise<string | null> {
  if (!tenantId) return null;
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantId),
    select: { id: true },
  });
  return tenant?.id || null;
}

export async function resolveTenantUser(args: {
  tenantId: string;
  userId: string;
  user: any;
}): Promise<{ tenantUser: any } | NextResponse> {
  const { tenantId, userId, user } = args;

  // Resolve tenant UUID for query
  const tenantUuid = await resolveTenantUuid(tenantId);
  if (!tenantUuid) {
    // Fallback — create an in-memory tenant user
    const role = String(user?.role || '').trim().toLowerCase();
    if (role) {
      const derivedAreas = deriveAreasFromPermissions(getDefaultPermissionsForRole(role));
      const derivedRoles = deriveRolesFromUserRole(role);
      return {
        tenantUser: {
          tenantId,
          userId,
          displayName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: user?.email || '',
          roles: derivedRoles,
          areas: derivedAreas,
          departments: [],
          isActive: true,
        },
      };
    }
    return NextResponse.json(
      { error: 'Forbidden', code: 'ACCESS_DENIED', area: 'SYSTEM', reason: 'TENANT_NOT_FOUND' },
      { status: 403 }
    );
  }

  const tenantUser = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: tenantUuid, userId } },
  });

  if (!tenantUser) {
    const role = String(user?.role || '').trim().toLowerCase();
    if (role) {
      let permissions = getDefaultPermissionsForRole(role);
      try {
        const override = await prisma.roleDefinition.findFirst({
          where: { tenantId: tenantUuid, key: role },
          select: { permissions: true },
        });
        if (override && Array.isArray(override.permissions)) {
          permissions = override.permissions;
        }
      } catch {
        // Use defaults if role definitions are unavailable
      }
      const derivedAreas = deriveAreasFromPermissions(permissions);
      const derivedRoles = deriveRolesFromUserRole(role);
      const now = new Date();
      const fallbackTenantUser = {
        tenantId: tenantUuid,
        userId,
        displayName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        email: user?.email || '',
        roles: derivedRoles,
        areas: derivedAreas as string[],
        departments: [] as string[],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await prisma.tenantUser.create({ data: fallbackTenantUser });
      } catch {
        // Best effort only; still return fallback payload
      }
      return { tenantUser: fallbackTenantUser };
    }
    return NextResponse.json(
      { error: 'Forbidden', code: 'ACCESS_DENIED', area: 'SYSTEM', reason: 'TENANT_USER_MISSING' },
      { status: 403 }
    );
  }
  if (tenantUser.isActive === false) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'ACCESS_DENIED', area: 'SYSTEM', reason: 'TENANT_USER_DISABLED' },
      { status: 403 }
    );
  }

  // Proactive self-heal: if tenant_user has empty/stale areas, re-derive from current permissions
  const currentAreas = normalizeAreas(tenantUser.areas);
  if (currentAreas.length === 0) {
    try {
      const role = String(user?.role || '').trim().toLowerCase();
      let permissions: string[] = [];

      const override = await prisma.roleDefinition.findFirst({
        where: { tenantId: tenantUuid, key: role },
        select: { permissions: true },
      });
      if (override && Array.isArray(override.permissions)) {
        permissions = override.permissions;
      } else {
        permissions = getDefaultPermissionsForRole(role);
      }

      if (permissions.length > 0) {
        const freshAreas = deriveAreasFromPermissions(permissions);
        const freshRoles = deriveRolesFromUserRole(role);
        const mergedRoles = Array.from(new Set([...normalizeRoles(tenantUser.roles), ...freshRoles]));

        if (freshAreas.length > 0) {
          try {
            await prisma.tenantUser.update({
              where: { id: tenantUser.id },
              data: { areas: freshAreas as string[], roles: mergedRoles, updatedAt: new Date() },
            });
            logger.info('Self-healed empty areas for user', { category: 'auth', userId, areas: freshAreas.join(', ') });
          } catch {
            // Best effort
          }
          return { tenantUser: { ...tenantUser, areas: freshAreas, roles: mergedRoles } };
        }
      }
    } catch {
      // Non-critical; continue with existing tenant user
    }
  }

  return { tenantUser };
}

export function canAccessRole(tenantUser: any, roles: string[]) {
  const userRoles = normalizeRoles(tenantUser?.roles || []);
  return roles.some((role) => userRoles.includes(String(role || '').toLowerCase()));
}

export function canAccessArea(tenantUser: any, area: AreaKey) {
  const userAreas = normalizeAreas(tenantUser?.areas || []);
  return userAreas.includes(area);
}

export function canAccessDepartment(tenantUser: any, departmentKey: string) {
  const userDepartments = normalizeDepartments(tenantUser?.departments || []);
  if (!userDepartments.length) return false;
  return userDepartments.includes(String(departmentKey || '').trim());
}

export async function requireAreaAccess(args: {
  tenantId: string;
  userId: string;
  user: any;
  area: AreaKey;
  allowRoles?: string[];
  requireRoles?: string[];
}): Promise<{ tenantUser: any } | NextResponse> {
  const { tenantId, userId, user, area, allowRoles = [], requireRoles = [] } = args;
  const resolved = await resolveTenantUser({ tenantId, userId, user });
  if (resolved instanceof NextResponse) return resolved;

  const tenantUser = resolved.tenantUser;
  const userRoles = normalizeRoles(tenantUser?.roles || []);
  const isAdminDev = userRoles.includes('admin') || userRoles.includes('dev');
  if (isAdminDev) return { tenantUser };

  if (requireRoles.length && !canAccessRole(tenantUser, requireRoles)) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'ACCESS_DENIED', area, reason: 'ROLE_REQUIRED' },
      { status: 403 }
    );
  }

  if (allowRoles.length && canAccessRole(tenantUser, allowRoles)) {
    return { tenantUser };
  }

  if (!canAccessArea(tenantUser, area)) {
    // Self-healing: re-derive areas from user's current permissions
    try {
      const role = String(user?.role || '').trim().toLowerCase();
      let currentPermissions: string[] = [];

      const tenantUuid = await resolveTenantUuid(tenantId);

      // 1) Check role_definitions for override permissions
      if (tenantUuid) {
        const roleOverride = await prisma.roleDefinition.findFirst({
          where: { tenantId: tenantUuid, key: role },
          select: { permissions: true },
        });
        if (roleOverride && Array.isArray(roleOverride.permissions)) {
          currentPermissions = roleOverride.permissions;
        }
      }

      // 2) Check user's own permissions
      if (!currentPermissions.length) {
        const userDoc = await prisma.user.findFirst({
          where: { id: userId },
          select: { permissions: true },
        });
        if (userDoc && Array.isArray(userDoc.permissions)) {
          currentPermissions = userDoc.permissions;
        }
      }

      // 3) Fallback to defaults
      if (!currentPermissions.length) {
        currentPermissions = getDefaultPermissionsForRole(role);
      }

      const freshAreas = deriveAreasFromPermissions(currentPermissions);

      if (freshAreas.includes(area)) {
        const freshRoles = deriveRolesFromUserRole(role);
        const mergedAreas = Array.from(new Set([...normalizeAreas(tenantUser.areas), ...freshAreas]));
        const mergedRoles = Array.from(new Set([...normalizeRoles(tenantUser.roles), ...freshRoles]));

        if (tenantUuid) {
          try {
            await prisma.tenantUser.updateMany({
              where: { tenantId: tenantUuid, userId },
              data: { areas: mergedAreas as string[], roles: mergedRoles, updatedAt: new Date() },
            });
            logger.info('Self-healed tenant_user areas', { category: 'auth', userId, area });
          } catch {
            // Best effort update
          }
        }

        return { tenantUser: { ...tenantUser, areas: mergedAreas, roles: mergedRoles } };
      }
    } catch (healErr) {
      logger.error('Self-heal error in requireAreaAccess', { category: 'auth', error: healErr });
    }

    return NextResponse.json(
      { error: 'Forbidden', code: 'ACCESS_DENIED', area, reason: 'AREA_NOT_GRANTED' },
      { status: 403 }
    );
  }

  return { tenantUser };
}
