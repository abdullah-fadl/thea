import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureTasksWriteAllowed } from '@/lib/core/guards/tasksGuard';
import { appendTaskEvent, auditTask } from '@/lib/tasks/taskEvents';
import { emitNotificationToRole } from '@/lib/notifications/emit';
import { validateBody } from '@/lib/validation/helpers';
import { createTaskSchema } from '@/lib/validation/notifications.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let rawBody: any = {};
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(rawBody, createTaskSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = v.data.encounterCoreId;
  const title = v.data.title;
  const taskType = v.data.taskType;
  const priority = String(v.data.priority || 'ROUTINE').trim().toUpperCase();
  const idempotencyKey = v.data.idempotencyKey ? String(v.data.idempotencyKey).trim() : null;

  const guard = await ensureTasksWriteAllowed({ tenantId, encounterCoreId });
  if (guard) return guard;

  if (idempotencyKey) {
    const existing = await prisma.clinicalTask.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({ success: true, noOp: true, id: existing.id, task: existing });
    }
  }

  const now = new Date();
  const task = await prisma.clinicalTask.create({
    data: {
      tenantId,
      encounterCoreId,
      source: { system: 'manual', sourceId: uuidv4() } as any,
      taskType,
      title,
      priority,
      status: 'OPEN',
      createdAt: now,
      dueAt: v.data.dueAt ? new Date(v.data.dueAt) : null,
      assignedToUserId: null,
      claimedAt: null,
      startedAt: null,
      completedAt: null,
      notDoneReason: null,
      cancelReason: null,
      idempotencyKey: idempotencyKey || null,
      createdByUserId: userId || null,
    },
  });

  await appendTaskEvent({
    tenantId,
    taskId: task.id,
    eventType: 'CREATE',
    actorUserId: userId || null,
    payload: { source: (task as any).source, status: task.status },
  });
  await auditTask({
    tenantId,
    taskId: task.id,
    action: 'CREATE',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { after: task },
  });

  await emitNotificationToRole({
    tenantId,
    recipientRole: 'charge',
    scope: 'OPD',
    kind: 'TASK_CREATED',
    severity: 'INFO',
    title: 'New task created',
    message: task.title || 'Clinical task created',
    entity: {
      type: 'clinical_task',
      id: task.id,
      encounterCoreId,
      link: '/tasks',
      taskId: task.id,
    },
    dedupeKey: `task:${task.id}:charge`,
    actorUserId: userId || null,
    actorUserEmail: user?.email || null,
  });

  return NextResponse.json({ task });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
