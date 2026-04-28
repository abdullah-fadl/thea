import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';
import { moveUserSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/owner/users/[userId]/move
 * Move a user from one tenant to another (owner only)
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = resolvedParams.userId;

    // Validate request body
    const body = await request.json();
    const v = validateBody(body, moveUserSchema);
    if ('error' in v) return v.error;

    const { toTenantId } = v.data;

    // Handle unassignment (null, undefined, or empty string means remove from tenant)
    if (!toTenantId || (typeof toTenantId === 'string' && toTenantId.trim() === '')) {
      const user = await prisma.user.findFirst({ where: { id: userId } });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // IMPORTANT: Never unassign thea-owner
      const roleStr = String(user.role || '').toLowerCase();
      if (roleStr === 'thea-owner' || roleStr === 'thea_owner') {
        return NextResponse.json(
          { error: 'Cannot unassign thea-owner. Owner users are global and do not belong to tenants.' },
          { status: 403 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { tenantId: null },
      });

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fromTenantId: user.tenantId || null,
          toTenantId: null,
        },
        message: 'User unassigned from tenant',
      });
    }

    // Verify user exists
    const user = await prisma.user.findFirst({ where: { id: userId } });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // IMPORTANT: Never move thea-owner
    const roleStr = String(user.role || '').toLowerCase();
    if (roleStr === 'thea-owner' || roleStr === 'thea_owner') {
      return NextResponse.json(
        { error: 'Cannot move thea-owner. Owner users are global and do not belong to tenants.' },
        { status: 403 }
      );
    }

    // Verify target tenant exists
    const targetTenant = await prisma.tenant.findFirst({ where: tenantWhere(toTenantId) });

    if (!targetTenant) {
      return NextResponse.json(
        { error: 'Target tenant not found' },
        { status: 404 }
      );
    }

    // Get current user count for target tenant (excluding thea-owner)
    const currentUserCount = await prisma.user.count({
      where: {
        tenantId: targetTenant.id,
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
      },
    });

    // Check if move would exceed maxUsers limit
    if (user.tenantId !== targetTenant.id && currentUserCount >= targetTenant.maxUsers) {
      return NextResponse.json(
        {
          error: 'User limit exceeded',
          message: `Cannot move user to tenant ${toTenantId}. Maximum ${targetTenant.maxUsers} users allowed. Current: ${currentUserCount}`,
        },
        { status: 403 }
      );
    }

    // Move user to target tenant
    await prisma.user.update({
      where: { id: userId },
      data: { tenantId: targetTenant.id },
    });

    // Get updated counts for both source and target tenants
    const targetUserCount = await prisma.user.count({
      where: {
        tenantId: targetTenant.id,
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
      },
    });

    const sourceUserCount = user.tenantId
      ? await prisma.user.count({
          where: {
            tenantId: user.tenantId,
            NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
          },
        })
      : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fromTenantId: user.tenantId || null,
        toTenantId,
      },
      sourceTenant: user.tenantId ? {
        tenantId: user.tenantId,
        userCount: sourceUserCount,
      } : null,
      targetTenant: {
        tenantId: toTenantId,
        userCount: targetUserCount,
        maxUsers: targetTenant.maxUsers,
      },
    });
});
