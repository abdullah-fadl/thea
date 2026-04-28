import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const portalBookingCreateBodySchema = z.object({
  resourceId: z.string().min(1, 'resourceId is required'),
  clinicId: z.string().min(1, 'clinicId is required'),
  slotIds: z.array(z.string()).min(1, 'slotIds must have at least one slot'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeSlotIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.map((value) => String(value || '').trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, portalBookingCreateBodySchema);
  if ('error' in v) return v.error;

  const resourceId = String(body.resourceId || '').trim();
  const clinicId = String(body.clinicId || '').trim();
  const slotIds = normalizeSlotIds(body.slotIds);

  const missing: string[] = [];
  if (!resourceId) missing.push('resourceId');
  if (!clinicId) missing.push('clinicId');
  if (!slotIds.length) missing.push('slotIds');
  if (missing.length) {
    return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
  }

  const tenantId = payload.tenantId;
  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId, id: payload.portalUserId },
  });
  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  const now = new Date();

  // Validate resource
  const resource = await prisma.schedulingResource.findFirst({
    where: { tenantId, id: resourceId },
  });
  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  const resourceRef = resource.resourceRef as Record<string, unknown> | null;
  const providerId = String(resourceRef?.providerId || '').trim();
  const assignment = providerId
    ? await prisma.clinicalInfraProviderAssignment.findFirst({ where: { tenantId, providerId } })
    : null;
  const primaryClinicId = String(assignment?.primaryClinicId || '').trim() || clinicId;
  const parallelClinicIds = Array.isArray(assignment?.parallelClinicIds) ? assignment.parallelClinicIds : [];
  const isPrimaryClinicBooking = clinicId === primaryClinicId;
  if (assignment && !isPrimaryClinicBooking && !parallelClinicIds.includes(clinicId)) {
    return NextResponse.json({ error: 'Invalid clinic selection' }, { status: 400 });
  }

  const patientMasterId = portalUser.patientMasterId || null;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Validate slots exist inside transaction for consistency
      const slots = await tx.schedulingSlot.findMany({
        where: { tenantId, id: { in: slotIds }, resourceId },
      });
      if (slots.length !== slotIds.length) {
        throw new Error('JSON:{"error":"Slot not open","code":"SLOT_NOT_OPEN","status":409}');
      }
      const date = String(slots[0]?.date || '');
      if (!date || slots.some((slot) => String(slot.date || '') !== date)) {
        throw new Error('JSON:{"error":"Slots must be on a single date","status":400}');
      }

      // PB-05: Prevent booking in the past
      const bookingDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (bookingDate < today) {
        throw new Error('JSON:{"error":"Cannot book appointments in the past.","status":400}');
      }

      if (slots.some((slot) => slot.status !== 'OPEN')) {
        throw new Error('JSON:{"error":"Slot not open","code":"SLOT_NOT_OPEN","status":409}');
      }

      // PB-02: Check for duplicate booking (same patient, same resource, same date)
      if (patientMasterId) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        const existingBooking = await tx.opdBooking.findFirst({
          where: {
            tenantId,
            patientMasterId,
            resourceId,
            date: { gte: startOfDay as any, lte: endOfDay as any },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          },
        });
        if (existingBooking) {
          throw new Error('JSON:{"error":"You already have a booking with this provider on this date.","status":409}');
        }
      }

      // Check for active reservations
      const activeRes = await tx.schedulingReservation.findFirst({
        where: { tenantId, slotId: { in: slotIds }, status: 'ACTIVE' },
      });
      if (activeRes) {
        throw new Error('JSON:{"error":"Slot already booked","code":"SLOT_ALREADY_BOOKED","status":409}');
      }

      // Validate patient is not merged
      if (patientMasterId) {
        const patient = await tx.patientMaster.findFirst({
          where: { tenantId, id: patientMasterId },
        });
        if (!patient) {
          throw new Error('JSON:{"error":"Patient not found","status":404}');
        }
        if (String(patient.status || '') === 'MERGED') {
          throw new Error('JSON:{"error":"Patient is merged","status":409}');
        }
      }

      // Atomic slot claim — update only if still OPEN (prevents double-booking race)
      const updateResult = await tx.schedulingSlot.updateMany({
        where: { tenantId, id: { in: slotIds }, resourceId, status: 'OPEN' },
        data: { status: 'BOOKED' },
      });
      if (updateResult.count !== slotIds.length) {
        throw new Error('BOOKING_CONFLICT');
      }

      // Slots are now claimed — safe to create booking and reservations
      const bookingId = uuidv4();
      const startAt = slots.map((slot) => new Date(slot.startAt)).sort((a, b) => a.getTime() - b.getTime())[0];
      const endAt = slots.map((slot) => new Date(slot.endAt)).sort((a, b) => b.getTime() - a.getTime())[0];

      const newBooking = await tx.opdBooking.create({
        data: {
          id: bookingId,
          tenantId,
          resourceId,
          clinicId,
          isPrimaryClinicBooking,
          bookingType: 'PATIENT',
          slotIds,
          date,
          startAt,
          endAt,
          patientMasterId,
          visitType: 'RETURN',
          source: 'PORTAL',
          reason: null,
          status: 'ACTIVE',
          createdByUserId: null,
          portalUserId: portalUser.id,
          portalMobile: portalUser.mobile,
        } as any,
      });

      for (const slotId of slotIds) {
        await tx.schedulingReservation.create({
          data: {
            tenantId,
            reservationId: uuidv4(),
            slotId,
            resourceId,
            reservationType: 'BOOKING',
            subjectType: patientMasterId ? 'PATIENT_MASTER' : 'EXTERNAL_REF',
            subjectId: patientMasterId || `portal:${portalUser.id}`,
            bookingId,
            notes: null,
            status: 'ACTIVE',
            expiresAt: null,
            createdAt: now,
            createdByUserId: null,
          },
        });
      }

      return newBooking;
    });

    return NextResponse.json({ booking });
  } catch (error) {
    const message = String((error as Error).message || '');
    if (message === 'BOOKING_CONFLICT') {
      return NextResponse.json({ error: 'Booking conflict', code: 'BOOKING_CONFLICT' }, { status: 409 });
    }
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
    throw error;
  }
});
