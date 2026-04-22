import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  newPrimaryNurseUserId: z.string().min(1, 'newPrimaryNurseUserId is required'),
}).passthrough();

function requiredString(value: any): string {
  return String(value || '').trim();
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as any)?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = params || {};
  const encounterId = String((routeParams as any).encounterId || '').trim();
  if (!encounterId) return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const newPrimaryNurseUserId = requiredString(v.data.newPrimaryNurseUserId);

  const now = new Date();

  const current = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: 'PRIMARY_NURSE' as any,
      unassignedAt: null,
    },
  });

  if (current?.id && String(current.userId) === newPrimaryNurseUserId) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  if (current?.id) {
    await prisma.erStaffAssignment.update({
      where: { id: current.id },
      data: { unassignedAt: now },
    });
  }

  const newAssignment = await prisma.erStaffAssignment.create({
    data: {
      encounterId,
      userId: newPrimaryNurseUserId,
      role: 'PRIMARY_NURSE' as any,
      assignedAt: now,
      unassignedAt: null,
    } as any,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nurse_assignment',
    entityId: newAssignment.id,
    action: 'SET_PRIMARY_NURSE',
    before: { primaryNurseUserId: current?.userId || null },
    after: { primaryNurseUserId: newPrimaryNurseUserId },
    ip,
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
