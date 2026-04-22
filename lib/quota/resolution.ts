/**
 * Quota Resolution Logic
 *
 * Resolves quota for a user and feature:
 * 1. Check user-level quota (highest priority)
 * 2. Check group-level quota (fallback)
 * 3. No quota restriction (if neither exists)
 *
 * The Prisma UsageQuota model now has dedicated columns for scopeType,
 * scopeId, and featureKey, enabling direct Prisma where clauses.
 * Metadata JSON is only used for supplementary fields (status, lockedAt, etc.).
 */

import { prisma } from '@/lib/db/prisma';
import { UsageQuota as UsageQuotaRow } from '@prisma/client';
import { UsageQuota, QuotaResolution } from '@/lib/models/UsageQuota';
import { AuthenticatedUser } from '@/lib/auth/requireAuth';

/**
 * Resolve quota for a user and feature
 */
export async function resolveQuota(
  auth: AuthenticatedUser,
  featureKey: string
): Promise<QuotaResolution> {
  const { tenantId, userId } = auth;
  const groupId = auth.user?.groupId;

  if (!groupId) {
    const userQuota = await getUserQuota(tenantId, userId, featureKey);
    if (userQuota) {
      return {
        quota: userQuota,
        scopeType: 'user',
        available: Math.max(0, userQuota.limit - userQuota.used),
        exceeded: userQuota.used >= userQuota.limit,
      };
    }
    return {
      quota: null,
      scopeType: null,
      available: Infinity,
      exceeded: false,
    };
  }

  // Step 1: Check user-level quota
  const userQuota = await getUserQuota(tenantId, userId, featureKey);
  if (userQuota) {
    return {
      quota: userQuota,
      scopeType: 'user',
      available: Math.max(0, userQuota.limit - userQuota.used),
      exceeded: userQuota.used >= userQuota.limit,
    };
  }

  // Step 2: Check group-level quota
  if (groupId) {
    const groupQuota = await getGroupQuota(tenantId, groupId, featureKey);
    if (groupQuota) {
      return {
        quota: groupQuota,
        scopeType: 'group',
        available: Math.max(0, groupQuota.limit - groupQuota.used),
        exceeded: groupQuota.used >= groupQuota.limit,
      };
    }
  }

  // Step 3: No quota restriction
  return {
    quota: null,
    scopeType: null,
    available: Infinity,
    exceeded: false,
  };
}

/**
 * Map a Prisma UsageQuota row to the application UsageQuota interface.
 * Rich fields (scopeType, scopeId, featureKey, etc.) are read from metadata.
 */
function mapPrismaToUsageQuota(row: UsageQuotaRow): UsageQuota {
  const meta = (row.metadata as Record<string, unknown>) || {};
  return {
    id: row.id,
    tenantId: row.tenantId,
    scopeType: (meta.scopeType as 'user' | 'group') || 'user',
    scopeId: (meta.scopeId as string) || '',
    featureKey: (meta.featureKey as string) || row.quotaType || '',
    limit: row.maxLimit ?? 0,
    used: row.currentUsage ?? 0,
    status: (meta.status as 'active' | 'locked') || 'active',
    startsAt: row.periodStart ?? undefined,
    endsAt: row.periodEnd ?? undefined,
    lockedAt: meta.lockedAt ? new Date(meta.lockedAt as string) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: meta.createdBy as string | undefined,
    updatedBy: meta.updatedBy as string | undefined,
  };
}

/**
 * Get user-level quota
 */
async function getUserQuota(
  tenantId: string,
  userId: string,
  featureKey: string
): Promise<UsageQuota | null> {
  const now = new Date();

  // Query using dedicated columns for scopeType/scopeId/featureKey,
  // and periodStart/periodEnd for time bounds.
  const quota = await prisma.usageQuota.findFirst({
    where: {
      tenantId,
      scopeType: 'user',
      scopeId: userId,
      featureKey,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  });

  if (quota) {
    const meta = (quota.metadata as Record<string, unknown>) || {};
    if (meta.status !== 'locked') {
      return mapPrismaToUsageQuota(quota);
    }
  }

  // Fallback: try quotaType-based lookup (simpler schema usage)
  const fallback = await prisma.usageQuota.findFirst({
    where: {
      tenantId,
      quotaType: featureKey,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  });
  if (fallback) {
    const meta = (fallback.metadata as Record<string, unknown>) || {};
    if (meta.scopeType === 'user' && meta.scopeId === userId) {
      return mapPrismaToUsageQuota(fallback);
    }
  }

  return null;
}

/**
 * Get group-level quota
 */
async function getGroupQuota(
  tenantId: string,
  groupId: string,
  featureKey: string
): Promise<UsageQuota | null> {
  const now = new Date();

  const quota = await prisma.usageQuota.findFirst({
    where: {
      tenantId,
      scopeType: 'group',
      scopeId: groupId,
      featureKey,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  });

  if (quota) {
    const meta = (quota.metadata as Record<string, unknown>) || {};
    if (meta.status !== 'locked') {
      return mapPrismaToUsageQuota(quota);
    }
  }

  // Fallback: quotaType-based lookup
  const fallback = await prisma.usageQuota.findFirst({
    where: {
      tenantId,
      quotaType: featureKey,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  });
  if (fallback) {
    const meta = (fallback.metadata as Record<string, unknown>) || {};
    if (meta.scopeType === 'group' && meta.scopeId === groupId) {
      return mapPrismaToUsageQuota(fallback);
    }
  }

  return null;
}
