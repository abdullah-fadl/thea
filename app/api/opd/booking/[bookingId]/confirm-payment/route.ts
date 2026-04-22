import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/opd/booking/[bookingId]/confirm-payment
 *
 * Reception confirms that payment has been collected for a PENDING_PAYMENT booking.
 *
 * Cases:
 * A) Booking already has an encounter (e.g. procedure mid-visit):
 *    - Mark booking ACTIVE (or COMPLETED if encounter is done)
 *    - Mark encounter paymentStatus = PAID
 *
 * B) Booking has NO encounter (referral — new consultation fee, Scenario B):
 *    - Create EncounterCore + OpdEncounter
 *    - Same-day referral → WAITING_DOCTOR (skip nursing, vitals already taken)
 *    - Different day → WAITING_NURSE (needs new vitals)
 *    - Mark booking ACTIVE and link encounter
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const bookingId = String((params as Record<string, string>)?.bookingId || '').trim();
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId, id: bookingId },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (!['PENDING_PAYMENT', 'ACTIVE'].includes(String(booking.status || ''))) {
    return NextResponse.json(
      { error: 'Booking is not in a confirmable payment status', currentStatus: booking.status },
      { status: 400 }
    );
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let encounterCoreId = String(booking.encounterCoreId || '').trim();

  // ── Case B: No encounter yet (referral new-fee scenario) ──────────────────
  if (!encounterCoreId && booking.patientMasterId) {
    // Determine if the booking was created today (same-day referral → skip nursing)
    const bookingDate = booking.bookingDate
      ? new Date(booking.bookingDate).toISOString().slice(0, 10)
      : booking.date || '';
    const isSameDayReferral = bookingDate === today;

    const newFlowState = isSameDayReferral ? 'WAITING_DOCTOR' : 'WAITING_NURSE';

    const encounter = await prisma.$transaction(async (tx) => {
      const enc = await tx.encounterCore.create({
        data: {
          tenantId,
          patientId: booking.patientMasterId,
          encounterType: 'OPD',
          status: 'ACTIVE',
          department: 'OPD',
          openedAt: now,
          createdByUserId: userId || null,
          sourceSystem: 'OPD',
          sourceId: bookingId,
        },
      });

      await tx.opdEncounter.create({
        data: {
          tenantId,
          encounterCoreId: enc.id,
          patientId: booking.patientMasterId,
          status: 'OPEN',
          arrivalState: isSameDayReferral ? 'IN_ROOM' : 'ARRIVED',
          opdFlowState: newFlowState as any,
          arrivalSource: 'REFERRAL',
          arrivedAt: now,
          version: 1,
          createdByUserId: userId || null,
          paymentStatus: 'PAID',
          paymentPaidAt: now,
          billingMeta: booking.specialtyCode ? { specialtyCode: booking.specialtyCode } : undefined,
        },
      });

      await tx.opdBooking.update({
        where: { id: bookingId },
        data: {
          encounterCoreId: enc.id,
          status: 'ACTIVE',
          checkedInAt: now,
          updatedAt: now,
        },
      });

      return enc;
    });

    encounterCoreId = encounter.id;

    await createAuditLog(
      'opd_booking',
      bookingId,
      'CONFIRM_PAYMENT_REFERRAL',
      userId || 'system',
      user?.email,
      { newFlowState, encounterCoreId: encounter.id },
      tenantId
    );

    return NextResponse.json({ success: true, bookingId, encounterCoreId: encounter.id, flowState: newFlowState });
  }

  // ── Case A: Booking already has an encounter ──────────────────────────────
  let visitStillOpen = false;
  if (encounterCoreId) {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      select: { opdFlowState: true },
    });
    visitStillOpen = !!opd && opd.opdFlowState !== 'COMPLETED';
  }

  await prisma.opdBooking.update({
    where: { id: bookingId },
    data: visitStillOpen
      ? { status: 'ACTIVE', updatedAt: now }
      : { status: 'COMPLETED', completedAt: now, updatedAt: now },
  });

  if (encounterCoreId) {
    await prisma.opdEncounter.updateMany({
      where: { tenantId, encounterCoreId },
      data: { paymentStatus: 'PAID', paymentPaidAt: now, updatedAt: now },
    });
  }

  await createAuditLog(
    'opd_booking',
    bookingId,
    'CONFIRM_PAYMENT',
    userId || 'system',
    user?.email,
    { before: { status: 'PENDING_PAYMENT' }, after: { status: visitStillOpen ? 'ACTIVE' : 'COMPLETED', paymentStatus: 'PAID' } },
    tenantId
  );

  return NextResponse.json({ success: true, bookingId, encounterCoreId: encounterCoreId || null });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.queue.view' }
);
