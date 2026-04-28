import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Action = 'START' | 'COMPLETE' | 'CANCEL';

const bodySchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  action: z.enum(['START', 'COMPLETE', 'CANCEL']),
  cancelReason: z.string().optional(),
}).passthrough();

const TERMINAL = new Set(['DONE', 'CANCELLED']);

function requiredString(value: unknown): string {
  return String(value || '').trim();
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const taskId = requiredString(v.data.taskId);
  const action = v.data.action as Action;
  const cancelReason = requiredString(v.data.cancelReason);

  const task = await prisma.erTask.findFirst({ where: { tenantId, id: taskId } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const encounterId = String(task.encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Task is missing encounterId' }, { status: 400 });
  }
  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'nursing.task-status');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: unknown) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: (err as Record<string, unknown>)?.handoffId || null }, { status: 409 });
  }

  const assignment = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: 'PRIMARY_NURSE',
      unassignedAt: null,
      userId,
    },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: 'Forbidden: task is not assigned to you as Primary Nurse' },
      { status: 403 }
    );
  }

  const now = new Date();
  const taskRecord = task as Record<string, unknown>;
  const beforeMinimal = {
    status: task.status,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    cancelledAt: taskRecord.cancelledAt ?? null,
    cancelledReason: taskRecord.cancelledReason ?? null,
  };

  const patch: any = { updatedAt: now, updatedByUserId: userId };

  if (action === 'START') {
    if (String(task.status) !== 'ORDERED') {
      return NextResponse.json(
        { error: 'Invalid transition: START allowed only from ORDERED' },
        { status: 400 }
      );
    }
    patch.status = 'IN_PROGRESS';
    if (!task.startedAt) patch.startedAt = now;
  }

  if (action === 'COMPLETE') {
    if (String(task.status) !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Invalid transition: COMPLETE allowed only from IN_PROGRESS' },
        { status: 400 }
      );
    }
    patch.status = 'DONE';
    patch.completedAt = now;
  }

  if (action === 'CANCEL') {
    const current = String(task.status);
    if (!['ORDERED', 'IN_PROGRESS'].includes(current)) {
      return NextResponse.json(
        { error: 'Invalid transition: CANCEL allowed only from ORDERED or IN_PROGRESS' },
        { status: 400 }
      );
    }
    if (!cancelReason) {
      return NextResponse.json(
        { error: 'cancelReason is required when cancelling a task' },
        { status: 400 }
      );
    }
    patch.status = 'CANCELLED';
    patch.cancelledAt = now;
    patch.cancelledReason = cancelReason;
  }

  await prisma.erTask.update({
    where: { id: taskId },
    data: patch,
  });

  const afterMinimal = {
    status: patch.status ?? task.status,
    startedAt: patch.startedAt ?? task.startedAt ?? null,
    completedAt: patch.completedAt ?? task.completedAt ?? null,
    cancelledAt: patch.cancelledAt ?? taskRecord.cancelledAt ?? null,
    cancelledReason: patch.cancelledReason ?? taskRecord.cancelledReason ?? null,
  };

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'task',
    entityId: taskId,
    action,
    before: beforeMinimal,
    after: afterMinimal,
    ip,
  });

  // Preserve existing ER behavior: if all tasks in applied order sets are terminal, move to RESULTS_PENDING
  const orderSetTasks = await prisma.erTask.findMany({
    where: { tenantId, encounterId, orderSetKey: { not: null } },
    select: { orderSetKey: true, status: true },
    take: 200,
  });

  const appliedSets = Array.from(new Set(orderSetTasks.map((t) => t.orderSetKey).filter(Boolean)));
  if (appliedSets.length > 0) {
    const allTerminalBySet = appliedSets.every((setKey) => {
      const setTasks = orderSetTasks.filter((t) => t.orderSetKey === setKey);
      return setTasks.length > 0 && setTasks.every((t) => TERMINAL.has(String(t.status)));
    });

    if (allTerminalBySet && canTransitionStatus(encounter.status, 'RESULTS_PENDING')) {
      const encounterPatch = { status: 'RESULTS_PENDING' as string, updatedAt: now, resultsPendingAt: now };
      await prisma.erEncounter.update({
        where: { id: encounterId },
        data: encounterPatch as any,
      });
      await writeErAuditLog({
        tenantId,
        userId,
        entityType: 'encounter',
        entityId: encounterId,
        action: 'UPDATE',
        before: { status: encounter.status },
        after: { status: 'RESULTS_PENDING', resultsPendingAt: now },
        ip,
      });
    }
  }

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.edit' }
);
