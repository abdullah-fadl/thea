import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureTasksWriteAllowed } from '@/lib/core/guards/tasksGuard';
import { appendTaskEvent, auditTask } from '@/lib/tasks/taskEvents';
import { canOverrideTaskAssignment } from '@/lib/tasks/taskAccess';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const taskId = String((params as any)?.taskId || '').trim();
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    reason: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const reason = String(body.reason || '').trim();
  if (!reason) {
    return NextResponse.json({ error: 'Validation failed', missing: ['reason'], invalid: [] }, { status: 400 });
  }

  const task = await prisma.clinicalTask.findFirst({
    where: { tenantId, id: taskId },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const allowed =
    (task.assignedToUserId && task.assignedToUserId === userId) ||
    canOverrideTaskAssignment(String(role || ''), user, tenantId);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const guard = await ensureTasksWriteAllowed({ tenantId, encounterCoreId: String(task.encounterCoreId || '') });
  if (guard) return guard;

  if (task.status === 'NOT_DONE') {
    return NextResponse.json({ success: true, noOp: true, task });
  }
  if (!['CLAIMED', 'IN_PROGRESS'].includes(String(task.status || ''))) {
    return NextResponse.json({ error: 'Task not in progress', currentStatus: task.status }, { status: 409 });
  }

  const now = new Date();
  const nextTask = await prisma.clinicalTask.update({
    where: { id: taskId },
    data: { status: 'NOT_DONE', notDoneReason: reason, completedAt: now },
  });

  await appendTaskEvent({
    tenantId,
    taskId,
    eventType: 'NOT_DONE',
    actorUserId: userId || null,
    payload: { previousStatus: task.status, reason },
  });
  await auditTask({
    tenantId,
    taskId,
    action: 'NOT_DONE',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { before: task, after: nextTask },
  });

  return NextResponse.json({ task: nextTask });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
