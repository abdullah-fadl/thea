import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { buildDefaultContextPack } from '@/lib/sam/tenantContext';
import { hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/test/seed
 * Test-only endpoint to seed test data
 *
 * Guards:
 * - NODE_ENV === "test" OR Thea_TEST_MODE=true
 * - x-test-secret header must match TEST_SECRET env var
 * - MUST be disabled in production builds
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // TEST-ONLY ROUTE GUARDS (EXPLICIT - route scanner validates these patterns):
  // Guard 1: Production block (EXPLICIT CHECK - scanner validates NODE_ENV === 'production')
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return NextResponse.json(
      { error: 'Test seeding is disabled in production' },
      { status: 403 }
    );
  }

  // Guard 2: Test secret header check (EXPLICIT CHECK - scanner validates x-test-secret)
  const testSecret = request.headers.get('x-test-secret');
  // [SEC-05] Require TEST_SECRET env var — no hardcoded fallback
  const expectedSecret = process.env.TEST_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'TEST_SECRET environment variable is not configured' },
      { status: 500 }
    );
  }

  if (!testSecret || testSecret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Invalid test secret' },
      { status: 403 }
    );
  }

  // Guard 3: Test mode check (EXPLICIT CHECK - scanner validates Thea_TEST_MODE)
  // This is required for test-only routes (Thea_TEST_MODE check)
  // Allow test mode via environment variable OR x-test-mode header (for E2E tests)
  const testModeHeader = request.headers.get('x-test-mode');
  const isTestMode = process.env.NODE_ENV === 'test' ||
                     process.env.Thea_TEST_MODE === 'true' ||
                     testModeHeader === 'true';

  if (!isTestMode) {
    return NextResponse.json(
      { error: 'Test seeding requires NODE_ENV=test, Thea_TEST_MODE=true, or x-test-mode: true header' },
      { status: 403 }
    );
  }

  // If test secret is valid and test mode is enabled, allow (for development testing)
  // In production, this endpoint won't exist anyway

  try {
    const now = new Date();

    // Test tenants configuration
    const testTenants = [
      {
        tenantId: 'test-tenant-a',
        name: 'Test Tenant A',
        status: 'ACTIVE' as const,
        entitlements: {
          sam: true,
          theaHealth: true,
          edrac: false,
          cvision: false,
        },
        subscriptionStatus: 'active' as const,
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        userEmail: 'test-a@example.com',
        userPassword: 'password123',
      },
      {
        tenantId: 'test-tenant-expired',
        name: 'Test Tenant Expired',
        status: 'EXPIRED' as const,
        entitlements: {
          sam: true,
          theaHealth: true,
          edrac: false,
          cvision: false,
        },
        subscriptionStatus: 'expired' as const,
        subscriptionEndsAt: new Date(Date.now() - 1), // Expired
        userEmail: 'expired@example.com',
        userPassword: 'password123',
      },
      {
        tenantId: 'test-tenant-blocked',
        name: 'Test Tenant Blocked',
        status: 'BLOCKED' as const,
        entitlements: {
          sam: true,
          theaHealth: true,
          edrac: false,
          cvision: false,
        },
        subscriptionStatus: 'blocked' as const,
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        userEmail: 'blocked@example.com',
        userPassword: 'password123',
      },
      {
        tenantId: 'test-tenant-nosam',
        name: 'Test Tenant NoSAM',
        status: 'ACTIVE' as const,
        entitlements: {
          sam: false,
          theaHealth: true,
          edrac: false,
          cvision: false,
        },
        subscriptionStatus: 'active' as const,
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        userEmail: 'nosam@example.com',
        userPassword: 'password123',
      },
      {
        tenantId: 'test-tenant-b',
        name: 'Test Tenant B',
        status: 'ACTIVE' as const,
        entitlements: {
          sam: true,
          theaHealth: true,
          edrac: false,
          cvision: false,
        },
        subscriptionStatus: 'active' as const,
        subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        userEmail: 'test-b@example.com',
        userPassword: 'password123',
      },
    ];

    const seededData: any = {
      tenants: [],
      users: [],
    };

    // Seed each tenant
    for (const tenantConfig of testTenants) {
      // Upsert tenant
      const tenant = await prisma.tenant.upsert({
        where: { tenantId: tenantConfig.tenantId },
        update: {
          name: tenantConfig.name,
          status: tenantConfig.status,
          entitlementSam: tenantConfig.entitlements.sam,
          entitlementHealth: tenantConfig.entitlements.theaHealth,
          entitlementEdrac: tenantConfig.entitlements.edrac,
          entitlementCvision: tenantConfig.entitlements.cvision,
          planType: 'ENTERPRISE',
          maxUsers: 100,
          gracePeriodEnabled: false,
          updatedAt: now,
        },
        create: {
          tenantId: tenantConfig.tenantId,
          name: tenantConfig.name,
          status: tenantConfig.status,
          entitlementSam: tenantConfig.entitlements.sam,
          entitlementHealth: tenantConfig.entitlements.theaHealth,
          entitlementEdrac: tenantConfig.entitlements.edrac,
          entitlementCvision: tenantConfig.entitlements.cvision,
          planType: 'ENTERPRISE',
          maxUsers: 100,
          gracePeriodEnabled: false,
          createdAt: now,
          updatedAt: now,
        },
      });

      // Upsert subscription contract
      // Check if one already exists for this tenant
      const existingContract = await prisma.subscriptionContract.findFirst({
        where: { tenantId: tenant.id },
      });

      if (existingContract) {
        await prisma.subscriptionContract.update({
          where: { id: existingContract.id },
          data: {
            status: tenantConfig.subscriptionStatus,
            enabledSam: tenantConfig.entitlements.sam,
            enabledTheaHealth: tenantConfig.entitlements.theaHealth,
            enabledEdrac: tenantConfig.entitlements.edrac,
            enabledCvision: tenantConfig.entitlements.cvision,
            maxUsers: 100,
            currentUsers: 0,
            enabledFeatures: {},
            storageLimit: BigInt(1000000000),
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
            planType: 'enterprise',
            subscriptionEndsAt: tenantConfig.subscriptionEndsAt,
            gracePeriodEnabled: false,
            updatedAt: now,
          },
        });
      } else {
        await prisma.subscriptionContract.create({
          data: {
            tenantId: tenant.id,
            status: tenantConfig.subscriptionStatus,
            enabledSam: tenantConfig.entitlements.sam,
            enabledTheaHealth: tenantConfig.entitlements.theaHealth,
            enabledEdrac: tenantConfig.entitlements.edrac,
            enabledCvision: tenantConfig.entitlements.cvision,
            maxUsers: 100,
            currentUsers: 0,
            enabledFeatures: {},
            storageLimit: BigInt(1000000000),
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
            planType: 'enterprise',
            subscriptionStartsAt: now,
            subscriptionEndsAt: tenantConfig.subscriptionEndsAt,
            gracePeriodEnabled: false,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      // Create admin user in tenant
      const hashedPassword = await hashPassword(tenantConfig.userPassword);

      // Upsert user (find by email + tenantId)
      const existingUser = await prisma.user.findFirst({
        where: { email: tenantConfig.userEmail, tenantId: tenant.id },
      });

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            firstName: 'Test',
            lastName: 'User',
            role: 'admin',
            isActive: true,
            updatedAt: now,
          },
        });
      } else {
        await prisma.user.create({
          data: {
            email: tenantConfig.userEmail,
            password: hashedPassword,
            firstName: 'Test',
            lastName: 'User',
            role: 'admin',
            isActive: true,
            tenantId: tenant.id,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      // Ensure a SAM context pack exists for SAM-enabled tenants to avoid org profile gating in tests
      if (tenantConfig.entitlements.sam) {
        const existingPack = await prisma.tenantContextPack.findFirst({
          where: { tenantId: tenant.id },
        });
        if (!existingPack) {
          const contextPack = buildDefaultContextPack({
            tenantId: tenant.id,
            orgTypeId: 'custom:hospital',
            orgTypeNameSnapshot: 'Hospital',
            sectorSnapshot: 'healthcare',
            countryCode: 'SA',
            status: 'ACTIVE',
          });
          await prisma.tenantContextPack.create({
            data: contextPack as unknown as Prisma.InputJsonValue as any,
          });
        }
      }

      seededData.tenants.push({
        tenantId: tenantConfig.tenantId,
        name: tenantConfig.name,
        status: tenantConfig.status,
      });

      seededData.users.push({
        email: tenantConfig.userEmail,
        password: tenantConfig.userPassword,
        tenantId: tenantConfig.tenantId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Test data seeded successfully',
      data: seededData,
    });
  } catch (error) {
    logger.error('Test seed error', { category: 'api', error });
    throw error;
  }
});
