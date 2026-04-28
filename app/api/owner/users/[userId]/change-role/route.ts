import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { changeRoleSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/owner/users/[userId]/change-role
 * Change user role (owner only)
 * Allows changing thea-owner to another role for deletion purposes
 */
export const PATCH = withErrorHandler(async (
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
    const v = validateBody(body, changeRoleSchema);
    if ('error' in v) return v.error;

    const { role } = v.data;

    // Verify user exists
    const user = await prisma.user.findFirst({ where: { id: userId } });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // IMPORTANT: Never change owner role -- they are the system foundation
    const userRoleStr = String(user.role || '').toLowerCase();
    if (userRoleStr === 'thea-owner' || userRoleStr === 'thea_owner') {
      return NextResponse.json(
        { error: 'Cannot change the role of the system owner account.' },
        { status: 403 }
      );
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User role changed from ${user.role} to ${role}`,
      user: updatedUser,
    });
});
