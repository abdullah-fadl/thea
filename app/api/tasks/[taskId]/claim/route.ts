import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ensureTasksWriteAllowed } from '@/lib/core/guards/tasksGuard';
import { appendTaskEvent, auditTask } from '@/lib/tasks/taskEvents';
import { canClaimTasks } from '@/lib/tasks/taskAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const taskId = String((params as any)?.taskId || '').trim();
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  if (!canClaimTasks(String(role || ''), user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Look up the task first for guard check and audit trail
  const task = await prisma.clinicalTask.findFirst({
    where: { tenantId, id: taskId },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const guard = await ensureTasksWriteAllowed({ tenantId, encounterCoreId: String(task.encounterCoreId || '') });
  if (guard) return guard;

  // If already claimed by this user, return no-op
  if (task.assignedToUserId === userId && task.status === 'CLAIMED') {
    return NextResponse.json({ success: true, noOp: true, task });
  }

  // Atomic conditional update to prevent TOCTOU race condition
  const now = new Date();
  const result = await prisma.clinicalTask.updateMany({
    where: {
      id: taskId,
      tenantId,
      status: 'OPEN',
      assignedToUserId: null,
    },
    data: { status: 'CLAIMED', assignedToUserId: userId, claimedAt: now },
  });

  if (result.count === 0) {
    // Re-fetch to provide a specific error message
    const current = await prisma.clinicalTask.findFirst({ where: { id: taskId, tenantId } });
    if (current && ['DONE', 'CANCELLED', 'NOT_DONE'].includes(String(current.status || ''))) {
      return NextResponse.json({ error: 'Task is closed', currentStatus: current.status }, { status: 409 });
    }
    return NextResponse.json({ error: 'Task already claimed', code: 'TASK_ALREADY_CLAIMED' }, { status: 409 });
  }

  const nextTask = await prisma.clinicalTask.findFirst({ where: { id: taskId, tenantId } });

  await appendTaskEvent({
    tenantId,
    taskId,
    eventType: 'CLAIM',
    actorUserId: userId || null,
    payload: { previousStatus: task.status },
  });
  await auditTask({
    tenantId,
    taskId,
    action: 'CLAIM',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { before: task, after: nextTask },
  });

  return NextResponse.json({ task: nextTask });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
