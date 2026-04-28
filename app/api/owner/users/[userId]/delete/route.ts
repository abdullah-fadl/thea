import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/owner/users/[userId]/delete
 * Delete a user completely (owner only)
 * Deletes user and sessions; anonymizes audit logs (immutable for HIPAA compliance).
 */
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = resolvedParams.userId;

    // Verify user exists
    const user = await prisma.user.findFirst({ where: { id: userId } });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // IMPORTANT: Never delete owner accounts -- they are the system foundation
    const roleStr = String(user.role || '').toLowerCase();
    if (roleStr === 'thea-owner' || roleStr === 'thea_owner') {
      return NextResponse.json(
        { error: 'Cannot delete thea-owner. Owner users cannot be deleted.' },
        { status: 403 }
      );
    }

    // Delete all user sessions
    await prisma.session.deleteMany({ where: { userId } });

    // Preserve audit logs (NEVER delete — HIPAA compliance requires immutable audit trails)
    // Mark the actor email so the deleted user's actions remain traceable
    if (user.tenantId) {
      await prisma.auditLog.updateMany({
        where: {
          tenantId: user.tenantId,
          actorUserId: userId,
        },
        data: {
          actorEmail: `[deleted] ${user.email}`,
        },
      });
    }

    // Delete the user
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({
      success: true,
      message: `User ${user.email} deleted successfully`,
      deletedUser: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
});
