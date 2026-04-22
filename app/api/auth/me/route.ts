import { NextRequest, NextResponse } from 'next/server';
import { getDefaultPermissionsForRole, PERMISSIONS } from '@/lib/permissions';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getUserPlatformAccess, computeEffectiveEntitlements, getTenantEntitlements, PlatformEntitlements } from '@/lib/entitlements';
import { checkSubscription } from '@/lib/core/subscription/engine';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { generateCSRFToken, setCSRFTokenCookie } from '@/lib/security/csrf';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeTenantKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidTenantId(value: string | null | undefined): value is string {
  const normalized = String(value || '').trim();
  return !!normalized && normalized !== 'default' && normalized !== '__skip__';
}

async function resolveRoleDefaults(tenantId: string | null, roleKey: string): Promise<string[]> {
  if (isValidTenantId(tenantId)) {
    try {
      // Resolve tenant key to UUID (roleDefinition.tenantId is a UUID column)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
      let tenantUuid = tenantId;
      if (!isUuid) {
        const t = await prisma.tenant.findFirst({ where: { tenantId }, select: { id: true } });
        tenantUuid = t?.id || tenantId;
        // If still not a UUID after resolution, skip roleDefinition lookup
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantUuid)) {
          return getDefaultPermissionsForRole(roleKey);
        }
      }

      // Try exact key first, then try without hyphens (for DB keys like 'opddoctor')
      let role = await prisma.roleDefinition.findFirst({
        where: { tenantId: tenantUuid, key: roleKey },
      });
      if (!role) {
        const keyNoHyphens = roleKey.replace(/-/g, '');
        if (keyNoHyphens !== roleKey) {
          role = await prisma.roleDefinition.findFirst({
            where: { tenantId: tenantUuid, key: keyNoHyphens },
          });
        }
      }
      if (role && Array.isArray(role.permissions)) {
        return role.permissions;
      }
    } catch {
      // Fallback to static defaults
    }
  }
  return getDefaultPermissionsForRole(roleKey);
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    // Use centralized auth helper - reads ONLY from cookies
    const authResult = await requireAuth(request);

    // Check if auth failed — return 200 with null user (avoids 401 noise when session expired)
    if (authResult instanceof NextResponse) {
      return NextResponse.json({ user: null, tenantId: null });
    }

    const { user } = authResult;

    // Get activeTenantId from session (SINGLE SOURCE OF TRUTH)
    const { getSessionData } = await import('@/lib/auth/sessionHelpers');
    const sessionData = await getSessionData(request);
    const activeTenantId = isValidTenantId(sessionData?.activeTenantId)
      ? sessionData?.activeTenantId
      : isValidTenantId(sessionData?.tenantId)
        ? sessionData?.tenantId
        : isValidTenantId(authResult.tenantId)
          ? authResult.tenantId
          : null;
    const allPermissionKeys = PERMISSIONS.map((p) => p.key);

    // TAK_Thea is the system owner/super-admin tenant
    let isTakTheaTenant = false;
    if (activeTenantId) {
      const activeKey = normalizeTenantKey(activeTenantId);
      if (activeKey.includes('TAKThea') || activeKey.includes('HMGTAK')) {
        isTakTheaTenant = true;
      } else {
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { tenantId: activeTenantId },
          });
          const nameKey = normalizeTenantKey(tenant?.name);
          const tenantIdKey = normalizeTenantKey(tenant?.tenantId);
          isTakTheaTenant = [nameKey, tenantIdKey].some((k) => k.includes('TAKThea') || k.includes('HMGTAK'));
        } catch (e) {
          isTakTheaTenant = false;
        }
      }
    }

    const isTakTheaAdmin =
      (isTakTheaTenant && (user.role === 'admin' || (user.role as string) === 'thea-owner'));

    // Check subscription status (skip for owner without tenant)
    let subscriptionStatus = null;
    if (activeTenantId && (user.role as string) !== 'thea-owner') {
      const subscriptionCheck = await checkSubscription(activeTenantId);
      subscriptionStatus = {
        allowed: subscriptionCheck.allowed,
        readOnly: subscriptionCheck.readOnly,
        reason: subscriptionCheck.reason,
        status: subscriptionCheck.contract?.status || 'unknown',
        subscriptionEndsAt: subscriptionCheck.contract?.subscriptionEndsAt,
        gracePeriodEndsAt: subscriptionCheck.contract?.gracePeriodEndsAt,
      };
    }

    // Get platform entitlements from subscription contract (SOURCE OF TRUTH)
    let tenantEntitlements: PlatformEntitlements | null = null;
    let userPlatformAccess = null;
    let effectiveEntitlements: PlatformEntitlements;

    // Owner always gets all entitlements (project creator / super-admin)
    if ((user.role as string) === 'thea-owner') {
      effectiveEntitlements = {
        sam: true,
        health: true,
        edrac: true,
        cvision: true,
        imdad: true,
      };
      tenantEntitlements = effectiveEntitlements;
    } else if (activeTenantId) {
      // Use tenant entitlements (Owner-configured in /owner/tenants) — not subscription_contract
      tenantEntitlements = await getTenantEntitlements(activeTenantId);
      if (!tenantEntitlements) {
        tenantEntitlements = {
          sam: false,
          health: false,
          edrac: false,
          cvision: false,
          imdad: false,
        };
      }

      userPlatformAccess = await getUserPlatformAccess(user.id, activeTenantId);
      effectiveEntitlements = computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess);
    } else {
      const isOwner = (user.role as string) === 'thea-owner';
      effectiveEntitlements = isOwner
        ? { sam: true, health: true, edrac: true, cvision: true, imdad: true }
        : { sam: false, health: false, edrac: false, cvision: false, imdad: false };
    }

    const roleKey = String(user.role || '').trim().toLowerCase();
    const roleDefaultPermissions = await resolveRoleDefaults(activeTenantId || null, roleKey);
    const effectivePermissions =
      isTakTheaAdmin || roleKey === 'admin' || roleKey === 'tenant-admin' || roleKey === 'thea-owner'
        ? allPermissionKeys
        : roleDefaultPermissions;

    const csrfToken = generateCSRFToken();
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        staffId: user.staffId,
        twoFactorEnabled: !!user.twoFactorEnabled,
        permissions: effectivePermissions,
      },
      tenantId: activeTenantId,
      tenantEntitlements: tenantEntitlements || {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
        imdad: false,
      },
      userPlatformAccess: userPlatformAccess || null,
      effectiveEntitlements,
      subscription: subscriptionStatus,
      csrfToken,
    });
    setCSRFTokenCookie(response, csrfToken);
    return response;
});
