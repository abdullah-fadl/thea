import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const resolvedParams = params instanceof Promise ? await params : params;
  const referralId = String(resolvedParams?.referralId || '');

  // [R-01] Guard: fetch referral first, validate status before accepting
  const referral = await prisma.referral.findFirst({
    where: { tenantId, id: referralId },
  });

  if (!referral) {
    return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
  }

  const currentStatus = String(referral.status || '').toUpperCase();
  if (currentStatus !== 'PENDING') {
    return NextResponse.json(
      { error: `Referral is ${currentStatus} — cannot accept`, code: 'INVALID_STATE' },
      { status: 409 }
    );
  }

  // [R-02] Guard: validate referring encounter is not closed (stale referral)
  if (referral.encounterCoreId) {
    const srcEncounter = await prisma.encounterCore.findFirst({
      where: { tenantId, id: referral.encounterCoreId },
      select: { status: true },
    });
    if (srcEncounter && String(srcEncounter.status || '').toUpperCase() === 'CLOSED') {
      return NextResponse.json(
        { error: 'Source encounter is already closed', code: 'ENCOUNTER_CLOSED' },
        { status: 409 }
      );
    }
  }

  // 1. Mark referral as ACCEPTED
  await prisma.referral.updateMany({
    where: { tenantId, id: referralId, status: 'PENDING' },
    data: { status: 'ACCEPTED', acceptedBy: userId, acceptedAt: new Date() },
  });

  // 2. Auto-create an OpdBooking so the patient appears in the receiving doctor's queue
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Same-day check: if referral was created today, patient goes directly to WAITING_DOCTOR
  const referralDate = referral.createdAt.toISOString().slice(0, 10);
  const isSameDay = referralDate === today;

  let bookingId: string | null = null;

  try {
    // Find the receiving doctor's resource.
    // toProviderId may be a user ID (new) or ClinicalInfraProvider ID (old).
    // Try direct match first, then resolve via email.
    let resource = await prisma.schedulingResource.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        resourceType: { in: ['DOCTOR', 'PROVIDER'] },
        OR: [
          { resourceRefProviderId: referral.toProviderId },
          { id: referral.toProviderId },
        ],
      },
    });

    if (!resource && referral.toProviderId) {
      // toProviderId might be a user ID — resolve via email
      const userRecord = await prisma.user.findUnique({
        where: { id: referral.toProviderId },
        select: { email: true },
      });
      if (userRecord?.email) {
        const provider = await prisma.clinicalInfraProvider.findFirst({
          where: { email: { equals: userRecord.email, mode: 'insensitive' } },
          select: { id: true },
        });
        if (provider) {
          resource = await prisma.schedulingResource.findFirst({
            where: {
              tenantId,
              status: 'ACTIVE',
              resourceType: { in: ['DOCTOR', 'PROVIDER'] },
              OR: [
                { resourceRefProviderId: provider.id },
                { id: provider.id },
              ],
            },
          });
        }
      }
    }

    const transferBilling = referral.transferBilling ?? false;

    // ── Scenario A: Transfer billing ──────────────────────────────────────────
    // Patient's invoice from the FROM-doctor's encounter carries over.
    // New booking is ACTIVE (no new payment at reception).
    // Same-day: encounter created immediately → WAITING_DOCTOR.
    //
    // ── Scenario B: New consultation fee ─────────────────────────────────────
    // Patient needs to pay a new consultation fee at reception.
    // Booking is PENDING_PAYMENT → reception sees it and collects payment first.
    // ─────────────────────────────────────────────────────────────────────────

    const bookingStatus = transferBilling ? 'ACTIVE' : 'PENDING_PAYMENT';

    const booking = await prisma.opdBooking.create({
      data: {
        tenantId,
        patientMasterId: referral.patientMasterId ?? undefined,
        clinicId: resource?.clinicId ?? undefined,
        resourceId: resource?.id ?? undefined,
        doctorId: referral.toProviderId ?? undefined,
        bookingType: 'PATIENT',
        status: bookingStatus,
        date: today,
        bookingDate: new Date(today),
        startAt: now,
        reason: referral.reason ?? undefined,
        notes: `تحويل من ${referral.fromProviderName || '—'}: ${referral.reason || ''}${
          !transferBilling ? ' — يحتاج كشفية جديدة' : ' — نقل الفاتورة'
        }`,
        specialtyCode: referral.toSpecialtyCode ?? undefined,
        isWalkIn: false,
        checkedInAt: now,
      },
    });
    bookingId = booking.id;

    if (transferBilling && isSameDay && referral.patientMasterId) {
      // ── Scenario A: Same-day transfer ──
      // Find the original invoice from the FROM-doctor's encounter and link it to the new encounter.
      const originalInvoice = referral.encounterCoreId
        ? await prisma.billingInvoice.findFirst({
            where: { tenantId, encounterCoreId: referral.encounterCoreId },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      // Fetch the original OpdEncounter for billing meta
      const originalOpdEnc = referral.encounterCoreId
        ? await prisma.opdEncounter.findFirst({
            where: { tenantId, encounterCoreId: referral.encounterCoreId },
          })
        : null;

      const encounter = await prisma.encounterCore.create({
        data: {
          tenantId,
          patientId: referral.patientMasterId,
          encounterType: 'OPD',
          status: 'ACTIVE',
          department: 'OPD',
          openedAt: now,
          createdByUserId: userId,
          sourceSystem: 'OPD',
          sourceId: bookingId,
        },
      });

      await prisma.opdEncounter.create({
        data: {
          tenantId,
          encounterCoreId: encounter.id,
          patientId: referral.patientMasterId,
          status: 'OPEN',
          arrivalState: 'IN_ROOM',
          opdFlowState: 'WAITING_DOCTOR',
          arrivalSource: 'REFERRAL',
          arrivedAt: now,
          version: 1,
          createdByUserId: userId,
          // Carry over billing context from original encounter
          ...(originalOpdEnc?.paymentStatus ? {
            paymentStatus: originalOpdEnc.paymentStatus,
            paymentServiceType: originalOpdEnc.paymentServiceType ?? undefined,
            paymentPaidAt: originalOpdEnc.paymentPaidAt ?? undefined,
            paymentAmount: originalOpdEnc.paymentAmount ?? undefined,
            paymentMethod: originalOpdEnc.paymentMethod ?? undefined,
            paymentInvoiceId: originalOpdEnc.paymentInvoiceId ?? undefined,
            paymentReference: originalOpdEnc.paymentReference ?? undefined,
          } : {}),
          billingMeta: {
            transferredFrom: referral.encounterCoreId,
            originalInvoiceId: originalInvoice?.id ?? null,
            transferNote: 'تم نقل الفاتورة من تحويل داخلي — قد يستلزم دفع فرق الاستشارة',
          } as Prisma.InputJsonValue,
        },
      });

      // Re-link the original invoice to the new encounter (so reception can see it)
      if (originalInvoice) {
        await prisma.billingInvoice.update({
          where: { id: originalInvoice.id },
          data: { encounterCoreId: encounter.id },
        });
      }

      await prisma.opdBooking.update({
        where: { id: bookingId },
        data: { encounterCoreId: encounter.id },
      });

    } else if (!transferBilling) {
      // ── Scenario B: No transfer — booking stays PENDING_PAYMENT ──
      // Reception will collect a new consultation fee.
      // No encounter is created here — created when reception checks in.
      // The booking notes tell reception this is a referral needing new payment.
      // Nothing to do: booking is already PENDING_PAYMENT.
    } else if (transferBilling && !isSameDay && referral.patientMasterId) {
      // ── Scenario A: Different day — transfer billing but patient comes later ──
      // Don't create encounter now; when patient arrives, check-in route will create it.
      // But we need to flag the booking so check-in knows to skip nursing.
      await prisma.opdBooking.update({
        where: { id: bookingId },
        data: {
          notes: `تحويل من ${referral.fromProviderName || '—'}: ${referral.reason || ''} — نقل الفاتورة (مريض لم يصل بعد)`,
        },
      });
    }
  } catch (e) {
    // Booking/encounter creation failure is non-fatal — referral acceptance already succeeded
    logger.error('[accept] Booking/encounter creation error', { category: 'api', error: e instanceof Error ? e : undefined });
  }

  // 3. Notify the referring doctor
  if (referral.fromProviderId) {
    await prisma.notification.create({
      data: {
        tenantId,
        recipientUserId: referral.fromProviderId,
        recipientType: 'user',
        type: 'in-app',
        kind: 'ALERT',
        scope: 'OPD',
        title: 'تم قبول التحويل',
        message: `تم قبول تحويل ${referral.patientName} بواسطة ${referral.toProviderName || 'الطبيب المُستقبِل'}`,
        status: 'OPEN',
        metadata: { referralId, bookingId } as Prisma.InputJsonValue,
      },
    });
  }

  await createAuditLog(
    'referral',
    referralId,
    'ACCEPT',
    userId || 'system',
    user?.email,
    { referralId, bookingId },
    tenantId
  );

  return NextResponse.json({ success: true, bookingId });
}, { tenantScoped: true, permissionKey: 'referral.edit' });
