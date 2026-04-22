import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { requirePortalSession } from '@/lib/portal/auth';
import { OPD_VISIT_TYPES } from '@/lib/models/OPDEncounter';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPD_VISIT_TYPE_SET = new Set<string>(OPD_VISIT_TYPES);

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const bookingId = String(params?.bookingId || '').trim();
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  const portalUser: any = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  const booking: any = await prisma.opdBooking.findFirst({
    where: { tenantId: payload.tenantId, id: bookingId },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const ownsBooking =
    String(booking.portalUserId || '') === String(portalUser.id || '') ||
    (portalUser.patientMasterId && String(booking.patientMasterId || '') === String(portalUser.patientMasterId || ''));
  if (!ownsBooking) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (booking.bookingType !== 'PATIENT') {
    return NextResponse.json({ error: 'Only patient bookings can be arrived' }, { status: 400 });
  }
  if (booking.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Booking is not active' }, { status: 409 });
  }

  const patientMasterId = String(booking.patientMasterId || '').trim();
  if (patientMasterId) {
    const patient: any = await prisma.patientMaster.findFirst({
      where: { tenantId: payload.tenantId, id: patientMasterId },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }
    if (String(patient.status || '') === 'MERGED') {
      return NextResponse.json({ error: 'Patient is merged' }, { status: 409 });
    }
  }

  const bookingVisitType = String(booking.visitType || '').trim().toUpperCase();
  if (bookingVisitType && !OPD_VISIT_TYPE_SET.has(bookingVisitType)) {
    return NextResponse.json({ error: 'Invalid visitType on booking' }, { status: 400 });
  }

  const now = new Date();

  let encounterCoreId = String(booking.encounterCoreId || '').trim();
  let encounter: any = null;
  if (encounterCoreId) {
    encounter = await prisma.encounterCore.findFirst({
      where: { tenantId: payload.tenantId, id: encounterCoreId },
    });
  }

  if (!encounter && patientMasterId) {
    encounterCoreId = uuidv4();
    encounter = {
      id: encounterCoreId,
      tenantId: payload.tenantId,
      patientId: patientMasterId,
      encounterType: 'OPD',
      status: 'ACTIVE',
      department: 'OPD',
      openedAt: now,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      source: { system: 'OPD_BOOKING', sourceId: bookingId },
    };
    await prisma.encounterCore.create({ data: encounter as never });
  }

  // Upsert OPD encounter
  let opdRecord: any = await prisma.opdEncounter.findFirst({
    where: { tenantId: payload.tenantId, encounterCoreId },
  });

  if (!opdRecord) {
    opdRecord = await prisma.opdEncounter.create({
      data: {
        tenantId: payload.tenantId,
        encounterCoreId,
        patientId: patientMasterId || null,
        status: 'OPEN',
        arrivalState: 'ARRIVED',
        arrivalSource: 'PATIENT',
        arrivedAt: now,
        createdAt: now,
        updatedAt: now,
        createdByUserId: null,
      } as any,
    });
  }

  const patch: Record<string, unknown> = {};
  if (!opdRecord?.arrivedAt) {
    patch.arrivedAt = now;
  }
  if (opdRecord?.arrivalState !== 'ARRIVED') {
    patch.arrivalState = 'ARRIVED';
  }
  if (!opdRecord?.arrivalSource) {
    patch.arrivalSource = 'PATIENT';
  }
  if (Object.keys(patch).length) {
    patch.updatedAt = now;
    await prisma.opdEncounter.updateMany({
      where: { tenantId: payload.tenantId, encounterCoreId },
      data: patch as Prisma.InputJsonValue,
    });
  }

  await prisma.opdBooking.updateMany({
    where: { tenantId: payload.tenantId, id: bookingId },
    data: { encounterCoreId, updatedAt: now } as Prisma.InputJsonValue,
  });

  return NextResponse.json({ success: true, encounter, encounterCoreId });
});
