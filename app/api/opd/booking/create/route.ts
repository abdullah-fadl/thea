import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { OPD_VISIT_TYPES } from '@/lib/models/OPDEncounter';
import { validateBody } from '@/lib/validation/helpers';
import { createBookingSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPD_VISIT_TYPE_SET = new Set<string>(OPD_VISIT_TYPES);

function normalizeSlotIds(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.map((value: any) => String(value || '').trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  // [R-05] Rate limiting: max 10 bookings per user per minute
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const recentBookings = await prisma.opdBooking.count({
    where: { tenantId, createdByUserId: userId || '', createdAt: { gte: oneMinuteAgo } },
  });
  if (recentBookings >= 10) {
    return NextResponse.json(
      { error: 'Too many booking requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createBookingSchema);
  if ('error' in v) return v.error;
  const { resourceId, clinicId, bookingType, patientMasterId, reason, clientRequestId, visitType: visitTypeRaw, billingMeta } = v.data;
  const slotIds = normalizeSlotIds(v.data.slotIds);

  if (bookingType === 'PATIENT' && !patientMasterId) {
    return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
  }
  if (bookingType === 'BLOCK' && !reason) {
    return NextResponse.json({ error: 'reason is required for blocks' }, { status: 400 });
  }
  if (bookingType === 'PATIENT' && visitTypeRaw && !OPD_VISIT_TYPE_SET.has(visitTypeRaw)) {
    return NextResponse.json({ error: 'Invalid visitType' }, { status: 400 });
  }

  // [B-05] Eligibility stale-check: warn if insurance eligibility is outdated
  let eligibilityWarning: string | null = null;
  if (bookingType === 'PATIENT' && patientMasterId) {
    try {
      const patientInsurance = await prisma.patientInsurance.findFirst({
        where: { tenantId, patientId: patientMasterId!, status: 'active' },
      });
      if (patientInsurance) {
        if (patientInsurance.eligible === false) {
          eligibilityWarning = 'Patient insurance is marked as ineligible. Please verify before visit.';
        } else {
          const lastCheck = patientInsurance.lastEligibilityCheck
            ? new Date(String(patientInsurance.lastEligibilityCheck)).getTime()
            : 0;
          const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
          if (Date.now() - lastCheck > staleThreshold) {
            eligibilityWarning = 'Insurance eligibility has not been verified in the last 24 hours.';
          }
        }
      }
    } catch {
      // Non-blocking: if eligibility check fails, proceed with booking
    }
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Validate resource exists
      const resource = await tx.schedulingResource.findFirst({
        where: { tenantId, id: resourceId },
      });
      if (!resource) {
        throw new Error('JSON:{"error":"Resource not found","status":404}');
      }

      // Check provider assignment for clinic validation
      const providerId = String(resource.resourceRefProviderId || '').trim();
      const assignment = providerId
        ? await tx.clinicalInfraProviderAssignment.findFirst({
            where: { tenantId, providerId },
          })
        : null;
      const primaryClinicId = String(assignment?.primaryClinicId || '').trim() || clinicId;
      const parallelClinicIds = assignment?.parallelClinicIds || [];
      const isPrimaryClinicBooking = clinicId === primaryClinicId;

      if (assignment && !isPrimaryClinicBooking && !parallelClinicIds.includes(clinicId)) {
        throw new Error('JSON:{"error":"Invalid clinic selection","status":400}');
      }

      // Validate all slots exist and are OPEN
      const slots = await tx.schedulingSlot.findMany({
        where: { tenantId, id: { in: slotIds }, resourceId },
      });
      if (slots.length !== slotIds.length) {
        throw new Error('JSON:{"error":"Slot not open","code":"SLOT_NOT_OPEN","status":409}');
      }

      const date = slots[0]?.date || '';
      if (!date || slots.some((slot) => slot.date !== date)) {
        throw new Error('JSON:{"error":"Slots must be on a single date","status":400}');
      }
      if (slots.some((slot) => slot.status !== 'OPEN')) {
        throw new Error('JSON:{"error":"Slot not open","code":"SLOT_NOT_OPEN","status":409}');
      }

      // Check no active reservations exist
      const activeRes = await tx.schedulingReservation.findFirst({
        where: { tenantId, slotId: { in: slotIds }, status: 'ACTIVE' },
      });
      if (activeRes) {
        throw new Error('JSON:{"error":"Slot already booked","code":"SLOT_ALREADY_BOOKED","status":409}');
      }

      // Validate patient if PATIENT booking
      if (bookingType === 'PATIENT') {
        const patient = await tx.patientMaster.findFirst({
          where: { tenantId, id: patientMasterId },
        });
        if (!patient) {
          throw new Error('JSON:{"error":"Patient not found","status":404}');
        }
        if (patient.status === 'MERGED') {
          throw new Error('JSON:{"error":"Patient is merged","status":409}');
        }
      }

      // Compute time range from slots
      const startAt = slots.map((s) => new Date(s.startAt)).sort((a, b) => a.getTime() - b.getTime())[0];
      const endAt = slots.map((s) => new Date(s.endAt)).sort((a, b) => b.getTime() - a.getTime())[0];

      // Atomic slot claim — update only if still OPEN (prevents double-booking race)
      const slotStatus = bookingType === 'BLOCK' ? 'BLOCKED' : 'BOOKED';
      const updateResult = await tx.schedulingSlot.updateMany({
        where: { tenantId, id: { in: slotIds }, resourceId, status: 'OPEN' },
        data: { status: slotStatus },
      });

      if (updateResult.count !== slotIds.length) {
        throw new Error('BOOKING_CONFLICT');
      }

      // Create booking (slots are now claimed — safe to proceed)
      const newBooking = await tx.opdBooking.create({
        data: {
          tenantId,
          resourceId,
          clinicId,
          isPrimaryClinicBooking,
          bookingType,
          slotIds,
          date,
          startAt,
          endAt,
          patientMasterId: bookingType === 'PATIENT' ? patientMasterId : null,
          reason: bookingType === 'BLOCK' ? reason : null,
          visitType: bookingType === 'PATIENT' && visitTypeRaw ? (visitTypeRaw as any) : null,
          billingMeta: billingMeta ? (billingMeta as Prisma.InputJsonValue) : undefined,
          status: 'ACTIVE',
          createdByUserId: userId || null,
          clientRequestId,
        },
      });

      // Create reservations for each slot
      for (const slotId of slotIds) {
        await tx.schedulingReservation.create({
          data: {
            tenantId,
            slotId,
            resourceId,
            reservationType: 'BOOKING',
            subjectType: bookingType === 'PATIENT' ? 'PATIENT_MASTER' : 'EXTERNAL_REF',
            subjectId: bookingType === 'PATIENT' ? patientMasterId : `block:${newBooking.id}`,
            bookingId: newBooking.id,
            notes: bookingType === 'BLOCK' ? reason : null,
            status: 'ACTIVE',
            createdByUserId: userId || null,
          },
        });
      }

      return newBooking;
    });

    await createAuditLog(
      'opd_booking',
      booking.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: booking },
      tenantId
    );

    return NextResponse.json({ booking, ...(eligibilityWarning ? { eligibilityWarning } : {}) });
  } catch (error) {
    const message = String((error as Error).message || '');

    // Handle structured error responses
    if (message.startsWith('JSON:')) {
      try {
        const errData = JSON.parse(message.slice(5));
        const status = errData.status || 500;
        delete errData.status;
        return NextResponse.json(errData, { status });
      } catch {
        // Fall through
      }
    }

    if (message === 'BOOKING_CONFLICT') {
      return NextResponse.json({ error: 'Booking conflict', code: 'BOOKING_CONFLICT' }, { status: 409 });
    }
    logger.error('Booking create error', { category: 'opd', error });
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.booking.create' }
);
