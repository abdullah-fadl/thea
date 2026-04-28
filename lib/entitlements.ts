/**
 * Platform Entitlements Logic
 *
 * Computes effective platform entitlements based on:
 * 1. Tenant entitlements (what the tenant purchased)
 * 2. User platform access (what the user is allowed within the tenant)
 *
 * Effective entitlements = intersection(tenantEntitlements, userPlatformAccess || tenantEntitlements)
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface PlatformEntitlements {
  sam: boolean;
  health: boolean;
  edrac: boolean;
  cvision: boolean;
  imdad: boolean;
}

function isValidTenantId(value: string | null | undefined): value is string {
  const normalized = String(value || '').trim();
  return !!normalized && normalized !== 'default' && normalized !== '__skip__';
}

/**
 * Compute effective entitlements for a user
 *
 * Rules:
 * - If user has platformAccess defined, use intersection with tenant entitlements
 * - If user has no platformAccess, fall back to tenant entitlements (full access within tenant)
 * - This ensures safe defaults to avoid lockout
 */
export function computeEffectiveEntitlements(
  tenantEntitlements: PlatformEntitlements,
  userPlatformAccess?: PlatformEntitlements | null
): PlatformEntitlements {
  // If user has no platformAccess defined, grant full access within tenant limits
  if (!userPlatformAccess) {
    return tenantEntitlements;
  }

  // Intersection: user can only access what both tenant and user allow
  // Default to true (inherit from tenant) when user-level access is not explicitly set (null)
  return {
    sam: tenantEntitlements.sam && (userPlatformAccess.sam ?? true),
    health: tenantEntitlements.health && (userPlatformAccess.health ?? true),
    edrac: tenantEntitlements.edrac && (userPlatformAccess.edrac ?? true),
    cvision: tenantEntitlements.cvision && (userPlatformAccess.cvision ?? true),
    imdad: tenantEntitlements.imdad && (userPlatformAccess.imdad ?? true),
  };
}

/**
 * Get tenant entitlements from database
 */
export async function getTenantEntitlements(tenantId: string): Promise<PlatformEntitlements | null> {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { tenantId },
      select: {
        entitlementSam: true,
        entitlementHealth: true,
        entitlementEdrac: true,
        entitlementCvision: true,
        entitlementScm: true,
      },
    });

    if (!tenant) {
      return null;
    }

    return {
      sam: tenant.entitlementSam ?? true,
      health: tenant.entitlementHealth ?? true,
      edrac: tenant.entitlementEdrac ?? false,
      cvision: tenant.entitlementCvision ?? false,
      imdad: tenant.entitlementScm ?? false,
    };
  } catch (error) {
    logger.error('Error fetching tenant entitlements', { category: 'system', error });
    return null;
  }
}

/**
 * Get user platform access from database
 *
 * @param userId - User ID
 * @param _tenantId - Tenant ID (unused — single DB, kept for API compatibility)
 */
export async function getUserPlatformAccess(
  userId: string,
  _tenantId?: string
): Promise<PlatformEntitlements | null> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: {
        platformAccessSam: true,
        platformAccessHealth: true,
        platformAccessEdrac: true,
        platformAccessCvision: true,
        platformAccessScm: true,
      },
    });

    if (!user) {
      return null;
    }

    // If all platform access fields are null, treat as no explicit access set
    const hasAnyAccess =
      user.platformAccessSam !== null ||
      user.platformAccessHealth !== null ||
      user.platformAccessEdrac !== null ||
      user.platformAccessCvision !== null ||
      user.platformAccessScm !== null;

    if (!hasAnyAccess) {
      return null;
    }

    return {
      sam: user.platformAccessSam ?? true,
      health: user.platformAccessHealth ?? true,
      edrac: user.platformAccessEdrac ?? true,
      cvision: user.platformAccessCvision ?? true,
      imdad: user.platformAccessScm ?? true,
    };
  } catch (error) {
    logger.error('Error fetching user platform access', { category: 'system', error });
    return null;
  }
}

/**
 * Get effective entitlements for a user (combines tenant + user)
 */
export async function getEffectiveEntitlements(
  tenantId: string,
  userId: string
): Promise<PlatformEntitlements> {
  if (!isValidTenantId(tenantId)) {
    return {
      sam: true,
      health: true,
      edrac: false,
      cvision: false,
      imdad: false,
    };
  }
  const tenantEntitlements = await getTenantEntitlements(tenantId);
  const userPlatformAccess = await getUserPlatformAccess(userId, tenantId);

  // Safe fallback: if tenant not found, grant sam and health (avoid lockout)
  const defaultEntitlements: PlatformEntitlements = {
    sam: true,
    health: true,
    edrac: false,
    cvision: false,
    imdad: false,
  };

  if (!tenantEntitlements) {
    logger.warn('Tenant not found, using safe defaults', { category: 'system', tenantId });
    return computeEffectiveEntitlements(defaultEntitlements, userPlatformAccess);
  }

  return computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess);
}
