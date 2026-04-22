import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { OPD_VISIT_TYPES } from '@/lib/models/OPDEncounter';
import { detectVisitType } from '@/lib/opd/visitType';
import { normalizeOpdPaymentSnapshot } from '@/lib/opd/payment';
import { validateBody } from '@/lib/validation/helpers';
import { checkInBookingSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPD_VISIT_TYPE_SET = new Set<string>(OPD_VISIT_TYPES);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, checkInBookingSchema);
  if ('error' in v) return v.error;
  const { bookingId, payment: paymentInput, billingMeta: billingMetaRaw } = v.data;
  const billingMeta = (billingMetaRaw || null) as Prisma.InputJsonValue | null;

  const { payment, error: paymentError } = normalizeOpdPaymentSnapshot(paymentInput || null);
  if (paymentError) {
    return NextResponse.json({ error: paymentError }, { status: 400 });
  }

  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId, id: bookingId },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.bookingType !== 'PATIENT') {
    return NextResponse.json({ error: 'Only patient bookings can be checked in' }, { status: 400 });
  }
  if (!['ACTIVE', 'PENDING_PAYMENT'].includes(String(booking.status || ''))) {
    return NextResponse.json({ error: 'Booking is not active' }, { status: 409 });
  }
  if (booking.encounterCoreId) {
    return NextResponse.json({ success: true, encounterCoreId: booking.encounterCoreId, noOp: true });
  }

  const patientMasterId = String(booking.patientMasterId || '').trim();
  if (!patientMasterId) {
    return NextResponse.json({ error: 'Missing patientMasterId on booking' }, { status: 400 });
  }
  const bookingVisitType = String(booking.visitType || '').trim().toUpperCase();
  if (bookingVisitType && !OPD_VISIT_TYPE_SET.has(bookingVisitType)) {
    return NextResponse.json({ error: 'Invalid visitType on booking' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientMasterId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  if (patient.status === 'MERGED') {
    return NextResponse.json({ error: 'Patient is merged' }, { status: 409 });
  }

  let resolvedVisitType = bookingVisitType || '';
  if (!resolvedVisitType) {
    const resourceId = String(booking.resourceId || '').trim() || null;
    // detectVisitType now uses Prisma internally; db param is ignored
    resolvedVisitType = await detectVisitType(null, tenantId, patientMasterId, resourceId);
  }

  const now = new Date();

  // Check for existing active encounter
  const existingActive = await prisma.encounterCore.findFirst({
    where: { tenantId, patientId: patientMasterId, encounterType: 'OPD', status: 'ACTIVE' },
  });

  if (existingActive) {
    // Ensure OPD encounter exists
    const existingOpd = await prisma.opdEncounter.findUnique({
      where: { encounterCoreId: existingActive.id },
    });

    if (!existingOpd) {
      await prisma.opdEncounter.create({
        data: {
          tenantId,
          encounterCoreId: existingActive.id,
          patientId: patientMasterId,
          status: 'OPEN',
          arrivalState: 'ARRIVED',
          opdFlowState: 'WAITING_NURSE',
          visitType: (resolvedVisitType as any) || undefined,
          arrivalSource: 'RECEPTION',
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
          billingMeta: billingMeta || undefined,
        },
      });
    } else {
      const patch: Record<string, unknown> = {};
      let needsPatch = false;
      if (!existingOpd.arrivedAt) {
        patch.arrivedAt = now;
        needsPatch = true;
      }
      if (!existingOpd.arrivalSource) {
        patch.arrivalSource = 'RECEPTION';
        needsPatch = true;
      }
      if (resolvedVisitType && !existingOpd.visitType) {
        patch.visitType = resolvedVisitType;
        needsPatch = true;
      }
      if (!existingOpd.opdFlowState) {
        patch.opdFlowState = 'WAITING_NURSE';
        needsPatch = true;
      }
      if (billingMeta && !existingOpd.billingMeta) {
        patch.billingMeta = billingMeta;
        needsPatch = true;
      }
      if (needsPatch) {
        await prisma.opdEncounter.update({
          where: { id: existingOpd.id },
          data: patch,
        });
      }
    }

    // Update booking with encounter link and clear PENDING_PAYMENT
    const bookingPatch: Record<string, unknown> = {
      encounterCoreId: existingActive.id,
      checkedInAt: now,
      status: 'ACTIVE',
    };
    if (payment) bookingPatch.payment = payment;
    if (billingMeta) bookingPatch.billingMeta = billingMeta;
    await prisma.opdBooking.update({
      where: { id: bookingId },
      data: bookingPatch,
    });

    // Link invoice to encounter if invoiceId provided
    if (payment?.invoiceId) {
      await prisma.billingInvoice.updateMany({
        where: { tenantId, id: String(payment.invoiceId) },
        data: { encounterCoreId: existingActive.id },
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, encounter: existingActive, noOp: false });
  }

  // Create new encounter — wrapped in transaction to prevent orphaned records
  const encounter = await prisma.$transaction(async (tx) => {
    const enc = await tx.encounterCore.create({
      data: {
        tenantId,
        patientId: patientMasterId,
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
        patientId: patientMasterId,
        status: 'OPEN',
        arrivalState: 'ARRIVED',
        opdFlowState: 'WAITING_NURSE',
        visitType: resolvedVisitType as any || undefined,
        arrivalSource: 'RECEPTION',
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
        billingMeta: billingMeta || undefined,
      },
    });

    // Update booking with encounter link and clear PENDING_PAYMENT
    const bookingPatch: Record<string, unknown> = {
      encounterCoreId: enc.id,
      checkedInAt: now,
      status: 'ACTIVE',
    };
    if (payment) bookingPatch.payment = payment;
    if (billingMeta) bookingPatch.billingMeta = billingMeta;
    await tx.opdBooking.update({
      where: { id: bookingId },
      data: bookingPatch,
    });

    // Link invoice to the newly created encounter if invoiceId provided
    if (payment?.invoiceId) {
      await tx.billingInvoice.updateMany({
        where: { tenantId, id: String(payment.invoiceId) },
        data: { encounterCoreId: enc.id },
      }).catch(() => null);
    }

    return enc;
  });

  await createAuditLog(
    'encounter_core',
    encounter.id,
    'CREATE_OPD',
    userId || 'system',
    user?.email,
    { after: encounter, reason: 'OPD_BOOKING_CHECKIN' },
    tenantId
  );

  return NextResponse.json({ success: true, encounter });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
