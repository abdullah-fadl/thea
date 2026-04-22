import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, getAggregatedTenantData } from '@/lib/core/owner/separation';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { validateBody } from '@/lib/validation/helpers';
import { updateTenantSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/tenants/[tenantId]
 * Get tenant details (owner only)
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantIdParam),
    });

    if (!tenant) {
      logger.error('Tenant not found', { category: 'api', route: 'owner/tenants/GET', tenantId: tenantIdParam });
      return NextResponse.json(
        { error: 'Tenant not found', message: `No tenant found with ID: ${tenantIdParam}` },
        { status: 404 }
      );
    }

    // Use the actual tenantId from the found tenant (important for subsequent queries)
    const tenantId = tenant.tenantId || tenantIdParam;

    // Get aggregated tenant data (owner-only)
    const aggregatedData = await getAggregatedTenantData(tenantId);

    if (!aggregatedData) {
      return NextResponse.json(
        { error: 'Tenant not found', message: `No tenant found with ID: ${tenantIdParam}` },
        { status: 404 }
      );
    }

    // Get users from Prisma for management purposes
    let userCount = 0;
    let assignedUsers: any[] = [];
    let availableUsers: any[] = [];

    try {
      // Get user count (excluding THEA_OWNER)
      userCount = await prisma.user.count({
        where: {
          tenantId: tenant.id,
          NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
        },
      });

      // Get assigned users (excluding THEA_OWNER)
      const assignedUsersRaw = await prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
        },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true,
        },
        take: 100,
      });
      assignedUsers = assignedUsersRaw;

      // Get available users (users that can be assigned to this tenant)
      availableUsers = await prisma.user.findMany({
        where: {
          NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
          OR: [
            { tenantId: null },
            { NOT: { tenantId: tenant.id } },
          ],
        },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, isActive: true,
        },
        take: 100,
      });
    } catch (error) {
      logger.warn('Error getting users for tenant', { category: 'api', tenantId, error });
    }

    // Resolve organization type name (avoid showing UUID in UI)
    let orgTypeName: string | null = null;
    if (tenant.orgTypeId) {
      try {
        const orgType = await prisma.organizationType.findUnique({
          where: { id: tenant.orgTypeId },
          select: { name: true },
        });
        orgTypeName = orgType?.name ?? null;
      } catch {
        // ignore
      }
    }

    // Return aggregated data with users for management
    return NextResponse.json({
      tenant: {
        ...aggregatedData,
        orgTypeId: tenant.orgTypeId,
        orgTypeName,
        sector: tenant.sector,
        countryCode: tenant.countryCode,
        orgTypeChangeCount: tenant.orgTypeChangeCount ?? 0,
        userCount,
        assignedUsers: assignedUsers.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
        })),
        availableUsers: availableUsers.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
        })),
      },
    });
});

/**
 * PATCH /api/owner/tenants/[tenantId]
 * Update tenant (owner only)
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    // IMPORTANT: Never modify the owner tenant -- it is the system foundation
    if (tenantIdParam === 'thea-owner-dev') {
      return NextResponse.json(
        { error: 'Cannot modify the system owner tenant.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    if ('orgTypeDraftPayload' in body) {
      return NextResponse.json(
        { error: 'Organization type draft updates are not supported on existing tenants' },
        { status: 400 }
      );
    }
    const v = validateBody(body, updateTenantSchema);
    if ('error' in v) return v.error;

    const data = v.data;
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantIdParam),
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if ('orgTypeId' in body || 'sector' in body || 'countryCode' in body) {
      return NextResponse.json(
        { error: 'Organization type is locked after creation' },
        { status: 403 }
      );
    }

    const updateData: Parameters<typeof prisma.tenant.update>[0]['data'] = {
      updatedBy: userId,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status.toUpperCase() as 'ACTIVE' | 'BLOCKED';
    if (data.planType !== undefined) updateData.planType = data.planType.toUpperCase() as 'DEMO' | 'ENTERPRISE' | 'PAID';
    if (data.subscriptionEndsAt !== undefined) {
      updateData.subscriptionEndsAt = data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : null;
    }
    if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
    if (data.entitlements !== undefined) {
      if (data.entitlements.sam !== undefined) updateData.entitlementSam = data.entitlements.sam;
      if (data.entitlements.health !== undefined) updateData.entitlementHealth = data.entitlements.health;
      if (data.entitlements.edrac !== undefined) updateData.entitlementEdrac = data.entitlements.edrac;
      if (data.entitlements.cvision !== undefined) updateData.entitlementCvision = data.entitlements.cvision;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: updateData,
    });

    // Sync subscriptionContract when date or status changes
    const contractSyncData: Record<string, any> = { updatedAt: new Date() };
    if (data.subscriptionEndsAt !== undefined) {
      contractSyncData.subscriptionEndsAt = data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : null;
      // Extending the date implies reactivating — reset status to active
      if (data.subscriptionEndsAt && new Date(data.subscriptionEndsAt) > new Date()) {
        contractSyncData.status = 'active';
      }
    }
    if (data.status !== undefined) {
      // Tenant BLOCKED → block contract too; ACTIVE → reactivate contract
      contractSyncData.status = data.status.toLowerCase() === 'blocked' ? 'blocked' : 'active';
    }
    if (Object.keys(contractSyncData).length > 1) {
      await prisma.subscriptionContract.updateMany({
        where: { tenantId: tenant.id },
        data: contractSyncData,
      });
    }

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
});

/**
 * DELETE /api/owner/tenants/[tenantId]
 * Delete tenant and all associated data (owner only)
 */
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    // IMPORTANT: Never delete the owner tenant -- it is the system foundation
    if (tenantIdParam === 'thea-owner-dev') {
      return NextResponse.json(
        { error: 'Cannot delete the system owner tenant.' },
        { status: 403 }
      );
    }

    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantIdParam),
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const tenantId = tenant.tenantId || tenantIdParam;

    logger.info('Attempting to delete tenant and all data', { category: 'api', tenantId });

    try {
      // Single server-side DO block: no round-trips, runs entirely in PostgreSQL
      // Validate UUID format strictly to prevent any injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tenant.id)) {
        return NextResponse.json({ error: 'Invalid tenant ID format' }, { status: 400 });
      }

      // Use parameterized $1 to pass tenant ID safely into the DO block
      await prisma.$executeRawUnsafe(`
        DO $$
        DECLARE
          tbl TEXT;
          tid UUID := $1::uuid;
        BEGIN
          SET LOCAL session_replication_role = 'replica';
          FOR tbl IN
            SELECT DISTINCT c.table_name
            FROM information_schema.columns c
            WHERE c.column_name = 'tenantId'
              AND c.table_schema = 'public'
              AND c.table_name != 'tenants'
          LOOP
            EXECUTE format('DELETE FROM public.%I WHERE "tenantId" = %L', tbl, tid);
          END LOOP;
          EXECUTE format('DELETE FROM public.tenants WHERE id = %L', tid);
        END $$;
      `, tenant.id);

      logger.info('Successfully deleted tenant and all data', { category: 'api', tenantId });
    } catch (deleteError: any) {
      logger.error('Failed to delete tenant', { category: 'api', tenantId, error: deleteError });
      return NextResponse.json(
        { error: 'Failed to delete tenant', message: deleteError?.message || 'Tenant could not be deleted.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant and all associated data deleted',
    });
});
