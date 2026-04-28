import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { statusRank } from '@/lib/er/stateMachine';
import { ER_STATUSES } from '@/lib/er/constants';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { ER_HANDOFF_CLOSED_ERROR, getAdmissionHandoffByEncounterId } from '@/lib/er/handoff';
import { validateErEncounterTransition } from '@/lib/clinical/encounterStateEngine';
import { validateDisposition } from '@/lib/er/disposition';
import { validateTriageCompletionInput } from '@/lib/er/triage';
import { validateBody } from '@/lib/validation/helpers';
import { erEncounterStatusSchema } from '@/lib/validation/er.schema';
import type { ErBedState, ErStaffAssignmentRole, Prisma } from '@prisma/client';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const requestId =
    req.headers.get('x-request-id') ||
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-amzn-trace-id');

  if (Object.prototype.hasOwnProperty.call(body || {}, 'visitNumber')) {
    return NextResponse.json({ error: 'visitNumber is immutable' }, { status: 409 });
  }

  const v = validateBody(body, erEncounterStatusSchema);
  if ('error' in v) return v.error;
  const encounterId = v.data.encounterId;
  const nextStatus = v.data.status;
  if (!(ER_STATUSES as readonly string[]).includes(nextStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  // ER Exit Rule: once an admission handoff exists, ER encounter becomes read-only.
  const existingHandoff = await getAdmissionHandoffByEncounterId({ tenantId, encounterId });
  const shouldFinalize = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED'].includes(nextStatus);
  const releaseActiveBedAssignment = async () => {
    const now = new Date();
    const activeAssignment = await prisma.erBedAssignment.findFirst({
      where: { encounterId, unassignedAt: null },
    });
    if (!activeAssignment) {
      return { released: false, noOp: true };
    }
    await prisma.erBedAssignment.update({
      where: { id: activeAssignment.id },
      data: { unassignedAt: now },
    });
    const bedId = String(activeAssignment.bedId || '').trim();
    if (bedId) {
      await prisma.erBed.update({
        where: { id: bedId },
        data: { state: 'VACANT' satisfies ErBedState, updatedAt: now },
      });
    }
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'bed_assignment',
      entityId: activeAssignment.id,
      action: 'RELEASE',
      before: activeAssignment as Record<string, unknown>,
      after: { ...activeAssignment, unassignedAt: now, bedId: bedId || null } as Record<string, unknown>,
      ip,
    });
    return { released: true, bedId: bedId || null, assignmentId: activeAssignment.id };
  };
  if (existingHandoff) {
    if (String(encounter.status || '') === nextStatus) {
      if (shouldFinalize) {
        await releaseActiveBedAssignment();
      }
      return NextResponse.json({ success: true, status: encounter.status, noOp: true, handoffId: existingHandoff.id });
    }
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: existingHandoff.id }, { status: 409 });
  }

  // Idempotency: if status is already applied, return a no-op response.
  if (String(encounter.status || '') === nextStatus) {
    return NextResponse.json({ success: true, status: encounter.status, handoffId: null, noOp: true });
  }

  // VAL-01: Enforce forward-only status transitions. Reject any attempt to move
  // to a status with a lower or equal rank than the current status (except for
  // terminal statuses like CANCELLED/DEATH which are handled by ER_TRANSITIONS).
  const currentRank = statusRank(String(encounter.status || ''));
  const nextRank = statusRank(nextStatus);
  const TERMINAL_STATUSES = ['CANCELLED', 'DEATH'];
  if (
    currentRank !== -1 &&
    nextRank !== -1 &&
    nextRank <= currentRank &&
    !TERMINAL_STATUSES.includes(nextStatus)
  ) {
    return NextResponse.json(
      { error: 'Backward status transition not allowed', from: String(encounter.status || ''), to: nextStatus },
      { status: 400 }
    );
  }

  // Idempotency: repeated "seen by doctor" clicks should not error or overwrite timestamps.
  if (
    nextStatus === 'SEEN_BY_DOCTOR' &&
    (Boolean((encounter as Record<string, unknown>).seenByDoctorAt) ||
      statusRank(String(encounter.status || '')) >= statusRank('SEEN_BY_DOCTOR'))
  ) {
    return NextResponse.json({ success: true, status: encounter.status, noOp: true });
  }

  // RESULTS rule: cannot move RESULTS_PENDING -> DECISION if there are unacknowledged results
  if (encounter.status === 'RESULTS_PENDING' && nextStatus === 'DECISION') {
    const pending = await prisma.erTask.count({
      where: {
        encounterId,
        status: 'DONE',
        resultAcknowledgedAt: null,
      },
    });
    if (pending > 0) {
      return NextResponse.json(
        { error: 'Results pending acknowledgment', pendingCount: pending },
        { status: 409 }
      );
    }
  }

  let dispositionForFinalize: any | null = null;
  if (['DISCHARGED', 'ADMITTED', 'TRANSFERRED'].includes(nextStatus)) {
    dispositionForFinalize = await prisma.erDisposition.findFirst({ where: { encounterId } });
  }
  const triageDoc = nextStatus === 'TRIAGE_COMPLETED' ? await prisma.erTriageAssessment.findFirst({ where: { encounterId } }) : null;
  const transitionCheck = validateErEncounterTransition({
    encounter,
    nextStatus,
    statusOrder: ER_STATUSES,
    triageDoc,
    dispositionDoc: dispositionForFinalize,
    validateDisposition,
    validateTriageCompletionInput,
  });
  if (!transitionCheck.ok) {
    const err = transitionCheck as { ok: false; error: { status: number; body: any } };
    return NextResponse.json(err.error.body, { status: err.error.status });
  }

  const now = new Date();
  const patch: any = { status: nextStatus, updatedAt: now };
  let createdHandoffId: string | null = null;

  // Lightweight timestamps for doctor flow
  if (nextStatus === 'SEEN_BY_DOCTOR') {
    // Auto-assign current user as PRIMARY_DOCTOR if none exists
    const existingPrimaryDoctor = await prisma.erStaffAssignment.findFirst({
      where: {
        encounterId,
        role: 'PRIMARY_DOCTOR' satisfies ErStaffAssignmentRole,
        unassignedAt: null,
      },
    });
    if (!existingPrimaryDoctor) {
      const assignment = {
        id: uuidv4(),
        encounterId,
        userId,
        role: 'PRIMARY_DOCTOR' satisfies ErStaffAssignmentRole,
        assignedAt: now,
        unassignedAt: null,
      };
      try {
        await prisma.erStaffAssignment.create({ data: assignment as any });
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
        await writeErAuditLog({
          tenantId,
          userId,
          entityType: 'staff_assignment',
          entityId: assignment.id,
          action: 'ASSIGN_PRIMARY_DOCTOR',
          before: null,
          after: assignment,
          ip,
        });
      } catch (err: unknown) {
        // If a concurrent request assigned PRIMARY_DOCTOR first, treat as no-op.
        const { isPrismaDuplicateKeyError } = require('@/lib/er/identifiers');
        if (!isPrismaDuplicateKeyError(err)) {
          throw err;
        }
      }
    }

    patch.seenByDoctorAt = now;
    patch.seenByDoctorUserId = userId;
  }
  if (nextStatus === 'ORDERS_IN_PROGRESS') patch.ordersStartedAt = now;
  if (nextStatus === 'RESULTS_PENDING') patch.resultsPendingAt = now;
  if (nextStatus === 'DECISION') patch.decisionAt = now;

  // Optimistic concurrency: only update if status hasn't changed
  const updateResult = await prisma.erEncounter.updateMany({
    where: { tenantId, id: encounterId, status: encounter.status },
    data: patch as Prisma.ErEncounterUpdateManyMutationInput,
  });
  if (updateResult.count === 0) {
    const current = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
    if (current && String(current.status || '') === nextStatus) {
      return NextResponse.json({ success: true, status: current.status, handoffId: null, noOp: true });
    }
    return NextResponse.json({ error: 'Encounter status changed concurrently' }, { status: 409 });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  const dispositionType = dispositionForFinalize?.type || null;
  const dispositionReason =
    dispositionForFinalize?.type === 'ADMIT'
      ? dispositionForFinalize?.reasonForAdmission || null
      : dispositionForFinalize?.type === 'TRANSFER'
      ? dispositionForFinalize?.reason || null
      : dispositionForFinalize?.type === 'DISCHARGE'
      ? dispositionForFinalize?.finalDiagnosis || null
      : null;
  await writeErAuditLog({
    tenantId,
    userId,
    actorId: userId,
    entityType: 'encounter',
    entityId: encounterId,
    action: 'UPDATE',
    before: encounter as unknown as Record<string, unknown>,
    after: { ...encounter, ...patch } as Record<string, unknown>,
    ip,
    fromStatus: String(encounter.status || ''),
    toStatus: nextStatus,
    dispositionType,
    dispositionReason,
    requestId,
  });

  if (nextStatus === 'SEEN_BY_DOCTOR') {
    await writeErAuditLog({
      tenantId,
      userId,
      actorId: userId,
      entityType: 'encounter',
      entityId: encounterId,
      action: 'SEEN_BY_DOCTOR',
      before: { status: encounter.status, seenByDoctorAt: (encounter as Record<string, unknown>).seenByDoctorAt || null },
      after: { status: nextStatus, seenByDoctorAt: patch.seenByDoctorAt },
      ip,
      fromStatus: String(encounter.status || ''),
      toStatus: nextStatus,
      requestId,
    });
  }

  // Admission Bridge: create immutable admission handoff on Finalize ADMIT/TRANSFER.
  if (nextStatus === 'ADMITTED' || nextStatus === 'TRANSFERRED') {
    try {
      const patient = await prisma.patientMaster.findFirst({
        where: { tenantId, id: encounter.patientId },
        select: { id: true, mrn: true, fullName: true },
      });

      const triageDoc = await prisma.erTriageAssessment.findFirst({
        where: { encounterId },
        select: { id: true, vitals: true, triageEndAt: true },
      });

      const latestHandover = await prisma.erNursingHandover.findFirst({
        where: { tenantId, encounterId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, shiftType: true, handoverNotes: true, createdAt: true, fromNurseId: true },
      });
      const nursingSummary = latestHandover
        ? {
            type: latestHandover.shiftType,
            situation: '',
            background: '',
            assessment: '',
            recommendation: '',
            createdAt: latestHandover.createdAt,
            nurseId: latestHandover.fromNurseId,
          }
        : null;

      const latestDoctorAP = await prisma.erDoctorNote.findFirst({
        where: { encounterId, noteType: 'ASSESSMENT_PLAN' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, freeText: true, createdAt: true, authorId: true },
      });
      const doctorSummary = latestDoctorAP
        ? { noteId: latestDoctorAP.id, content: latestDoctorAP.freeText || '', createdAt: latestDoctorAP.createdAt, doctorId: latestDoctorAP.authorId }
        : null;

      const pendingTasks = await prisma.erTask.findMany({
        where: { encounterId, status: { in: ['ORDERED', 'IN_PROGRESS'] } },
        select: { id: true, title: true, taskType: true, status: true, createdAt: true },
        take: 200,
      });

      const pendingResults = await prisma.erTask.findMany({
        where: {
          encounterId,
          status: 'DONE',
          resultAcknowledgedAt: null,
        },
        select: { id: true, title: true, taskType: true, completedAt: true },
        take: 200,
      });

      const hasOpenEscalation = (await prisma.erEscalation.count({ where: { encounterId, status: 'OPEN' } })) > 0;
      const text = `${String(encounter.chiefComplaint || '')} ${String((triageDoc as Record<string, unknown> | null)?.notes || '')}`.toLowerCase();
      const sepsisSuspected =
        text.includes('sepsis') || pendingTasks.some((t) => String((t as Record<string, unknown>).orderSetKey || '').toUpperCase() === 'SEPSIS');

      const handoff = {
        id: uuidv4(),
        tenantId,
        erEncounterId: encounterId,
        fromDepartment: 'ER',
        toDepartment: nextStatus === 'ADMITTED' ? 'IPD' : 'TRANSFER',
        patientSummary: JSON.stringify({
          id: patient?.id || null,
          fullName: patient?.fullName || null,
          mrn: patient?.mrn || null,
        }),
        diagnosis: dispositionForFinalize?.finalDiagnosis || null,
        handoverNotes: JSON.stringify({
          reasonForAdmission:
            nextStatus === 'ADMITTED'
              ? (dispositionForFinalize?.reasonForAdmission || null)
              : (dispositionForFinalize?.reason || null),
          doctorSummary,
          nursingSummary,
          pendingTasks,
          pendingResults,
          riskFlags: {
            sepsisSuspected,
            hasOpenEscalation,
            criticalTriage: Boolean((triageDoc as Record<string, unknown> | null)?.critical),
          },
        }),
        handedOverBy: userId,
        createdAt: now,
      };
      createdHandoffId = handoff.id;

      await prisma.erAdmissionHandover.create({ data: handoff as Prisma.ErAdmissionHandoverUncheckedCreateInput });

      await writeErAuditLog({
        tenantId,
        userId,
        entityType: 'admission_handoff',
        entityId: handoff.id,
        action: 'CREATE',
        after: handoff,
        ip,
      });
    } catch (err: unknown) {
      const { isPrismaDuplicateKeyError } = require('@/lib/er/identifiers');
      if (isPrismaDuplicateKeyError(err)) {
        const existing = await getAdmissionHandoffByEncounterId({ tenantId, encounterId });
        createdHandoffId = existing?.id || createdHandoffId;
      } else {
        logger.error('Admission handoff create failed', { category: 'er', error: err });
      }
    }
  }

  if (shouldFinalize) {
    await releaseActiveBedAssignment();
  }

  return NextResponse.json({ success: true, status: nextStatus, handoffId: createdHandoffId });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.edit' }
);
