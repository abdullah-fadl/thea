import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { opdEncounterStatusSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const v = validateBody(body, opdEncounterStatusSchema);
  if ('error' in v) return v.error;
  const nextStatus = v.data.status;

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Optimistic locking
  if (body._version != null && opd.version != null) {
    if (Number(body._version) !== Number(opd.version)) {
      return NextResponse.json(
        {
          error: 'Record was updated by another user. Please reload the page.',
          errorAr: 'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 }
      );
    }
  }

  const currentStatus = String(opd.status || 'OPEN').toUpperCase();
  if (currentStatus === nextStatus) {
    return NextResponse.json({ success: true, opd, noOp: true });
  }
  if (currentStatus === 'COMPLETED') {
    return NextResponse.json({ success: true, opd, noOp: true });
  }

  // Guard: prevent completing encounter if flow state hasn't reached a completable stage
  if (nextStatus === 'COMPLETED') {
    const flowState = String(opd.opdFlowState || '').trim().toUpperCase();
    const completableStates = ['IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING', 'COMPLETED'];
    if (!completableStates.includes(flowState)) {
      return NextResponse.json(
        {
          error: 'Cannot complete encounter — clinical workflow has not been fulfilled',
          errorAr: 'لا يمكن إتمام الزيارة — لم يتم إكمال المسار السريري المطلوب',
          code: 'FLOW_STATE_INCOMPLETE',
          currentFlowState: flowState || null,
          requiredFlowStates: completableStates,
        },
        { status: 422 }
      );
    }
  }

  // [P3-EHR-001 FIX] Guard: require disposition before closing/completing encounter
  if (nextStatus === 'COMPLETED' && !opd.dispositionType) {
    return NextResponse.json(
      {
        error: 'Disposition must be set before completing the encounter',
        errorAr: 'يجب تحديد وجهة المريض قبل إتمام الزيارة',
        code: 'DISPOSITION_REQUIRED',
      },
      { status: 422 }
    );
  }

  const now = new Date();
  const updatedOpd = await prisma.opdEncounter.update({
    where: { encounterCoreId },
    data: { status: nextStatus as any, version: { increment: 1 } },
  });

  // Auto-close encounter_core when COMPLETED
  if (nextStatus === 'COMPLETED') {
    await prisma.encounterCore.updateMany({
      where: { tenantId, id: encounterCoreId, status: { not: 'CLOSED' } },
      data: { status: 'CLOSED', closedAt: now, closedByUserId: userId || null },
    });

    await prisma.opdBooking.updateMany({
      where: { tenantId, encounterCoreId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', completedAt: now },
    });
  }

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    `STATUS_${nextStatus}`,
    userId || 'system',
    user?.email,
    { before: opd, after: updatedOpd },
    tenantId
  );

  return NextResponse.json({ success: true, opd: updatedOpd });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);
