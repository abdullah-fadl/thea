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
  urgency: z.string().optional(),
}).passthrough();

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
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

  const encounterId = String(v.data.encounterId).trim();
  const reason = String(v.data.reason).trim();
  const urgency = (String(v.data.urgency || 'ROUTINE').trim().toUpperCase() as Urgency) || 'ROUTINE';

  if (!['ROUTINE', 'URGENT'].includes(urgency)) {
    return NextResponse.json({ error: 'urgency must be ROUTINE or URGENT' }, { status: 400 });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const dev = false;
  if (!dev) {
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
        { error: 'Forbidden: only Primary Nurse can request transfer' },
        { status: 403 }
      );
    }
  }

  const now = new Date();
  const doc = {
    id: uuidv4(),
    tenantId,
    encounterId,
    requestedByUserId: userId,
    reason,
    urgency,
    status: 'OPEN',
    createdAt: now,
  };

  await prisma.erNursingTransferRequest.create({ data: doc as any });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nursing_transfer_request',
    entityId: doc.id,
    action: 'CREATE',
    after: {
      encounterId,
      requestedByUserId: userId,
      urgency,
      status: 'OPEN',
      createdAt: now,
    },
    ip,
  });

  // Notification: transfer request opened (deduped per request id)
  await createErNotificationIfMissing({
    tenantId,
    type: 'TRANSFER_REQUEST_OPEN',
    encounterId,
    dedupeKey: `TRANSFER_REQUEST_OPEN:${encounterId}:${doc.id}`,
    createdAt: now,
  });

  return NextResponse.json({ success: true, request: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.manage' }
);
