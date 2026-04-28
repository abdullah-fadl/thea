import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ER_ORDER_SETS } from '@/lib/er/orderSets';
import { v4 as uuidv4 } from 'uuid';
import { writeErAuditLog } from '@/lib/er/audit';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  setKey: z.string().min(1, 'setKey is required'),
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

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'orders.apply-set');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: unknown) {
    const handoffId = err && typeof err === 'object' && 'handoffId' in err ? (err as Record<string, unknown>).handoffId : null;
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: handoffId || null }, { status: 409 });
  }

  const body = await req.json();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;
  const setKey = String(v.data.setKey).trim();
  const orderSet = ER_ORDER_SETS.find((s) => s.key === setKey);
  if (!orderSet) {
    return NextResponse.json({ error: 'Unknown order set' }, { status: 400 });
  }

  const now = new Date();
  const newTasks = orderSet.tasks.map((t) => ({
    id: uuidv4(),
    tenantId,
    encounterId,
    taskType: t.kind,
    title: t.label,
    status: 'ORDERED',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  }));

  if (newTasks.length) {
    await prisma.erTask.createMany({ data: newTasks as any });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  for (const task of newTasks) {
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'task',
      entityId: task.id,
      action: 'CREATE',
      after: task,
      ip,
    });
  }

  // If appropriate, move encounter into ORDERS_IN_PROGRESS
  if (canTransitionStatus(encounter.status, 'ORDERS_IN_PROGRESS')) {
    const patch = { status: 'ORDERS_IN_PROGRESS' as const, updatedAt: now };
    await prisma.erEncounter.update({
      where: { id: encounterId, tenantId },
      data: patch,
    });
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'encounter',
      entityId: encounterId,
      action: 'UPDATE',
      before: encounter as Record<string, unknown>,
      after: { ...encounter, ...patch } as Record<string, unknown>,
      ip,
    });
  }

  return NextResponse.json({ success: true, created: newTasks.length });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.edit' }
);
