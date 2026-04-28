import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const body = await req.json();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;
  const taskId = v.data.taskId;

  const task = await prisma.erTask.findFirst({ where: { encounterId, id: taskId } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  if (task.status !== 'DONE') {
    return NextResponse.json({ error: 'Only DONE tasks can be acknowledged' }, { status: 409 });
  }

  const now = new Date();
  const patch: any = {
    resultAcknowledgedAt: now,
    resultAcknowledgedByUserId: userId,
    updatedAt: now,
  };

  await prisma.erTask.update({
    where: { id: taskId },
    data: patch as Record<string, unknown>,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'result_ack',
    entityId: taskId,
    action: 'ACK',
    before: task as Record<string, unknown>,
    after: { ...task, ...patch } as Record<string, unknown>,
    ip,
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.edit' }
);
