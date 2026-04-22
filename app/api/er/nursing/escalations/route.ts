import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { createErNotificationIfMissing } from '@/lib/er/notifications';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Urgency = 'ROUTINE' | 'URGENT';

const bodySchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  reason: z.string().min(1, 'reason is required'),
  note: z.string().optional(),
  urgency: z.string().optional(),
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

  const encounterId = requiredString(v.data.encounterId);
  const reason = requiredString(v.data.reason);
  const note = requiredString(v.data.note) || null;
  const urgencyRaw = requiredString(v.data.urgency).toUpperCase();
  const urgency: Urgency = urgencyRaw === 'URGENT' ? 'URGENT' : 'ROUTINE';
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
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
      { error: 'Forbidden: only Primary Nurse can create escalations' },
      { status: 403 }
    );
  }

  const now = new Date();
  const escalationId = uuidv4();
  const escalation = {
    id: escalationId,
    tenantId,
    encounterId,
    createdByUserId: userId,
    urgency,
    reason,
    note,
    status: 'OPEN',
    createdAt: now,
  };

  await prisma.erEscalation.create({ data: escalation as any });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'escalation',
    entityId: escalation.id,
    action: 'CREATE',
    after: escalation,
    ip,
  });

  // Notification: escalation opened (deduped per escalation id)
  await createErNotificationIfMissing({
    tenantId,
    type: 'ESCALATION_OPEN',
    encounterId,
    dedupeKey: `ESCALATION_OPEN:${encounterId}:${escalation.id}`,
    createdAt: now,
  });

  return NextResponse.json({ success: true, id: escalation.id });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.manage' }
);
