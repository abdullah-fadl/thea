import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { hashPassword } from '@/lib/auth';
import { validateBody } from '@/lib/validation/helpers';
import { createAdminSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
export const dynamic = 'force-dynamic';

/**
 * POST /api/owner/tenants/[tenantId]/create-admin
 * Create a tenant admin user (owner only)
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    // Verify tenant exists using Prisma
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantIdParam),
    });

    if (!tenant) {
      // Get list of available tenantIds for better error message
      const allTenants = await prisma.tenant.findMany({
        select: { tenantId: true },
        take: 10,
      });
      const availableTenantIds = allTenants
        .map(t => t.tenantId)
        .filter(Boolean);

      logger.error('Tenant not found', { category: 'api', route: 'owner/tenants/create-admin', tenantId: tenantIdParam, availableTenantIds });

      return NextResponse.json(
        {
          error: 'Tenant not found',
          message: `No tenant found with ID: ${tenantIdParam}`,
          availableTenantIds: availableTenantIds.length > 0 ? availableTenantIds : undefined,
          hint: availableTenantIds.length > 0
            ? `Available tenant IDs: ${availableTenantIds.join(', ')}`
            : 'No tenants found in database'
        },
        { status: 404 }
      );
    }

    // Check user limit
    const currentUserCount = await prisma.user.count({
      where: {
        tenantId: tenant.id,
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
      },
    });

    if (currentUserCount >= tenant.maxUsers) {
      return NextResponse.json(
        {
          error: 'User limit exceeded',
          message: `Maximum ${tenant.maxUsers} users allowed for this tenant. Current: ${currentUserCount}`
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    logger.debug('Create tenant admin request', { category: 'api', route: 'owner/tenants/create-admin' });

    const v = validateBody(body, createAdminSchema);
    if ('error' in v) return v.error;

    const { password, firstName, lastName } = v.data;
    const email = String(v.data.email).trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email, tenantId: tenant.id },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists', message: `Email ${email} is already registered` },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user via Prisma
    const adminUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'admin',
        isActive: true,
        tenantId: tenant.id,
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: 'admin',
      },
    });
});
