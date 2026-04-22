/**
 * Subscription Engine
 *
 * Real enforcement of subscription contracts:
 * - Check subscription status
 * - Enforce platform access
 * - Enforce user limits
 * - Enforce feature flags
 * - Enforce resource limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { SubscriptionContract, isSubscriptionActive, isReadOnlyMode } from '../models/Subscription';
import { requireAuth } from '@/lib/auth/requireAuth';

export interface SubscriptionCheckResult {
  allowed: boolean;
  readOnly: boolean;
  reason?: string;
  contract?: SubscriptionContract;
}

/**
 * Check subscription status for a tenant
 */
export async function checkSubscription(
  tenantKey: string
): Promise<SubscriptionCheckResult> {
  // Resolve tenant (accepts key or UUID)
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantKey),
    select: { id: true, tenantId: true },
  });

  if (!tenant) {
    return {
      allowed: false,
      readOnly: false,
      reason: 'Tenant not found',
    };
  }

  const contractRow = await prisma.subscriptionContract.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!contractRow) {
    return {
      allowed: false,
      readOnly: false,
      reason: 'No subscription contract found',
    };
  }

  // Map Prisma row to the SubscriptionContract interface
  const contract: SubscriptionContract = {
    id: contractRow.id,
    tenantId: tenant.tenantId ?? tenantKey,
    enabledPlatforms: {
      sam: contractRow.enabledSam,
      theaHealth: contractRow.enabledTheaHealth,
      cvision: contractRow.enabledCvision,
      edrac: contractRow.enabledEdrac,
      imdad: (contractRow as any).enabledImdad ?? false,
    },
    maxUsers: contractRow.maxUsers,
    currentUsers: contractRow.currentUsers,
    enabledFeatures: (contractRow.enabledFeatures as Record<string, boolean>) || {},
    storageLimit: Number(contractRow.storageLimit),
    aiQuota: (contractRow.aiQuota as any) || { monthlyLimit: 0, currentUsage: 0, resetDate: new Date() },
    branchLimits: (contractRow.branchLimits as any) || undefined,
    status: contractRow.status as SubscriptionContract['status'],
    planType: contractRow.planType as SubscriptionContract['planType'],
    subscriptionStartsAt: contractRow.subscriptionStartsAt,
    subscriptionEndsAt: contractRow.subscriptionEndsAt || undefined,
    gracePeriodEndsAt: contractRow.gracePeriodEndsAt || undefined,
    gracePeriodEnabled: contractRow.gracePeriodEnabled,
    createdAt: contractRow.createdAt,
    updatedAt: contractRow.updatedAt,
  };

  const active = isSubscriptionActive(contract);
  const readOnly = isReadOnlyMode(contract);

  if (!active && !readOnly) {
    return {
      allowed: false,
      readOnly: false,
      reason: contract.status === 'expired'
        ? 'Subscription expired. Please contact administration.'
        : 'Subscription is blocked. Please contact administration.',
      contract,
    };
  }

  return {
    allowed: true,
    readOnly,
    contract,
  };
}

/**
 * Require active subscription
 * Returns subscription check result or 403 response
 */
export async function requireSubscription(
  request: NextRequest
): Promise<SubscriptionCheckResult | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { tenantId } = authResult;
  const subscriptionCheck = await checkSubscription(tenantId);

  if (!subscriptionCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Subscription Required',
        message: subscriptionCheck.reason || 'Subscription is not active',
      },
      { status: 403 }
    );
  }

  return subscriptionCheck;
}

/**
 * Check if platform is enabled for tenant
 */
export async function isPlatformEnabled(
  tenantKey: string,
  platformKey: 'sam' | 'theaHealth' | 'cvision' | 'edrac' | 'imdad'
): Promise<boolean> {
  const subscriptionCheck = await checkSubscription(tenantKey);

  if (!subscriptionCheck.allowed) {
    return false;
  }

  if (!subscriptionCheck.contract) {
    return false;
  }

  const platformMap: Record<string, keyof SubscriptionContract['enabledPlatforms']> = {
    'sam': 'sam',
    'thea-health': 'theaHealth',
    'theaHealth': 'theaHealth',
    'cvision': 'cvision',
    'edrac': 'edrac',
    'imdad': 'imdad',
  };

  const key = platformMap[platformKey];
  return subscriptionCheck.contract.enabledPlatforms[key] || false;
}

/**
 * Check if feature is enabled for tenant
 */
export async function isFeatureEnabled(
  tenantKey: string,
  featureKey: string
): Promise<boolean> {
  const subscriptionCheck = await checkSubscription(tenantKey);

  if (!subscriptionCheck.allowed) {
    return false;
  }

  if (!subscriptionCheck.contract) {
    return false;
  }

  return subscriptionCheck.contract.enabledFeatures[featureKey] || false;
}

/**
 * Check user limit
 */
export async function checkUserLimit(tenantKey: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}> {
  const subscriptionCheck = await checkSubscription(tenantKey);

  if (!subscriptionCheck.allowed || !subscriptionCheck.contract) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      reason: 'Subscription not active',
    };
  }

  // Compute current user count from PostgreSQL
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantKey),
    select: { id: true },
  });
  const current = tenant
    ? await prisma.user.count({ where: { tenantId: tenant.id } })
    : 0;
  const max = subscriptionCheck.contract.maxUsers;

  if (current >= max) {
    return {
      allowed: false,
      current,
      max,
      reason: `User limit reached (${current}/${max}). Please upgrade your subscription.`,
    };
  }

  return {
    allowed: true,
    current,
    max,
  };
}
