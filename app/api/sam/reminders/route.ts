import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createReminderSchema = z.object({
  type: z.enum(['POLICY_REVIEW', 'AUDIT_OVERDUE', 'COMPLIANCE_DEADLINE', 'RISK_REVIEW']),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  title: z.string().min(1),
  message: z.string().optional(),
  recipientId: z.string().optional(),
  recipientEmail: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

const updateReminderSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'SENT', 'ACKNOWLEDGED', 'DISMISSED']).optional(),
});

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type');
      const status = searchParams.get('status');
      const myOnly = searchParams.get('myOnly') === '1';
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');

      const where: Record<string, unknown> = { tenantId };
      if (type) where.type = type;
      if (status) where.status = status;
      if (myOnly) where.recipientId = userId;

      const [reminders, total] = await Promise.all([
        prisma.samReminder.findMany({
          where,
          orderBy: { dueDate: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.samReminder.count({ where }),
      ]);

      return NextResponse.json({
        reminders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Reminders list error:', { error });
      return NextResponse.json({ error: 'Failed to list reminders' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, createReminderSchema);
      if ('error' in v) return v.error;

      const reminder = await prisma.samReminder.create({
        data: {
          tenantId,
          ...v.data,
          dueDate: v.data.dueDate ? new Date(v.data.dueDate) : null,
        },
      });

      return NextResponse.json({ reminder }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Reminder create error:', { error });
      return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const v = validateBody(body, updateReminderSchema);
      if ('error' in v) return v.error;

      const { id, ...updates } = v.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'SENT') updateData.sentAt = new Date();
        if (updates.status === 'ACKNOWLEDGED') updateData.acknowledgedAt = new Date();
      }

      const result = await prisma.samReminder.updateMany({
        where: { tenantId, id },
        data: updateData,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Reminder update error:', { error });
      return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);
