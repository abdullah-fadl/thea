import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['ack', 'resolve', 'snooze', 'assign']),
  queueType: z.string().optional(),
  sourceId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  payload: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, user, userId, role }) => {
  try {
    const body = actionSchema.parse(await req.json());
    const { action, sourceId, departmentId, queueType, payload } = body;

    const auditContext = createAuditContext(
      {
        userId,
        userRole: role,
        userEmail: user?.email,
        tenantId,
      },
      {
        ip: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        method: req.method,
        path: req.nextUrl.pathname,
      }
    );

    if (action === 'ack' || action === 'resolve' || action === 'snooze') {
      const update: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      if (action === 'ack') {
        update.status = 'IN_REVIEW';
        update.acknowledgedAt = new Date();
        update.acknowledgedBy = userId;
      }
      if (action === 'resolve') {
        update.status = 'RESOLVED';
        update.resolvedAt = new Date();
        update.resolvedBy = userId;
      }
      if (action === 'snooze') {
        const snoozeDays = typeof payload?.snoozeDays === 'number' ? payload.snoozeDays : 7;
        update.status = 'IN_REVIEW';
        update.snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000);
        update.snoozedAt = new Date();
        update.snoozedBy = userId;
      }

      const result = await prisma.integrityFinding.updateMany({
        where: { tenantId, id: sourceId, archivedAt: null },
        data: update as Prisma.InputJsonValue,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
      }

      await logAuditEvent(auditContext, `queue_item_${action}` as any, 'queue_item', {
        resourceId: sourceId,
        metadata: {
          queueType,
          departmentId,
          sourceId,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'assign') {
      const assigneeEmail = user?.email || payload?.assigneeEmail || null;
      const assigneeDisplayName = payload?.assigneeDisplayName || null;

      const update: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: userId,
        assigneeUserId: userId,
        assigneeEmail,
        assigneeDisplayName,
        assignedTo: assigneeDisplayName || assigneeEmail || userId,
      };

      const result = await prisma.documentTask.updateMany({
        where: { tenantId, id: sourceId },
        data: update as Prisma.InputJsonValue,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      await logAuditEvent(auditContext, 'queue_item_assign', 'queue_item', {
        resourceId: sourceId,
        metadata: {
          queueType,
          departmentId,
          sourceId,
          assigneeUserId: userId,
          assigneeEmail,
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to execute queue action' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.queue.manage' });
