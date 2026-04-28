import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';
import { assignUsersSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/owner/tenants/[tenantId]/assign-users
 * Assign existing users to a tenant (owner only)
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

    // Verify tenant exists
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantIdParam) });
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const v = validateBody(body, assignUsersSchema);
    if ('error' in v) return v.error;

    const { userIds } = v.data;

    // Get current user count for this tenant (excluding thea-owner)
    const currentUserCount = await prisma.user.count({
      where: {
        tenantId: tenant.id,
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
      },
    });

    // Validate each user exists, is not thea-owner, and can be assigned
    const usersToAssign: any[] = [];
    const usersToSkip: string[] = [];

    for (const userId of userIds) {
      const user = await prisma.user.findFirst({ where: { id: userId } });

      if (!user) {
        return NextResponse.json(
          { error: `User not found: ${userId}` },
          { status: 404 }
        );
      }

      // IMPORTANT: Never assign thea-owner
      const roleStr = String(user.role || '').toLowerCase();
      if (roleStr === 'thea-owner' || roleStr === 'thea_owner') {
        return NextResponse.json(
          { error: 'Cannot assign thea-owner to tenant' },
          { status: 403 }
        );
      }

      // If user is already in this tenant, skip
      if (user.tenantId === tenant.id) {
        usersToSkip.push(user.email);
        continue;
      }

      usersToAssign.push(user);
    }

    // If all users are already assigned, return early
    if (usersToAssign.length === 0) {
      return NextResponse.json(
        {
          success: true,
          assigned: 0,
          skipped: usersToSkip.length,
          message: usersToSkip.length > 0
            ? `All selected users are already assigned to this tenant.`
            : 'No users to assign.',
          tenantId: tenant.tenantId,
          userCount: currentUserCount,
          maxUsers: tenant.maxUsers,
        }
      );
    }

    // Check if assignment would exceed maxUsers limit
    const newUserCount = currentUserCount + usersToAssign.length;
    if (newUserCount > tenant.maxUsers) {
      return NextResponse.json(
        {
          error: 'User limit exceeded',
          message: `Cannot assign ${usersToAssign.length} user(s). Maximum ${tenant.maxUsers} users allowed. Current: ${currentUserCount}, Would be: ${newUserCount}`,
        },
        { status: 403 }
      );
    }

    // Assign users to tenant
    const userIdsToAssign = usersToAssign.map((u: any) => u.id);
    const result = await prisma.user.updateMany({
      where: {
        id: { in: userIdsToAssign },
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
      },
      data: {
        tenantId: tenant.id,
      },
    });

    // Get updated counts
    const updatedUserCount = await prisma.user.count({
      where: {
        tenantId: tenant.id,
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER'] } },
      },
    });

    return NextResponse.json({
      success: true,
      assigned: result.count,
      skipped: usersToSkip.length,
      tenantId: tenant.tenantId,
      userCount: updatedUserCount,
      maxUsers: tenant.maxUsers,
      message: usersToSkip.length > 0
        ? `Assigned ${result.count} user(s). ${usersToSkip.length} user(s) were already in this tenant.`
        : `Assigned ${result.count} user(s) to tenant.`,
    });
});
