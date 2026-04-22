/**
 * POST /api/owner/setup-owner-tenant
 * Creates a dedicated tenant for Thea Owner with all platforms enabled
 * This tenant allows owner to develop and test all platforms independently
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { prisma } from '@/lib/db/prisma';
import { generateTenantDbName } from '@/lib/db/dbNameHelper';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const OWNER_TENANT_ID = 'thea-owner-dev';
const OWNER_TENANT_NAME = 'Thea Owner Development Tenant';

export const POST = withErrorHandler(async (request: NextRequest) => {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check if owner tenant already exists
    const existingTenant = await prisma.tenant.findFirst({
      where: { tenantId: OWNER_TENANT_ID },
    });

    if (existingTenant) {
      return NextResponse.json({
        success: true,
        message: 'Owner tenant already exists',
        tenant: {
          tenantId: existingTenant.tenantId,
          name: existingTenant.name,
          entitlements: {
            sam: existingTenant.entitlementSam,
            health: existingTenant.entitlementHealth,
            edrac: existingTenant.entitlementEdrac,
            cvision: existingTenant.entitlementCvision,
          },
          status: existingTenant.status,
        },
      });
    }

    // Create owner tenant with all platforms enabled
    const dbName = generateTenantDbName(OWNER_TENANT_ID);

    const ownerTenant = await prisma.tenant.create({
      data: {
        tenantId: OWNER_TENANT_ID,
        name: OWNER_TENANT_NAME,
        dbName,
        entitlementSam: true,
        entitlementHealth: true,
        entitlementEdrac: true,
        entitlementCvision: true,
        status: 'ACTIVE',
        planType: 'ENTERPRISE',
        gracePeriodEnabled: false,
        maxUsers: 1000,
        createdBy: authResult.user.id,
      },
    });

    logger.info('Created owner tenant', { category: 'api', tenantId: OWNER_TENANT_ID });

    return NextResponse.json({
      success: true,
      message: 'Owner tenant created successfully',
      tenant: {
        tenantId: ownerTenant.tenantId,
        name: ownerTenant.name,
        entitlements: {
          sam: ownerTenant.entitlementSam,
          health: ownerTenant.entitlementHealth,
          edrac: ownerTenant.entitlementEdrac,
          cvision: ownerTenant.entitlementCvision,
        },
        status: ownerTenant.status,
      },
    });
});

/**
 * GET /api/owner/setup-owner-tenant
 * Check if owner tenant exists
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const ownerTenant = await prisma.tenant.findFirst({
      where: { tenantId: OWNER_TENANT_ID },
    });

    if (!ownerTenant) {
      return NextResponse.json({
        exists: false,
        message: 'Owner tenant does not exist',
      });
    }

    return NextResponse.json({
      exists: true,
      tenant: {
        tenantId: ownerTenant.tenantId,
        name: ownerTenant.name,
        entitlements: {
          sam: ownerTenant.entitlementSam,
          health: ownerTenant.entitlementHealth,
          edrac: ownerTenant.entitlementEdrac,
          cvision: ownerTenant.entitlementCvision,
        },
        status: ownerTenant.status,
      },
    });
});
