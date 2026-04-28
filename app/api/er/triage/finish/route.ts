import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { calculateTriageLevel, validateTriageCompletionInput } from '@/lib/er/triage';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { statusRank } from '@/lib/er/stateMachine';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { validateBody } from '@/lib/validation/helpers';
import { triageFinishSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'visitNumber')) {
    return NextResponse.json({ error: 'visitNumber is immutable' }, { status: 409 });
  }

  const v = validateBody(body, triageFinishSchema);
  if ('error' in v) return v.error;
  const { encounterId } = v.data;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'triage.finish');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }

  const chiefComplaint = String(body.chiefComplaint ?? encounter.chiefComplaint ?? '').trim();

  const vitalsIn = (body.vitals || {}) as Record<string, unknown>;
  const systolic = vitalsIn.systolic as number | undefined;
  const diastolic = vitalsIn.diastolic as number | undefined;
  const hr = vitalsIn.HR as number | undefined;
  const rr = vitalsIn.RR as number | undefined;
  const temp = vitalsIn.TEMP as number | undefined;
  const spo2 = vitalsIn.SPO2 as number | undefined;

  const calc = calculateTriageLevel(
    { systolic, diastolic, hr, rr, temp, spo2 },
    body.painScore ?? null
  );

  const validation = validateTriageCompletionInput({
    chiefComplaint,
    vitals: { systolic, diastolic, HR: hr, RR: rr, TEMP: temp, SPO2: spo2 },
    triageLevel: calc?.triageLevel ?? null,
  });

  if (validation.missing.length > 0) {
    return NextResponse.json(
      { error: 'Required fields missing', missing: validation.missing },
      { status: 400 }
    );
  }

  const existing = await prisma.erTriageAssessment.findUnique({ where: { encounterId } });
  const now = new Date();

  const triageEndAt = existing?.triageEndAt ? new Date(existing.triageEndAt) : null;
  const completionAt = triageEndAt && !Number.isNaN(triageEndAt.getTime()) ? triageEndAt : now;

  const triageDoc: any = {
    ...(existing || { id: uuidv4(), encounterId }),
    nurseId: userId,
    painScore: body.painScore ?? null,
    vitals: {
      BP: vitalsIn.BP || null,
      HR: hr,
      RR: rr,
      TEMP: temp,
      SPO2: spo2,
      systolic,
      diastolic,
    },
    allergiesShort: body.allergiesShort ?? (existing as Record<string, unknown> | null)?.allergiesShort ?? null,
    chronicShort: body.chronicShort ?? (existing as Record<string, unknown> | null)?.chronicShort ?? null,
    triageStartAt: existing?.triageStartAt || now,
    triageEndAt: completionAt,
    aiSuggestedLevel: null,
    notes: body.historyNotes ?? (existing as Record<string, unknown> | null)?.notes ?? null,
    createdAt: existing?.createdAt || now,
  };

  if (existing) {
    await prisma.erTriageAssessment.update({
      where: { encounterId },
      data: triageDoc,
    });
  } else {
    await prisma.erTriageAssessment.create({ data: triageDoc });
  }

  const encounterUpdate: any = {
    triageLevel: calc.triageLevel,
    chiefComplaint,
    updatedAt: now,
  };
  const currentRank = statusRank(String(encounter.status || ''));
  const completedRank = statusRank('TRIAGE_COMPLETED');
  if (String(encounter.status || '') === 'TRIAGED') {
    encounterUpdate.status = 'TRIAGE_COMPLETED';
  } else if (completedRank !== -1 && (currentRank === -1 || currentRank < completedRank)) {
    encounterUpdate.status = 'TRIAGE_COMPLETED';
  }
  // triageCompletedAt tracked via triage assessment's triageEndAt

  await prisma.erEncounter.update({
    where: { id: encounterId },
    data: encounterUpdate,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');

  const triageWasAlreadyCompleted = Boolean(existing?.triageEndAt || (existing as Record<string, unknown> | null)?.isComplete);
  if (!triageWasAlreadyCompleted) {
    await writeErAuditLog({
      tenantId,
      userId,
      entityType: 'triage',
      entityId: String(triageDoc?.id || existing?.id || ''),
      action: 'COMPLETE',
      before: existing || null,
      after: triageDoc,
      ip,
    });
  }

  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'encounter',
    entityId: encounterId,
    action: 'UPDATE',
    before: encounter,
    after: { ...encounter, ...encounterUpdate },
    ip,
  });

  return NextResponse.json({
    success: true,
    triage: triageDoc,
    triageLevel: calc.triageLevel,
    critical: calc.critical,
    reasons: calc.reasons,
    encounterStatus: encounterUpdate.status || encounter.status,
    noOp: Boolean(existing?.triageEndAt || (existing as Record<string, unknown> | null)?.isComplete),
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.triage.edit' }
);
