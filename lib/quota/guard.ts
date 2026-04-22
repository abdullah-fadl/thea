/**
 * Quota Guard Middleware
 *
 * Checks quota before allowing action and atomically increments usage.
 * Uses Prisma for database operations.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveQuota } from './resolution';
import { AuthenticatedUser } from '@/lib/auth/requireAuth';

export interface QuotaErrorResponse {
  error: string;
  reasonCode: 'DEMO_QUOTA_REACHED';
  quota?: {
    limit: number;
    used: number;
    available: number;
    scopeType: 'user' | 'group';
    featureKey: string;
  };
}

/**
 * Require quota - checks quota and atomically increments usage
 *
 * Returns 403 with DEMO_QUOTA_REACHED if quota is exceeded.
 * Atomically increments usage counter to prevent race conditions.
 *
 * @param auth - Authenticated user context
 * @param featureKey - Feature key (e.g., 'policy.search', 'policy.view')
 * @returns null if quota check passes, NextResponse with 403 if quota exceeded
 */
export async function requireQuota(
  auth: AuthenticatedUser,
  featureKey: string
): Promise<NextResponse<QuotaErrorResponse> | null> {
  // Resolve quota (user-level first, then group-level)
  const resolution = await resolveQuota(auth, featureKey);

  // No quota restriction - allow action
  if (!resolution.quota) {
    return null;
  }

  const quota = resolution.quota;

  // Check if quota is locked
  if (quota.status === 'locked') {
    // Locked quota means it's disabled, so no restriction
    return null;
  }

  // Check if quota is exceeded
  if (resolution.exceeded) {
    return NextResponse.json<QuotaErrorResponse>(
      {
        error: 'Demo quota limit reached',
        reasonCode: 'DEMO_QUOTA_REACHED',
        quota: {
          limit: quota.limit,
          used: quota.used,
          available: resolution.available,
          scopeType: resolution.scopeType!,
          featureKey: quota.featureKey,
        },
      },
      { status: 403 }
    );
  }

  // Atomically increment usage
  // Prisma doesn't support conditional atomic increment like MongoDB's findOneAndUpdate with $lt,
  // so we use a transaction to ensure atomicity.
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.usageQuota.findFirst({
        where: { id: quota.id, tenantId: quota.tenantId },
      });

      if (!current || current.used >= current.limit) {
        throw new Error('QUOTA_EXCEEDED');
      }

      await tx.usageQuota.update({
        where: { id: quota.id },
        data: {
          used: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
      // Re-fetch to get latest
      const latestQuota = await prisma.usageQuota.findFirst({
        where: { id: quota.id },
      });

      if (latestQuota && latestQuota.used >= latestQuota.limit) {
        return NextResponse.json<QuotaErrorResponse>(
          {
            error: 'Demo quota limit reached',
            reasonCode: 'DEMO_QUOTA_REACHED',
            quota: {
              limit: latestQuota.limit,
              used: latestQuota.used,
              available: Math.max(0, latestQuota.limit - latestQuota.used),
              scopeType: resolution.scopeType!,
              featureKey: latestQuota.featureKey || '',
            },
          },
          { status: 403 }
        );
      }
    } else {
      // If it's a different error, let it propagate
      throw err;
    }
  }

  // Quota check passed and usage incremented - allow action
  return null;
}
