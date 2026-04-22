import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStaffAssignmentRole } from '@prisma/client';
import { writeErAuditLog } from '@/lib/er/audit';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
}).passthrough();

function requiredString(value: any): string {
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

  const task = await prisma.erTask.findFirst({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (String(task.status) !== 'DONE') {
    return NextResponse.json({ error: 'Only DONE tasks can be acknowledged' }, { status: 409 });
  }

  const encounterId = String(task.encounterId || '');
  if (!encounterId) return NextResponse.json({ error: 'Task is missing encounterId' }, { status: 400 });
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });

  const assignment = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: ErStaffAssignmentRole.PRIMARY_DOCTOR,
      unassignedAt: null,
      userId,
    },
  });
  const isDoctorOfRecord = Boolean(assignment) || String((encounter as Record<string, unknown>).seenByDoctorUserId || '') === userId;
  if (!isDoctorOfRecord) {
    return NextResponse.json({ error: 'Forbidden: not doctor-of-record for this encounter' }, { status: 403 });
  }

  const now = new Date();
  const patch: any = {
    resultAcknowledgedAt: now,
    resultAcknowledgedByUserId: userId,
    updatedAt: now,
  };

  await prisma.erTask.update({
    where: { id: taskId },
    data: patch,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'result_ack',
    entityId: taskId,
    action: 'ACK',
    before: task as Record<string, unknown>,
    after: { ...(task as Record<string, unknown>), ...patch },
    ip,
  });

  return NextResponse.json({
    success: true,
    task: {
      id: taskId,
      encounterId,
      resultAcknowledgedAt: now,
      resultAcknowledgedByUserId: userId,
    },
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
