/**
 * SCM Notifications API
 *
 * GET  /api/imdad/notifications — List user's notifications with pagination & unread count
 * POST /api/imdad/notifications — Create / send a notification
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { sendImdadNotification } from '@/lib/imdad/notifications';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List notifications for the current user
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.string().optional(),
  severity: z.string().optional(),
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  category: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        params[k] = v;
      });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, type, severity, isRead, category } = parsed;

      const where: Record<string, unknown> = {
        tenantId,
        userId,
        isDeleted: false,
      };
      if (type) where.type = type;
      if (severity) {
        // Map severity filter to priority value used in the DB
        const severityToPriority: Record<string, string> = {
          INFO: 'normal',
          WARNING: 'high',
          ERROR: 'high',
          CRITICAL: 'critical',
        };
        where.priority = severityToPriority[severity.toUpperCase()] ?? severity.toLowerCase();
      }
      if (isRead !== undefined) where.isRead = isRead;
      if (category) where.category = category;

      const [data, total, unreadCount] = await Promise.all([
        prisma.imdadNotification.findMany({
          where: where as any,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadNotification.count({ where: where as any }),
        prisma.imdadNotification.count({
          where: {
            tenantId,
            userId,
            isDeleted: false,
            isRead: false,
          },
        }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      });
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
// POST — Create / send a notification
// ---------------------------------------------------------------------------

const createNotificationSchema = z.object({
  recipientUserId: z.string().uuid(),
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  titleAr: z.string().max(500).optional(),
  message: z.string().min(1),
  messageAr: z.string().optional(),
  resourceType: z.string().max(100).optional(),
  resourceId: z.string().uuid().optional(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
  channel: z.enum(['in_app', 'email', 'both']).optional(),
  actionUrl: z.string().optional(),
  category: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createNotificationSchema.parse(body);

      const result = await sendImdadNotification(tenantId, {
        recipientUserId: parsed.recipientUserId,
        type: parsed.type as any,
        title: parsed.title,
        titleAr: parsed.titleAr,
        message: parsed.message,
        messageAr: parsed.messageAr,
        resourceType: parsed.resourceType,
        resourceId: parsed.resourceId,
        severity: parsed.severity,
        channel: parsed.channel,
        actionUrl: parsed.actionUrl,
        category: parsed.category,
        organizationId: parsed.organizationId,
        metadata: parsed.metadata,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'NOTIFICATION',
        resourceId: result.notification.id,
        boundedContext: 'BC9_PLATFORM',
        newData: result as any,
        request: req,
      });

      return NextResponse.json({ data: result }, { status: 201 });
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
  { platformKey: 'imdad', permissionKey: 'imdad.notifications.create' },
);
