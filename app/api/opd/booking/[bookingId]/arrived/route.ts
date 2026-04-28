import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { OPD_VISIT_TYPES } from '@/lib/models/OPDEncounter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPD_VISIT_TYPE_SET = new Set<string>(OPD_VISIT_TYPES);

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
  if (booking.bookingType !== 'PATIENT') {
    return NextResponse.json({ error: 'Only patient bookings can be arrived' }, { status: 400 });
  }
  if (booking.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Booking is not active' }, { status: 409 });
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

  const now = new Date();
  let encounterCoreId = String(booking.encounterCoreId || '').trim();
  let encounter: any = null;

  if (encounterCoreId) {
    encounter = await prisma.encounterCore.findFirst({
      where: { tenantId, id: encounterCoreId },
    });
  }

  if (!encounter) {
    // Create new encounter core
    encounter = await prisma.encounterCore.create({
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
    encounterCoreId = encounter.id;

    await createAuditLog(
      'encounter_core',
      encounter.id,
      'CREATE_OPD',
      userId || 'system',
      user?.email,
      { after: encounter, reason: 'OPD_BOOKING_PATIENT_ARRIVAL' },
      tenantId
    );
  }

  // Upsert OPD encounter
  const existingOpd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });

  let needsPatch = false;
  if (!existingOpd) {
    await prisma.opdEncounter.create({
      data: {
        tenantId,
        encounterCoreId,
        patientId: patientMasterId,
        status: 'OPEN',
        arrivalState: 'NOT_ARRIVED',
        arrivalSource: 'PATIENT',
        arrivedAt: now,
        createdByUserId: userId || null,
      },
    });
    needsPatch = true;
  } else {
    const patch: Record<string, unknown> = {};
    if (!existingOpd.arrivedAt) {
      patch.arrivedAt = now;
      needsPatch = true;
    }
    if (!existingOpd.arrivalSource) {
      patch.arrivalSource = 'PATIENT';
      needsPatch = true;
    }
    if (needsPatch) {
      await prisma.opdEncounter.update({
        where: { id: existingOpd.id },
        data: patch,
      });
    }
  }

  // Link booking to encounter
  await prisma.opdBooking.update({
    where: { id: bookingId },
    data: { encounterCoreId },
  });

  return NextResponse.json({ success: true, encounter, encounterCoreId, noOp: !needsPatch });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
