/**
 * Owner vs Tenant Separation
 *
 * Strict separation between Thea Owner and Tenant users:
 * - Owner can view ONLY aggregated tenant data
 * - Owner MUST NOT see tenant user names
 * - Owner MUST NOT access tenant data
 * - Owner MUST NOT impersonate tenant users
 * - Owner MUST NOT enter tenant platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';


export interface AggregatedTenantData {
  tenantId: string;
  name?: string;
  status: 'active' | 'blocked' | 'expired';
  planType: 'demo' | 'paid';
  enabledPlatforms: {
    sam: boolean;
    theaHealth: boolean;
    cvision: boolean;
    edrac: boolean;
    imdad: boolean;
  };
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
    imdad: boolean;
  };
  maxUsers: number;
  activeUsersCount: number; // NUMBER ONLY, no names
  remainingSubscriptionDays?: number;
  subscriptionEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Check if user is Thea Owner
 */
export function isTheaOwner(auth: AuthenticatedUser): boolean {
  return auth.user.role === 'thea-owner';
}

/**
 * Require Thea Owner role
 * Returns authenticated owner context or 403 response
 */
export async function requireOwner(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!isTheaOwner(authResult)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
      message: 'Thea Owner access required',
      },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Get aggregated tenant data (owner-only)
 * Returns ONLY aggregated data, no user names or tenant data
 */
export async function getAggregatedTenantData(
  tenantKey: string
): Promise<AggregatedTenantData | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { tenantId: tenantKey },
  });

  if (!tenant) {
    return null;
  }

  // Get active users count (NUMBER ONLY)
  let activeUsersCount = 0;
  try {
    activeUsersCount = await prisma.user.count({
      where: {
        tenantId: tenant.id,
        role: { not: 'THEA_OWNER' },
      },
    });
  } catch (error) {
    logger.warn('Failed to count users for tenant', { category: 'system', tenantKey, error });
  }

  // Calculate remaining subscription days
  let remainingSubscriptionDays: number | undefined;
  if (tenant.subscriptionEndsAt) {
    const now = new Date();
    const endsAt = new Date(tenant.subscriptionEndsAt);
    const diffTime = endsAt.getTime() - now.getTime();
    remainingSubscriptionDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Map DB PlanType (DEMO, TRIAL, PAID, ENTERPRISE) to UI values (demo, paid)
  const rawPlan = (tenant.planType || 'DEMO').toString().toUpperCase();
  const planType: 'demo' | 'paid' =
    rawPlan === 'DEMO' || rawPlan === 'TRIAL' ? 'demo' : 'paid';

  return {
    tenantId: tenant.tenantId,
    name: tenant.name || undefined,
    status: tenant.status.toLowerCase() as 'active' | 'blocked' | 'expired',
    planType,
    enabledPlatforms: {
      sam: tenant.entitlementSam,
      theaHealth: tenant.entitlementHealth,
      edrac: tenant.entitlementEdrac,
      cvision: tenant.entitlementCvision,
      imdad: (tenant as any).entitlementScm ?? false,
    },
    entitlements: {
      sam: tenant.entitlementSam,
      health: tenant.entitlementHealth,
      edrac: tenant.entitlementEdrac,
      cvision: tenant.entitlementCvision,
      imdad: (tenant as any).entitlementScm ?? false,
    },
    maxUsers: tenant.maxUsers,
    activeUsersCount,
    remainingSubscriptionDays: remainingSubscriptionDays && remainingSubscriptionDays > 0 ? remainingSubscriptionDays : undefined,
    subscriptionEndsAt: tenant.subscriptionEndsAt || undefined,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

/**
 * Get all aggregated tenant data (owner-only)
 */
export async function getAllAggregatedTenantData(): Promise<AggregatedTenantData[]> {
  const tenants = await prisma.tenant.findMany({
    select: { tenantId: true },
    take: 500,
  });

  const aggregatedData: AggregatedTenantData[] = [];

  for (const tenant of tenants) {
    try {
      const data = await getAggregatedTenantData(tenant.tenantId);
      if (data) {
        aggregatedData.push(data);
      }
    } catch (error) {
      logger.error('Error processing tenant', { category: 'system', tenantId: tenant.tenantId, error });
    }
  }

  return aggregatedData;
}

/**
 * Block tenant access
 */
export async function blockTenant(tenantKey: string): Promise<void> {
  await prisma.tenant.updateMany({
    where: { tenantId: tenantKey },
    data: {
      status: 'BLOCKED',
      updatedAt: new Date(),
    },
  });
}

/**
 * Unblock tenant access
 */
export async function unblockTenant(tenantKey: string): Promise<void> {
  await prisma.tenant.updateMany({
    where: { tenantId: tenantKey },
    data: {
      status: 'ACTIVE',
      updatedAt: new Date(),
    },
  });
}

/**
 * Validate owner cannot access tenant data
 */
export function validateOwnerAccess(
  auth: AuthenticatedUser,
  tenantId?: string
): { allowed: boolean; reason?: string } {
  if (!isTheaOwner(auth)) {
    return { allowed: true };
  }

  if (tenantId && tenantId !== 'platform') {
    return {
      allowed: false,
      reason: 'Thea Owner cannot access tenant-specific data',
    };
  }

  return { allowed: true };
}
