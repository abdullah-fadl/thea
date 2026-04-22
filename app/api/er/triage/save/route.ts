import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStatus } from '@prisma/client';
import { calculateTriageLevel } from '@/lib/er/triage';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { validateBody } from '@/lib/validation/helpers';
import { triageSaveSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
  const body = await req.json();

  if (Object.prototype.hasOwnProperty.call(body || {}, 'visitNumber')) {
    return NextResponse.json({ error: 'visitNumber is immutable' }, { status: 409 });
  }

  const v = validateBody(body, triageSaveSchema);
  if ('error' in v) return v.error;
  const { encounterId } = v.data;

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: encounterId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  const finalBlock = getFinalStatusBlock(encounter.status, 'triage.save');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }

  const vitals = {
    BP: body.vitals?.BP || null,
    HR: body.vitals?.HR ?? null,
    RR: body.vitals?.RR ?? null,
    TEMP: body.vitals?.TEMP ?? null,
    SPO2: body.vitals?.SPO2 ?? null,
    systolic: body.vitals?.systolic ?? null,
    diastolic: body.vitals?.diastolic ?? null,
  };

  const calc = calculateTriageLevel(
    {
      systolic: body.vitals?.systolic ?? null,
      diastolic: body.vitals?.diastolic ?? null,
      hr: body.vitals?.HR ?? null,
      rr: body.vitals?.RR ?? null,
      temp: body.vitals?.TEMP ?? null,
      spo2: body.vitals?.SPO2 ?? null,
    },
    body.painScore ?? null
  );

  const existing = await prisma.erTriageAssessment.findUnique({ where: { encounterId } });
  const now = new Date();

  const triageDoc: any = {
    ...(existing || { id: uuidv4(), encounterId }),
    nurseId: userId,
    painScore: body.painScore ?? null,
    vitals,
    allergiesShort: body.allergiesShort ?? null,
    chronicShort: body.chronicShort ?? null,
    triageStartAt: existing?.triageStartAt || now,
    triageEndAt: existing?.triageEndAt ?? null,
    aiSuggestedLevel: null,
    notes: body.historyNotes ?? (existing as Record<string, unknown>)?.notes ?? null,
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
    chiefComplaint: body.chiefComplaint ?? encounter.chiefComplaint ?? null,
    updatedAt: now,
  };
  if (canTransitionStatus(encounter.status, ErStatus.TRIAGE_IN_PROGRESS)) {
    encounterUpdate.status = 'TRIAGE_IN_PROGRESS';
  }

  await prisma.erEncounter.update({
    where: { id: encounterId },
    data: encounterUpdate as Record<string, unknown>,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'triage',
    entityId: encounterId,
    action: existing ? 'UPDATE' : 'CREATE',
    before: existing || null,
    after: triageDoc,
    ip,
  });

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
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.triage.edit' }
);
