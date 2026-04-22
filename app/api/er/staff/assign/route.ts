import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStaffAssignmentRole } from '@prisma/client';
import { ER_STAFF_ASSIGNMENT_ROLES } from '@/lib/er/constants';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { validateBody } from '@/lib/validation/helpers';
import { erStaffAssignSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  const body = await req.json();

  const v = validateBody(body, erStaffAssignSchema);
  if ('error' in v) return v.error;
  const { encounterId, userId: assignUserId, role: assignRole } = v.data;

  if (!(ER_STAFF_ASSIGNMENT_ROLES as readonly string[]).includes(assignRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
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

  const now = new Date();
  const existing = await prisma.erStaffAssignment.findFirst({
    where: { encounterId, role: assignRole as ErStaffAssignmentRole, unassignedAt: null },
  });

  if (existing) {
    await prisma.erStaffAssignment.update({
      where: { id: existing.id },
      data: { unassignedAt: now },
    });
  }

  const assignment = {
    id: uuidv4(),
    encounterId,
    userId: assignUserId,
    role: assignRole,
    assignedAt: now,
    unassignedAt: null,
  };

  await prisma.erStaffAssignment.create({ data: assignment as any });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'staff_assignment',
    entityId: assignment.id,
    action: 'ASSIGN',
    before: existing || null,
    after: assignment,
    ip,
  });

  return NextResponse.json({ success: true, assignment });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.staff.assign' }
);
