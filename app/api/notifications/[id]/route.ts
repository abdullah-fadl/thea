import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/notifications/:id
 * Mark notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
    withErrorHandler(async (req, { user, tenantId, userId }) => {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { id } = resolvedParams;

      // Find notification with tenant isolation
      const notification = await prisma.notification.findFirst({
        where: { tenantId, id },
      });

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      // Mark as read with tenant isolation
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }),
    { tenantScoped: true, permissionKey: 'notifications.update' }
  )(request);
}
