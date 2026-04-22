import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const TASK_TYPES = ['Training', 'Review', 'Update', 'Other'] as const;
const TASK_STATUSES = ['Open', 'In Progress', 'Completed'] as const;

const createTaskSchema = z.object({
  taskType: z.enum(TASK_TYPES),
  dueDate: z.string().min(1, 'dueDate is required'),
  assignedTo: z.string().min(1, 'assignedTo is required'),
  title: z.string().optional(),
  assignedToUserId: z.string().optional(),
  assignedToEmail: z.string().optional(),
  assignedToDisplayName: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }, params) => {
  try {
    const routeParams = await params;
    const documentId = routeParams?.documentId as string | undefined;
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const v = validateBody(body, createTaskSchema);
    if ('error' in v) return v.error;
    const { taskType, dueDate, assignedTo, title, assignedToUserId, assignedToEmail, assignedToDisplayName } = v.data;

    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    const document: any = await prisma.policyDocument.findFirst({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        OR: [{ theaEngineId: documentId }, { id: documentId }],
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const createdAt = new Date();
    const inferredEmail =
      typeof assignedTo === 'string' && assignedTo.includes('@') ? assignedTo.trim() : undefined;
    const inferredUserId =
      typeof assignedTo === 'string' && /^[0-9a-f-]{8,}$/i.test(assignedTo.trim()) ? assignedTo.trim() : undefined;

    const task = {
      tenantId,
      documentId,
      documentTitle: document.title || document.originalFileName || document.filename || 'Untitled document',
      title: typeof title === 'string' && title.trim().length > 0 ? title.trim() : undefined,
      taskType,
      status: TASK_STATUSES[0],
      dueDate: parsedDueDate,
      assignedTo: assignedTo.trim(),
      assigneeUserId:
        typeof assignedToUserId === 'string' && assignedToUserId.trim().length > 0 ? assignedToUserId.trim() : inferredUserId,
      assigneeEmail:
        typeof assignedToEmail === 'string' && assignedToEmail.trim().length > 0 ? assignedToEmail.trim() : inferredEmail,
      assigneeDisplayName:
        typeof assignedToDisplayName === 'string' && assignedToDisplayName.trim().length > 0
          ? assignedToDisplayName.trim()
          : undefined,
      createdBy: userId,
      createdAt,
    };

    const created = await prisma.documentTask.create({ data: task as never });

    return NextResponse.json({ task: created });
  } catch (error: any) {
    logger.error('Create document task error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }, params) => {
  try {
    const routeParams = await params;
    const documentId = routeParams?.documentId as string | undefined;
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const tasks = await prisma.documentTask.findMany({
      where: { tenantId, documentId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    logger.error('List document tasks error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });
