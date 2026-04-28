import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED = ['ORDERED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
const TERMINAL = new Set(['DONE', 'CANCELLED']);

const bodySchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  status: z.enum(['ORDERED', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, unknown>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: encounterId });
  if (deathGuard) return deathGuard;
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: unknown) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: (err as Record<string, unknown>)?.handoffId || null }, { status: 409 });
  }

  const body = await req.json();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;
  const taskId = v.data.taskId;
  const status = v.data.status;

  const task = await prisma.erTask.findFirst({ where: { tenantId, encounterId, id: taskId } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'orders.task-status');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }

  const now = new Date();
  const patch: any = { status, updatedAt: now };
  await prisma.erTask.update({
    where: { id: taskId, tenantId },
    data: patch,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'task',
    entityId: taskId,
    action: 'UPDATE',
    before: task as Record<string, unknown>,
    after: { ...task, ...patch } as Record<string, unknown>,
    ip,
  });

  // Auto state: if all tasks with an orderSetKey are terminal, move to RESULTS_PENDING
  const orderSetTasks = await prisma.erTask.findMany({
    where: {
      tenantId,
      encounterId,
      NOT: [{ taskType: null }],
    },
    select: { taskType: true, status: true },
    take: 200,
  });

  // Filter to tasks that have order set keys (non-null taskType used as proxy)
  const allTerminal = orderSetTasks.length > 0 && orderSetTasks.every((t) => TERMINAL.has(String(t.status)));

  if (allTerminal && canTransitionStatus(encounter.status, 'RESULTS_PENDING')) {
    const encounterPatch = { status: 'RESULTS_PENDING', updatedAt: now };
    await prisma.erEncounter.update({
      where: { id: encounterId, tenantId },
      data: encounterPatch as any,
    });
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'encounter',
      entityId: encounterId,
      action: 'UPDATE',
      before: encounter as Record<string, unknown>,
      after: { ...encounter, ...encounterPatch } as Record<string, unknown>,
      ip,
    });
  }

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.edit' }
);
