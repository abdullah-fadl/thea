/**
 * SCM Notification Detail API
 *
 * PATCH  /api/imdad/notifications/[id] — Mark as read
 * DELETE /api/imdad/notifications/[id] — Dismiss (soft delete)
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PATCH — Mark notification as read
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  isRead: z.boolean(),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      if (!id) {
        return NextResponse.json({ error: 'Missing notification ID' }, { status: 400 });
      }

      const body = await req.json();
      const parsed = patchSchema.parse(body);

      // Verify the notification belongs to the current user
      const existing = await prisma.imdadNotification.findFirst({
        where: {
          id,
          tenantId,
          userId,
          isDeleted: false,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      const updated = await prisma.imdadNotification.update({
        where: { id },
        data: {
          isRead: parsed.isRead,
          readAt: parsed.isRead ? new Date() : null,
        },
      });

      return NextResponse.json({ data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.notifications.list' },
);

// ---------------------------------------------------------------------------
// DELETE — Dismiss notification (soft delete)
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const url = new URL(req.url);
      const id = url.pathname.split('/').pop();
      if (!id) {
        return NextResponse.json({ error: 'Missing notification ID' }, { status: 400 });
      }

      // Verify the notification belongs to the current user
      const existing = await prisma.imdadNotification.findFirst({
        where: {
          id,
          tenantId,
          userId,
          isDeleted: false,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      await prisma.imdadNotification.update({
        where: { id },
        data: {
          isDismissed: true,
          dismissedAt: new Date(),
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.notifications.list' },
);
