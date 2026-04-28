import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toText(value: any) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    noteType: z.string().min(1),
    subjective: z.string().optional(),
    objective: z.string().optional(),
    assessment: z.string().optional(),
    plan: z.string().optional(),
    freeText: z.string().optional(),
    isAddendum: z.boolean().optional(),
    addendumReason: z.string().optional(),
    _version: z.number().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  const isAddendum = body.isAddendum === true;

  if (encounterCore.status === 'CLOSED' && !isAddendum) {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Optimistic locking
  if (body._version != null && opd.version != null) {
    if (Number(body._version) !== Number(opd.version)) {
      return NextResponse.json(
        { error: 'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.', code: 'VERSION_CONFLICT' },
        { status: 409 }
      );
    }
  }

  const noteTypeRaw = String(body.noteType || '').trim().toUpperCase();
  const noteType = noteTypeRaw === 'SOAP' || noteTypeRaw === 'FREE' ? noteTypeRaw : '';
  if (!noteType) {
    return NextResponse.json({ error: 'Invalid noteType' }, { status: 400 });
  }

  const allowedStates = ['IN_DOCTOR', 'PROCEDURE_DONE_WAITING'];
  const currentState = String(opd.opdFlowState || '').trim().toUpperCase();

  if (currentState === 'COMPLETED' && isAddendum) {
    // [D-06] Use actual close time from encounterCore for 24h window
    const closeTime = encounterCore.closedAt || opd.updatedAt || opd.doctorEndAt;
    if (closeTime) {
      const hoursSinceClose = (Date.now() - new Date(closeTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceClose > 24) {
        return NextResponse.json(
          { error: 'لا يمكن إضافة ملاحظة بعد مرور 24 ساعة من إنهاء الزيارة' },
          { status: 400 }
        );
      }
    }

    const addendumReason = String(body.addendumReason || '').trim();
    if (!addendumReason) {
      return NextResponse.json({ error: 'addendumReason is required for addendum' }, { status: 400 });
    }

    const addendum = await prisma.opdDoctorAddendum.create({
      data: {
        opdEncounterId: opd.id,
        noteType: noteType as 'SOAP' | 'FREE',
        subjective: toText(body.subjective),
        objective: toText(body.objective),
        assessment: toText(body.assessment),
        plan: toText(body.plan),
        freeText: toText(body.freeText),
        reason: addendumReason,
        createdByUserId: userId || null,
      },
    });

    await prisma.opdEncounter.update({
      where: { id: opd.id },
      data: { version: { increment: 1 } },
    });

    await createAuditLog(
      'opd_encounter',
      String(opd.id || encounterCoreId),
      'OPD_DOCTOR_ADDENDUM',
      userId || 'system',
      user?.email,
      { addendum },
      tenantId
    );

    return NextResponse.json({ success: true, addendum });
  }

  if (!allowedStates.includes(currentState as string)) {
    return NextResponse.json(
      {
        error: 'Invalid opdFlowState for doctor entry',
        currentState: currentState || null,
        allowedStates,
      },
      { status: 400 }
    );
  }

  const entry = await prisma.opdDoctorEntry.create({
    data: {
      opdEncounterId: opd.id,
      noteType: noteType as 'SOAP' | 'FREE',
      subjective: toText(body.subjective),
      objective: toText(body.objective),
      assessment: toText(body.assessment),
      plan: toText(body.plan),
      freeText: toText(body.freeText),
      createdByUserId: userId || null,
    },
  });

  await prisma.opdEncounter.update({
    where: { id: opd.id },
    data: { version: { increment: 1 } },
  });

  // [D-01] Auto-record doctorStartAt on first non-addendum doctor entry
  const doctorEntryCount = await prisma.opdDoctorEntry.count({
    where: { opdEncounterId: opd.id },
  });
  if (doctorEntryCount === 1) {
    await prisma.opdEncounter.update({
      where: { id: opd.id },
      data: { doctorStartAt: new Date() },
    });
  }

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    'OPD_DOCTOR_APPEND',
    userId || 'system',
    user?.email,
    { entry },
    tenantId
  );

  return NextResponse.json({ success: true, entry });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.doctor.encounter.edit' }
);
