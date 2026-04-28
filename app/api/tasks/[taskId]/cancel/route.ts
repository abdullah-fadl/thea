import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureTasksWriteAllowed } from '@/lib/core/guards/tasksGuard';
import { appendTaskEvent, auditTask } from '@/lib/tasks/taskEvents';
import { canCancelTasks } from '@/lib/tasks/taskAccess';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const resolved = params instanceof Promise ? await params : params;
  const taskId = String((resolved as Record<string, string>)?.taskId || '').trim();
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    cancelReason: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const reason = String(body.cancelReason || '').trim();
  if (!reason) {
    return NextResponse.json({ error: 'Validation failed', missing: ['cancelReason'], invalid: [] }, { status: 400 });
  }

  if (!canCancelTasks(String(role || ''), user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const task = await prisma.clinicalTask.findFirst({
    where: { tenantId, id: taskId },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const taskRecord = task as Record<string, unknown>;
  const guard = await ensureTasksWriteAllowed({ tenantId, encounterCoreId: String(taskRecord.encounterCoreId || '') });
  if (guard) return guard;

  if (taskRecord.status === 'CANCELLED') {
    return NextResponse.json({ success: true, noOp: true, task });
  }
  if (taskRecord.status === 'DONE') {
    return NextResponse.json({ error: 'Task already done', currentStatus: taskRecord.status }, { status: 409 });
  }

  const now = new Date();
  const nextTask = await prisma.clinicalTask.update({
    where: { id: taskId },
    data: { status: 'CANCELLED', cancelReason: reason, completedAt: now },
  });

  await appendTaskEvent({
    tenantId,
    taskId,
    eventType: 'CANCEL',
    actorUserId: userId || null,
    payload: { previousStatus: taskRecord.status, reason },
  });
  await auditTask({
    tenantId,
    taskId,
    action: 'CANCEL',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { before: task, after: nextTask },
  });

  return NextResponse.json({ task: nextTask });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
