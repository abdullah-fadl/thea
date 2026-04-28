import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStaffAssignmentRole } from '@prisma/client';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId, permissions }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const canAssign = permissions.includes('er.board.view');
  if (!canAssign) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const existing = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: ErStaffAssignmentRole.PRIMARY_NURSE,
      unassignedAt: null,
    },
  });

  const before = { primaryNurseUserId: existing?.userId || null };
  if (existing?.userId) {
    return NextResponse.json({ error: 'Primary nurse already assigned', ...before }, { status: 409 });
  }

  const now = new Date();
  const assignment = {
    id: uuidv4(),
    encounterId,
    userId,
    role: ErStaffAssignmentRole.PRIMARY_NURSE,
    assignedAt: now,
    unassignedAt: null,
  };

  await prisma.erStaffAssignment.create({ data: assignment as any });

  const after = { primaryNurseUserId: userId };
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'nurse_assignment',
    entityId: assignment.id,
    action: 'ASSIGN_PRIMARY_NURSE',
    before,
    after,
    ip,
  });

  return NextResponse.json({ success: true, assignment, before, after });
}), { tenantScoped: true, platformKey: 'thea_health' }
);
