import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const resourceId = String(params.get('resourceId') || '').trim();
  const date = String(params.get('date') || '').trim();
  const clinicId = String(params.get('clinicId') || '').trim();
  if (!resourceId || !date) {
    return NextResponse.json({ error: 'resourceId and date are required' }, { status: 400 });
  }

  const slots = await prisma.schedulingSlot.findMany({
    where: { tenantId, resourceId, date },
    orderBy: [{ startAt: 'asc' }],
    take: 200,
  });

  const slotIds = slots.map((slot) => slot.id);
  const slotById = slots.reduce<Record<string, (typeof slots)[0]>>((acc, slot) => {
    acc[slot.id] = slot;
    return acc;
  }, {});

  const bookingFilter: any = { tenantId, resourceId, date };
  if (clinicId) bookingFilter.clinicId = clinicId;

  const bookings = await prisma.opdBooking.findMany({
    where: bookingFilter,
    orderBy: [{ createdAt: 'asc' }],
    take: 500,
  });

  const primaryBookings = await prisma.opdBooking.findMany({
    where: { tenantId, resourceId, date, isPrimaryClinicBooking: true, status: 'ACTIVE' },
    take: 500,
  });

  const patientIds = Array.from(
    new Set(
      bookings
        .filter((booking) => booking.bookingType === 'PATIENT' && booking.patientMasterId)
        .map((booking) => String(booking.patientMasterId || '').trim())
        .filter(Boolean)
    )
  );
  const patients = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: patientIds } },
      })
    : [];
  const patientById = patients.reduce<Record<string, (typeof patients)[0]>>((acc, patient) => {
    acc[patient.id] = patient;
    return acc;
  }, {});

  const encounterIds = Array.from(
    new Set(bookings.map((booking) => String(booking.encounterCoreId || '')).filter(Boolean))
  );
  const encounters = encounterIds.length
    ? await prisma.encounterCore.findMany({
        where: { tenantId, id: { in: encounterIds } },
      })
    : [];
  const encounterById = encounters.reduce<Record<string, (typeof encounters)[0]>>((acc, encounter) => {
    acc[encounter.id] = encounter;
    return acc;
  }, {});

  const opdRecords = encounterIds.length
    ? await prisma.opdEncounter.findMany({
        where: { tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const opdByEncounterId = opdRecords.reduce<Record<string, (typeof opdRecords)[0]>>((acc, record) => {
    acc[record.encounterCoreId] = record;
    return acc;
  }, {});

  // Fetch invoice statuses for all encounters
  const invoiceByEncounterId: Record<string, { status: string; invoiceNumber: string }> = {};
  if (encounterIds.length) {
    const invoices = await prisma.billingInvoice.findMany({
      where: { tenantId, encounterCoreId: { in: encounterIds } },
      select: { encounterCoreId: true, status: true, invoiceNumber: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const inv of invoices) {
      if (!invoiceByEncounterId[inv.encounterCoreId]) {
        invoiceByEncounterId[inv.encounterCoreId] = { status: inv.status, invoiceNumber: inv.invoiceNumber };
      }
    }
  }

  const creatorIds = Array.from(
    new Set(bookings.map((b) => b.createdByUserId).filter(Boolean)) as Set<string>
  );
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, email: true, displayName: true, firstName: true, lastName: true, staffId: true },
      })
    : [];
  const creatorById = creators.reduce<Record<string, { name: string; staffId: string | null }>>((acc, u) => {
    const name = (u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id);
    acc[u.id] = { name, staffId: u.staffId || null };
    return acc;
  }, {});

  const baselineSlotsPlanned = slots.filter((slot) => {
    const derived = slot.derivedFrom as Record<string, unknown>;
    return derived?.templateId;
  }).length;
  const capacitySlotsPlanned = slots.length;

  let baselineSlotsBooked = 0;
  let baselineSlotsBlocked = 0;
  let bookingsCount = 0;
  let blocksCount = 0;

  for (const booking of primaryBookings) {
    const bookingSlotIds = booking.slotIds || [];
    const baselineCount = bookingSlotIds.filter((slotId: string) => {
      const derived = slotById[slotId]?.derivedFrom as Record<string, unknown>;
      return derived?.templateId;
    }).length;
    if (booking.bookingType === 'PATIENT') {
      bookingsCount += 1;
      baselineSlotsBooked += baselineCount;
    } else if (booking.bookingType === 'BLOCK') {
      blocksCount += 1;
      baselineSlotsBlocked += baselineCount;
    }
  }

  const computedTargetAvailable = Math.max(0, baselineSlotsPlanned - baselineSlotsBooked - baselineSlotsBlocked);

  const items = bookings.map((booking) => ({
    ...booking,
    slotCount: booking.slotIds?.length || 0,
    slots: (booking.slotIds || [])
      .map((slotId: string) => slotById[slotId] || null)
      .filter(Boolean),
    patient: booking.patientMasterId ? patientById[booking.patientMasterId] || null : null,
    encounter: booking.encounterCoreId ? encounterById[booking.encounterCoreId] || null : null,
    opd: booking.encounterCoreId ? opdByEncounterId[booking.encounterCoreId] || null : null,
    invoice: booking.encounterCoreId ? invoiceByEncounterId[booking.encounterCoreId] || null : null,
    createdBy: (() => {
      const c = booking.createdByUserId ? creatorById[booking.createdByUserId] : null;
      if (!c) return null;
      return c.staffId ? `${c.name} (${c.staffId})` : c.name;
    })(),
    createdByName: (() => {
      const c = booking.createdByUserId ? creatorById[booking.createdByUserId] : null;
      return c?.name || null;
    })(),
    createdByStaffId: (() => {
      const c = booking.createdByUserId ? creatorById[booking.createdByUserId] : null;
      return c?.staffId || null;
    })(),
  }));

  return NextResponse.json({
    items,
    slots,
    targetSummary: {
      baselineSlotsPlanned,
      capacitySlotsPlanned,
      blocksCount,
      baselineSlotsBlocked,
      bookingsCount,
      baselineSlotsBooked,
      computedTargetAvailable,
    },
  });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
