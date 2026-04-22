import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureTasksWriteAllowed } from '@/lib/core/guards/tasksGuard';
import { appendTaskEvent, auditTask } from '@/lib/tasks/taskEvents';
import { canOverrideTaskAssignment } from '@/lib/tasks/taskAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const taskId = String((params as any)?.taskId || '').trim();
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
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

  if (task.status === 'DONE') {
    return NextResponse.json({ success: true, noOp: true, task });
  }
  if (!['CLAIMED', 'IN_PROGRESS'].includes(String(task.status || ''))) {
    return NextResponse.json({ error: 'Task not in progress', currentStatus: task.status }, { status: 409 });
  }

  const now = new Date();
  const nextTask = await prisma.clinicalTask.update({
    where: { id: taskId },
    data: { status: 'DONE', completedAt: now },
  });

  await appendTaskEvent({
    tenantId,
    taskId,
    eventType: 'DONE',
    actorUserId: userId || null,
    payload: { previousStatus: task.status },
  });
  await auditTask({
    tenantId,
    taskId,
    action: 'DONE',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { before: task, after: nextTask },
  });

  return NextResponse.json({ task: nextTask });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
