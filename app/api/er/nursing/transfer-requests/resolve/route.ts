import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ResolveAction = 'APPROVE' | 'REJECT' | 'CANCEL';

const bodySchema = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  requestId: z.string().min(1, 'requestId is required'),
  action: z.enum(['APPROVE', 'REJECT', 'CANCEL']),
  newPrimaryNurseUserId: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: user?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterId = String(v.data.encounterId).trim();
  const requestId = String(v.data.requestId).trim();
  const action = v.data.action as ResolveAction;
  const newPrimaryNurseUserId = String(v.data.newPrimaryNurseUserId || '').trim();
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: unknown) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: (err as Record<string, unknown>)?.handoffId || null }, { status: 409 });
  }
  if (!['APPROVE', 'REJECT', 'CANCEL'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (action === 'APPROVE' && !newPrimaryNurseUserId) {
    return NextResponse.json({ error: 'newPrimaryNurseUserId is required for APPROVE' }, { status: 400 });
  }

  const reqDoc = await prisma.erNursingTransferRequest.findFirst({
    where: { tenantId, encounterId, id: requestId },
  });
  if (!reqDoc) {
    return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
  }
  if (reqDoc.status !== 'OPEN') {
    return NextResponse.json({ error: 'Transfer request is not OPEN' }, { status: 400 });
  }

  const now = new Date();
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');

  if (action === 'CANCEL') {
    await prisma.erNursingTransferRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', resolvedAt: now, resolvedByUserId: userId, resolution: 'CANCEL' },
    });
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'nursing_transfer_request',
      entityId: requestId,
      action: 'CANCEL',
      before: { status: reqDoc.status },
      after: { status: 'CANCELLED' },
      ip,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'REJECT') {
    await prisma.erNursingTransferRequest.update({
      where: { id: requestId },
      data: { status: 'RESOLVED', resolvedAt: now, resolvedByUserId: userId, resolution: 'REJECT' },
    });
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'nursing_transfer_request',
      entityId: requestId,
      action: 'REJECT',
      before: { status: reqDoc.status },
      after: { status: 'RESOLVED' },
      ip,
    });
    return NextResponse.json({ success: true });
  }

  // APPROVE: resolve request + transfer assignment
  const current = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: 'PRIMARY_NURSE',
      unassignedAt: null,
    },
  });

  // Resolve request first (still no assignment change yet)
  await prisma.erNursingTransferRequest.update({
    where: { id: requestId },
    data: {
      status: 'RESOLVED',
      resolvedAt: now,
      resolvedByUserId: userId,
      resolution: 'APPROVE',
      newPrimaryNurseUserId,
    } as any,
  });
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nursing_transfer_request',
    entityId: requestId,
    action: 'RESOLVE',
    before: { status: reqDoc.status },
    after: { status: 'RESOLVED', newPrimaryNurseUserId },
    ip,
  });

  // End current assignment (if any)
  if (current?.id) {
    await prisma.erStaffAssignment.update({
      where: { id: current.id },
      data: { unassignedAt: now },
    });
  }

  // Create new assignment
  const newAssignment = {
    id: uuidv4(),
    encounterId,
    userId: newPrimaryNurseUserId,
    role: 'PRIMARY_NURSE',
    assignedAt: now,
    unassignedAt: null as Date | null,
  };
  await prisma.erStaffAssignment.create({ data: newAssignment as any });

  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nurse_assignment',
    entityId: newAssignment.id,
    action: 'TRANSFER_PRIMARY_NURSE',
    before: { primaryNurseUserId: current?.userId || null },
    after: { primaryNurseUserId: newPrimaryNurseUserId },
    ip,
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.manage' }
);
