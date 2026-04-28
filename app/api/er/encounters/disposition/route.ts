import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import type { ErStatus } from '@prisma/client';
import { writeErAuditLog } from '@/lib/er/audit';
import { validateErEncounterTransition } from '@/lib/clinical/encounterStateEngine';
import { ER_STATUSES } from '@/lib/er/constants';
import { validateDisposition } from '@/lib/er/disposition';
import { validateTriageCompletionInput } from '@/lib/er/triage';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { validateBody } from '@/lib/validation/helpers';
import { erEncounterDispositionLegacySchema } from '@/lib/validation/er.schema';

const FINAL_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED'] as const;

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

  const v = validateBody(body, erEncounterDispositionLegacySchema);
  if ('error' in v) return v.error;
  const { encounterId, status: dispositionStatus } = v.data;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const now = new Date();
  const nextStatus = dispositionStatus;
  if (String(encounter.status || '') === nextStatus) {
    return NextResponse.json({ success: true, noOp: true });
  }
  const disposition = await prisma.erDisposition.findFirst({ where: { encounterId } });
  const transitionCheck = validateErEncounterTransition({
    encounter,
    nextStatus,
    statusOrder: ER_STATUSES,
    dispositionDoc: disposition,
    allowDecisionBridge: true,
    validateDisposition,
    validateTriageCompletionInput,
  });
  if (!transitionCheck.ok) {
    const err = transitionCheck as { ok: false; error: { status: number; body: any } };
    return NextResponse.json(err.error.body, { status: err.error.status });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  const dispositionType = disposition?.type || null;
  const dispositionReason =
    disposition?.type === 'ADMIT'
      ? disposition.reasonForAdmission || null
      : disposition?.type === 'TRANSFER'
      ? disposition.notes || null
      : disposition?.type === 'DISCHARGE'
      ? disposition.finalDiagnosis || null
      : null;

  let currentStatus = String(encounter.status || '');
  const beforeDecision = encounter;
  if (currentStatus !== 'DECISION' && canTransitionStatus(encounter.status, 'DECISION')) {
    const decisionUpdate = await prisma.erEncounter.updateMany({
      where: { tenantId, id: encounterId, status: encounter.status },
      data: { status: 'DECISION' as const, updatedAt: now },
    });
    if (decisionUpdate.count === 0) {
      const latest = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
      if (latest && String(latest.status || '') === nextStatus) {
        return NextResponse.json({ success: true, noOp: true });
      }
      return NextResponse.json({ error: 'Encounter status changed concurrently' }, { status: 409 });
    }
    await writeErAuditLog({
      tenantId,
      userId,
      actorId: userId,
      entityType: 'encounter',
      entityId: encounterId,
      action: 'UPDATE',
      before: beforeDecision as Record<string, unknown>,
      after: { ...beforeDecision, status: 'DECISION', updatedAt: now } as Record<string, unknown>,
      ip,
      fromStatus: currentStatus,
      toStatus: 'DECISION',
      dispositionType,
      dispositionReason,
      requestId,
    });
    currentStatus = 'DECISION';
  }

  const beforeFinalize =
    currentStatus === 'DECISION' ? { ...encounter, status: 'DECISION', updatedAt: now } : encounter;
  const finalizeUpdate = await prisma.erEncounter.updateMany({
    where: { tenantId, id: encounterId, status: currentStatus as ErStatus },
    data: { status: nextStatus as ErStatus, closedAt: now, updatedAt: now },
  });
  if (finalizeUpdate.count === 0) {
    const latest = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
    if (latest && String(latest.status || '') === nextStatus) {
      return NextResponse.json({ success: true, noOp: true });
    }
    return NextResponse.json({ error: 'Encounter status changed concurrently' }, { status: 409 });
  }

  await writeErAuditLog({
    tenantId,
    userId,
    actorId: userId,
    entityType: 'encounter',
    entityId: encounterId,
    action: 'UPDATE',
    before: beforeFinalize as Record<string, unknown>,
    after: { ...beforeFinalize, status: nextStatus, closedAt: now, updatedAt: now } as Record<string, unknown>,
    ip,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    dispositionType,
    dispositionReason,
    requestId,
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.disposition.update' }
);
