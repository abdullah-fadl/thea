import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { validateBody } from '@/lib/validation/helpers';
import { createContractSchema } from '@/lib/validation/admin.schema';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/create-subscription-contract
 * Create a subscription contract for a tenant
 *
 * Body: { tenantId }
 */
export const POST = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    // Authorization: Only admin can create subscription contracts
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const v = validateBody(body, createContractSchema);
    if ('error' in v) return v.error;
    const { tenantId: targetTenantId } = v.data;

    // Check if tenant exists
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(targetTenantId) });
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found', message: `Tenant "${targetTenantId}" does not exist` },
        { status: 404 }
      );
    }

    // Check if contract already exists
    const existingContract = await prisma.subscriptionContract.findFirst({
      where: { tenantId: tenant.id },
    });

    if (existingContract) {
      return NextResponse.json(
        {
          error: 'Contract already exists',
          message: `Subscription contract already exists for tenant "${targetTenantId}"`,
          contract: {
            id: existingContract.id,
            status: existingContract.status,
            planType: existingContract.planType,
          }
        },
        { status: 409 }
      );
    }

    // Get tenant entitlements
    const entitlements = {
      sam: tenant.entitlementSam,
      health: tenant.entitlementHealth,
      edrac: tenant.entitlementEdrac,
      cvision: tenant.entitlementCvision,
    };

    const now = new Date();
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Create subscription contract
    const contract = await prisma.subscriptionContract.create({
      data: {
        tenantId: tenant.id,
        status: tenant.status === 'BLOCKED' ? 'blocked' : 'active',
        enabledSam: entitlements.sam,
        enabledTheaHealth: entitlements.health,
        enabledCvision: entitlements.cvision,
        enabledEdrac: entitlements.edrac,
        maxUsers: tenant.maxUsers || 100,
        currentUsers: 0,
        enabledFeatures: {},
        storageLimit: BigInt(1000000000), // 1GB
        aiQuota: {
          monthlyLimit: 10000,
          currentUsage: 0,
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        branchLimits: {
          maxDepartments: 0,
          maxUnits: 0,
          maxFloors: 0,
        },
        planType: tenant.planType || 'enterprise',
        subscriptionStartsAt: now,
        subscriptionEndsAt: tenant.subscriptionEndsAt || oneYearFromNow,
        gracePeriodEnabled: tenant.gracePeriodEnabled,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subscription contract created for tenant "${targetTenantId}"`,
      contract: {
        id: contract.id,
        tenantId: targetTenantId,
        status: contract.status,
        planType: contract.planType,
        enabledPlatforms: {
          sam: contract.enabledSam,
          theaHealth: contract.enabledTheaHealth,
          cvision: contract.enabledCvision,
          edrac: contract.enabledEdrac,
        },
        maxUsers: contract.maxUsers,
        subscriptionEndsAt: contract.subscriptionEndsAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    logger.error('Create subscription contract error', { category: 'api', route: 'POST /api/admin/create-subscription-contract', error });

    return NextResponse.json(
      { error: 'Failed to create subscription contract', message: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: false }); // This endpoint is platform-scoped
