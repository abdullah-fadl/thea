import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const TASK_TYPES = ['Training', 'Review', 'Update', 'Other'] as const;
const TASK_STATUSES = ['Open', 'In Progress', 'Completed'] as const;

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().min(1).optional(),
  assigneeUserId: z.string().min(1).optional(),
  assigneeEmail: z.string().min(1).optional(),
  assigneeDisplayName: z.string().min(1).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }, params) => {
  try {
    const routeParams = await params;
    const documentId = routeParams?.documentId as string | undefined;
    const taskId = routeParams?.taskId as string | undefined;
    if (!documentId || !taskId) {
      return NextResponse.json({ error: 'Document ID and task ID are required' }, { status: 400 });
    }

    const body = await req.json();
    const v = validateBody(body, updateTaskSchema);
    if ('error' in v) return v.error;
    const validated = v.data;

    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (validated.title !== undefined) updateData.title = validated.title.trim();
    if (validated.taskType !== undefined) updateData.taskType = validated.taskType;
    if (validated.status !== undefined) updateData.status = validated.status;

    if (validated.dueDate !== undefined) {
      const parsed = new Date(validated.dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
      }
      updateData.dueDate = parsed;
    }

    if (validated.assignedTo !== undefined) updateData.assignedTo = validated.assignedTo.trim();
    if (validated.assigneeUserId !== undefined) updateData.assigneeUserId = validated.assigneeUserId.trim();
    if (validated.assigneeEmail !== undefined) updateData.assigneeEmail = validated.assigneeEmail.trim();
    if (validated.assigneeDisplayName !== undefined) updateData.assigneeDisplayName = validated.assigneeDisplayName.trim();

    if (Object.keys(updateData).length <= 2) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const result = await prisma.documentTask.updateMany({
      where: { tenantId, documentId, id: taskId },
      data: updateData,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updatedTask = await prisma.documentTask.findFirst({ where: { tenantId, documentId, id: taskId } });

    return NextResponse.json({ task: updatedTask });
  } catch (error: any) {
    logger.error('Update task error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });

export const DELETE = withAuthTenant(
  withErrorHandler(async (req, { tenantId }, params) => {
  try {
    const routeParams = await params;
    const documentId = routeParams?.documentId as string | undefined;
    const taskId = routeParams?.taskId as string | undefined;
    if (!documentId || !taskId) {
      return NextResponse.json({ error: 'Document ID and task ID are required' }, { status: 400 });
    }

    const result = await prisma.documentTask.deleteMany({
      where: { tenantId, documentId, id: taskId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Delete task error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });
