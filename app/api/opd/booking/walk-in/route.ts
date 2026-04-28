import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { normalizeOpdPaymentSnapshot } from '@/lib/opd/payment';
import { validateBody } from '@/lib/validation/helpers';
import { walkInBookingSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Creates an opd_bookings record for a walk-in patient so they
 * appear in the OPD queue (/api/opd/queue). Also marks the
 * corresponding opd_encounters record as ARRIVED.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, walkInBookingSchema);
  if ('error' in v) return v.error;
  const { patientMasterId, encounterCoreId, clinicId, resourceId, specialtyCode, chiefComplaint, priority, billingMeta } = v.data;

  const { payment } = normalizeOpdPaymentSnapshot(v.data.payment || null);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // [R-03] Auto-create encounter for walk-in if not provided
  let resolvedEncounterCoreId = encounterCoreId || null;
  if (!resolvedEncounterCoreId) {
    const newCore = await prisma.encounterCore.create({
      data: {
        tenantId,
        patientId: patientMasterId,
        encounterType: 'OPD',
        status: 'ACTIVE',
        department: 'OPD',
        openedAt: now,
        createdByUserId: userId || null,
        sourceSystem: 'OPD',
        sourceId: 'WALK_IN',
      },
    });
    resolvedEncounterCoreId = newCore.id;

    await prisma.opdEncounter.create({
      data: {
        tenantId,
        encounterCoreId: resolvedEncounterCoreId,
        patientId: patientMasterId,
        status: 'OPEN',
        arrivalState: 'ARRIVED',
        opdFlowState: 'WAITING_NURSE',
        arrivalSource: 'WALK_IN',
        arrivedAt: now,
        version: 1,
        createdByUserId: userId || null,
        ...(payment ? {
          paymentStatus: payment.status || undefined,
          paymentServiceType: payment.serviceType || undefined,
          paymentPaidAt: payment.paidAt || undefined,
          paymentAmount: payment.amount || undefined,
          paymentMethod: payment.method || undefined,
          paymentInvoiceId: payment.invoiceId || undefined,
          paymentReference: payment.reference || undefined,
        } : {}),
        billingMeta: billingMeta as Prisma.InputJsonValue || undefined,
      },
    });
  }

  const booking = await prisma.opdBooking.create({
    data: {
      tenantId,
      date: today,
      bookingType: 'PATIENT',
      status: 'ACTIVE',
      patientMasterId,
      encounterCoreId: resolvedEncounterCoreId,
      clinicId,
      resourceId,
      specialtyCode,
      chiefComplaint,
      priority,
      startAt: now,
      endAt: null,
      checkedInAt: now,
      isWalkIn: true,
      payment: (payment as unknown || undefined) as Prisma.InputJsonValue,
      billingMeta: billingMeta as Prisma.InputJsonValue || undefined,
      createdByUserId: userId || null,
    },
  });

  // Mark the opd_encounters record as ARRIVED (if encounter was pre-existing)
  if (encounterCoreId) {
    const opdPatch: Record<string, unknown> = {
      arrivalState: 'ARRIVED',
      arrivalSource: 'WALK_IN',
      arrivedAt: now,
    };
    if (payment) opdPatch.paymentStatus = payment.status || undefined;
    if (payment) opdPatch.paymentServiceType = payment.serviceType || undefined;
    if (payment) opdPatch.paymentPaidAt = payment.paidAt || undefined;
    if (payment) opdPatch.paymentAmount = payment.amount || undefined;
    if (payment) opdPatch.paymentMethod = payment.method || undefined;
    if (payment) opdPatch.paymentInvoiceId = payment.invoiceId || undefined;
    if (payment) opdPatch.paymentReference = payment.reference || undefined;
    if (billingMeta) opdPatch.billingMeta = billingMeta;

    await prisma.opdEncounter.updateMany({
      where: { tenantId, encounterCoreId },
      data: opdPatch,
    });
  }

  return NextResponse.json({ success: true, bookingId: booking.id, encounterCoreId: resolvedEncounterCoreId });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.create' }
);
