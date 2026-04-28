import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErBedState, ErStatus } from '@prisma/client';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { validateBody } from '@/lib/validation/helpers';
import { erBedAssignSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeBedState(state: any): string {
  return String(state || '').trim().toUpperCase();
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  const body = await req.json();

  const v = validateBody(body, erBedAssignSchema);
  if ('error' in v) return v.error;
  const { encounterId, bedId, action } = v.data;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'bed.assignment');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId: String(encounterId) });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const bed = await prisma.erBed.findFirst({ where: { tenantId, id: bedId } });
  if (!bed) {
    return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
  }

  const now = new Date();
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');

  if ((action || 'ASSIGN') === 'UNASSIGN') {
    const activeAssignment = await prisma.erBedAssignment.findFirst({ where: { bedId, unassignedAt: null } });
    if (activeAssignment) {
      await prisma.erBedAssignment.update({
        where: { id: activeAssignment.id },
        data: { unassignedAt: now },
      });
    }
    await prisma.erBed.update({ where: { id: bedId }, data: { state: ErBedState.VACANT } });

    await writeErAuditLog({
      tenantId, userId, entityType: 'bed', entityId: bedId, action: 'UPDATE',
      before: bed, after: { ...bed, state: 'VACANT', updatedAt: now }, ip,
    });
    await writeErAuditLog({
      tenantId, userId, entityType: 'bed_assignment', entityId: activeAssignment?.id || bedId,
      action: 'UNASSIGN', before: activeAssignment || null,
      after: activeAssignment ? { ...activeAssignment, unassignedAt: now } : null, ip,
    });

    return NextResponse.json({ success: true });
  }

  const existingBedAssignment = await prisma.erBedAssignment.findFirst({ where: { bedId, unassignedAt: null } });
  const existingEncounterAssignment = await prisma.erBedAssignment.findFirst({ where: { encounterId, unassignedAt: null } });

  // Idempotent assign
  if (
    (existingBedAssignment && existingBedAssignment.encounterId === encounterId) ||
    (existingEncounterAssignment && existingEncounterAssignment.bedId === bedId)
  ) {
    return NextResponse.json({ success: true, noOp: true, assignment: existingEncounterAssignment || existingBedAssignment });
  }

  if (existingBedAssignment && existingBedAssignment.encounterId !== encounterId) {
    return NextResponse.json(
      { error: 'Bed is already assigned', bedId, encounterId: existingBedAssignment.encounterId },
      { status: 409 }
    );
  }
  const bedState = normalizeBedState(bed.state);
  if (!existingBedAssignment && bedState !== 'VACANT') {
    return NextResponse.json(
      { error: `Bed is not available (${bedState || 'UNKNOWN'})`, bedId, state: bedState || null },
      { status: 409 }
    );
  }

  // If encounter currently has a different bed, end it first (swap)
  if (existingEncounterAssignment && existingEncounterAssignment.bedId !== bedId) {
    await prisma.erBedAssignment.update({
      where: { id: existingEncounterAssignment.id },
      data: { unassignedAt: now },
    });
  }

  const assignment = {
    id: uuidv4(),
    encounterId,
    bedId,
    assignedAt: now,
    unassignedAt: null as Date | null,
    assignedByUserId: userId,
  };

  await prisma.erBedAssignment.create({ data: assignment });
  await prisma.erBed.update({ where: { id: bedId }, data: { state: ErBedState.OCCUPIED } });

  await writeErAuditLog({
    tenantId, userId, entityType: 'bed', entityId: bedId, action: 'UPDATE',
    before: bed, after: { ...bed, state: 'OCCUPIED', updatedAt: now }, ip,
  });

  if (canTransitionStatus(encounter.status, 'IN_BED')) {
    await prisma.erEncounter.update({
      where: { id: encounterId },
      data: { status: ErStatus.IN_BED, updatedAt: now },
    });
    await writeErAuditLog({
      tenantId, userId, entityType: 'encounter', entityId: encounterId, action: 'UPDATE',
      before: encounter, after: { ...encounter, status: 'IN_BED', updatedAt: now }, ip,
    });
  }

  await writeErAuditLog({
    tenantId, userId, entityType: 'bed_assignment', entityId: assignment.id,
    action: 'ASSIGN', after: assignment, ip,
  });

  return NextResponse.json({ success: true, assignment });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.beds.assign' }
);
