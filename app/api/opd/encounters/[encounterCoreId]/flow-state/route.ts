import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';

import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { isOpdFlowTransitionAllowed } from '@/lib/opd/flowState';
import type { OPDFlowState } from '@/lib/models/OPDEncounter';
import { type OpdArrivalState } from '@prisma/client';
import { sendSMS } from '@/lib/notifications/smsService';
import { opdEventBus } from '@/lib/opd/eventBus';
import { validateBody } from '@/lib/validation/helpers';
import { opdFlowStateSchema } from '@/lib/validation/opd.schema';
import { logger } from '@/lib/monitoring/logger';

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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, opdFlowStateSchema);
  if ('error' in v) return v.error;
  const { opdFlowState, _version, returnReason, completionReason } = v.data;
  const nextState = opdFlowState;

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
  if (_version != null && opd.version != null) {
    if (Number(_version) !== Number(opd.version)) {
      return NextResponse.json(
        { error: 'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.', code: 'VERSION_CONFLICT' },
        { status: 409 }
      );
    }
  }

  const currentState = String(opd.opdFlowState || '').trim().toUpperCase();
  if (currentState === nextState) {
    return NextResponse.json({ success: true, opd, noOp: true });
  }
  const transition = isOpdFlowTransitionAllowed(opd.opdFlowState, nextState as OPDFlowState);
  if (!transition.ok) {
    const allowed = transition.allowed;
    const current = transition.current === 'START' ? null : transition.current;
    return NextResponse.json(
      { error: 'Invalid opdFlowState transition', current, attempted: nextState, allowed },
      { status: 400 }
    );
  }

  const now = new Date();
  const patch: Record<string, unknown> = { opdFlowState: nextState as OPDFlowState, updatedAt: now };

  // -- Warn about pending lab/radiology orders before completing visit --
  if (nextState === 'COMPLETED' && !body.acknowledgeOpenOrders) {
    const pendingResults = await prisma.ordersHub.findMany({
      where: {
        tenantId,
        encounterCoreId,
        kind: { in: ['LAB', 'RADIOLOGY'] },
        status: { in: ['ORDERED', 'PLACED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
      select: { id: true, kind: true, orderName: true, status: true },
      take: 100,
    });
    if (pendingResults.length > 0) {
      return NextResponse.json({
        error: 'PENDING_ORDERS_WARNING',
        message: `يوجد ${pendingResults.length} طلب/طلبات معلقة (مختبر/أشعة). هل تريد إنهاء الزيارة؟`,
        messageEn: `There are ${pendingResults.length} pending order(s) (lab/radiology). Complete visit anyway?`,
        pendingOrders: pendingResults,
        requiresAcknowledgement: true,
      }, { status: 422 });
    }
  }

  // -- Require diagnosis before completing visit (skip for referral completions) --
  if (nextState === 'COMPLETED' && completionReason !== 'REFERRAL') {
    const visitNote = await prisma.opdVisitNote.findFirst({
      where: { tenantId, encounterCoreId },
      orderBy: { createdAt: 'desc' },
      select: { diagnoses: true },
    });
    const diagnoses = Array.isArray(visitNote?.diagnoses) ? visitNote.diagnoses : [];
    if (diagnoses.length === 0) {
      return NextResponse.json({
        error: 'DIAGNOSIS_REQUIRED',
        message: 'يجب إضافة تشخيص قبل إنهاء الزيارة',
        messageEn: 'A diagnosis is required before completing the visit',
      }, { status: 400 });
    }
    const hasPrimary = diagnoses.some((d) => {
      const diag = d as Record<string, unknown>;
      return diag.diagnosisType === 'PRIMARY' || diag.isPrimary === true;
    });
    if (!hasPrimary) {
      return NextResponse.json({
        error: 'PRIMARY_DIAGNOSIS_REQUIRED',
        message: 'يجب تحديد تشخيص رئيسي',
        messageEn: 'A primary diagnosis is required',
      }, { status: 400 });
    }
  }

  await prisma.opdEncounter.update({
    where: { encounterCoreId },
    data: { ...patch, version: { increment: 1 } },
  });

  // -- Auto-sync on PROCEDURE_PENDING: check if orders need payment --
  if (nextState === 'PROCEDURE_PENDING') {
    const openOrdersCount = await prisma.ordersHub.count({
      where: {
        tenantId,
        encounterCoreId,
        sourceSystem: 'OPD',
        status: { in: ['ORDERED', 'PLACED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    if (openOrdersCount > 0) {
      // Mark booking as PENDING_PAYMENT so reception sees it and collects payment before procedures
      await prisma.opdBooking.updateMany({
        where: { tenantId, encounterCoreId, status: 'ACTIVE' },
        data: { status: 'PENDING_PAYMENT', pendingPaymentAt: now, updatedAt: now },
      });
      await prisma.opdEncounter.update({
        where: { encounterCoreId },
        data: { paymentStatus: 'PENDING', updatedAt: now },
      });
    }
  }

  // -- Reset payment status when patient returns to doctor after paying --
  if (nextState === 'IN_DOCTOR' && (currentState === 'PROCEDURE_PENDING' || currentState === 'PROCEDURE_DONE_WAITING')) {
    // If payment was confirmed, booking status was already set to COMPLETED by reception
    // If still PENDING_PAYMENT, keep it (reception hasn't confirmed yet)
    // Reset paymentStatus on encounter so it doesn't show stale state
    const booking = await prisma.opdBooking.findFirst({
      where: { tenantId, encounterCoreId },
      orderBy: { updatedAt: 'desc' },
      select: { status: true },
    });
    if (booking?.status === 'PENDING_PAYMENT') {
      // Re-activate booking since patient is back with doctor
      await prisma.opdBooking.updateMany({
        where: { tenantId, encounterCoreId, status: 'PENDING_PAYMENT' },
        data: { status: 'ACTIVE', updatedAt: now },
      });
      await prisma.opdEncounter.update({
        where: { encounterCoreId },
        data: { paymentStatus: null, updatedAt: now },
      });
    }
  }

  // -- Auto-sync on COMPLETED --
  if (nextState === 'COMPLETED') {
    // 1) Close opd_encounters.status
    await prisma.opdEncounter.update({
      where: { encounterCoreId },
      data: { status: 'COMPLETED', updatedAt: now },
    });

    // 2) Close encounter_core
    await prisma.encounterCore.updateMany({
      where: { tenantId, id: encounterCoreId, status: { not: 'CLOSED' } },
      data: { status: 'CLOSED', closedAt: now, closedByUserId: userId || null },
    });

    // 3) Check if this is a referral completion with billing transfer
    //    → mark booking PENDING_PAYMENT so reception can collect the consultation fee difference
    let referralTransferBilling = false;
    if (completionReason === 'REFERRAL') {
      const outboundReferral = await prisma.referral.findFirst({
        where: { tenantId, encounterCoreId, status: { in: ['PENDING', 'ACCEPTED'] }, transferBilling: true },
        select: { id: true },
      });
      referralTransferBilling = !!outboundReferral;
    }

    // 4) Check if patient has open orders → route to PENDING_PAYMENT so reception can collect
    const openOrdersCount = await prisma.ordersHub.count({
      where: {
        tenantId,
        encounterCoreId,
        sourceSystem: 'OPD',
        status: { in: ['ORDERED', 'PLACED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    if (openOrdersCount > 0 || referralTransferBilling) {
      // Patient has pending orders or billing difference to collect → PENDING_PAYMENT at reception
      await prisma.opdBooking.updateMany({
        where: { tenantId, encounterCoreId, status: 'ACTIVE' },
        data: {
          status: 'PENDING_PAYMENT',
          pendingPaymentAt: now,
          updatedAt: now,
          ...(referralTransferBilling ? {
            notes: 'تحويل داخلي — يرجى تحصيل فرق الكشفية إن وجد',
          } : {}),
        },
      });
      await prisma.opdEncounter.update({
        where: { encounterCoreId },
        data: { paymentStatus: 'PENDING', updatedAt: now },
      });
    } else {
      // No open orders and no billing transfer → complete normally
      await prisma.opdBooking.updateMany({
        where: { tenantId, encounterCoreId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', completedAt: now, updatedAt: now },
      });
    }
  }

  // -- Auto-sync arrivalState based on flow --
  const arrivalStateMap: Record<string, string> = {
    ARRIVED: 'ARRIVED',
    WAITING_NURSE: 'ARRIVED',
    IN_NURSING: 'IN_ROOM',
    READY_FOR_DOCTOR: 'IN_ROOM',
    WAITING_DOCTOR: 'IN_ROOM',
    IN_DOCTOR: 'IN_ROOM',
    PROCEDURE_PENDING: 'IN_ROOM',
    PROCEDURE_DONE_WAITING: 'IN_ROOM',
    COMPLETED: 'LEFT',
  };
  const newArrivalState = arrivalStateMap[nextState];
  if (newArrivalState) {
    await prisma.opdEncounter.update({
      where: { encounterCoreId },
      data: { arrivalState: newArrivalState as OpdArrivalState, updatedAt: now },
    });
  }

  // -- Record return-to-nursing reason --
  if ((nextState === 'WAITING_NURSE' || nextState === 'IN_NURSING') && currentState === 'IN_DOCTOR') {
    const returnReasonText = String(returnReason || '').trim();
    const existingLog = (opd.returnToNursingLog as unknown[]) || [];
    const newEntry = {
      from: currentState,
      to: nextState,
      reason: returnReasonText || null,
      at: now,
      byUserId: userId || null,
    };
    await prisma.opdEncounter.update({
      where: { encounterCoreId },
      data: { returnToNursingLog: [...existingLog, newEntry] as any },
    });
  }

  // -- SMS Notifications --
  if (nextState === 'READY_FOR_DOCTOR' || nextState === 'COMPLETED') {
    try {
      const patientId = String(opd.patientId || encounterCore.patientId || '').trim();
      if (patientId) {
        const patient = await prisma.patientMaster.findFirst({
          where: { tenantId, id: patientId },
        });
        const mobile = String(patient?.mobile || '').trim();
        if (mobile) {
          const patientRecord = patient as Record<string, unknown>;
          const name = String(patientRecord?.firstNameAr || patient?.firstName || '');
          if (nextState === 'READY_FOR_DOCTOR') {
            await sendSMS(mobile, `${name ? name + '، ' : ''}دورك قرب! الرجاء التوجه للطبيب.\n\nYour turn is coming up. Please proceed to the doctor.\n\nThea Health`);
          } else if (nextState === 'COMPLETED') {
            await sendSMS(mobile, `${name ? name + '، ' : ''}شكراً لزيارتك. نتمنى لك السلامة.\n\nThank you for your visit. We wish you good health.\n\nThea Health`);
          }
        }
      }
    } catch (smsErr) {
      logger.error('SMS flow notification error', { category: 'opd', error: smsErr });
    }
  }

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    `OPD_FLOW_STATE_${nextState}`,
    userId || 'system',
    user?.email,
    { before: opd, after: { ...opd, ...patch } },
    tenantId
  );

  // -- Emit SSE event --
  try {
    opdEventBus.emit({
      type: 'FLOW_STATE_CHANGE',
      encounterCoreId,
      tenantId,
      data: {
        previousState: currentState,
        newState: nextState,
        patientId: encounterCore.patientId,
      },
      timestamp: now.toISOString(),
    });
  } catch {}

  return NextResponse.json({ success: true, opd: { ...opd, ...patch } });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.nursing.flow', 'opd.doctor.encounter.view'] }
);
