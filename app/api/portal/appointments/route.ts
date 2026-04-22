import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { deriveOpdStatus } from '@/lib/opd/status';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  const now = new Date();
  const orConditions: any[] = [{ portalUserId: portalUser.id }];
  if (portalUser.patientMasterId) {
    orConditions.push({ patientMasterId: portalUser.patientMasterId });
  }

  const bookings = await prisma.opdBooking.findMany({
    where: {
      tenantId: payload.tenantId,
      status: 'ACTIVE',
      OR: orConditions,
    },
    orderBy: [{ startAt: 'asc' }],
    take: 100,
  });

  const encounterIds = Array.from(
    new Set(bookings.map((booking: any) => String(booking.encounterCoreId || '')).filter(Boolean))
  );
  const opdRecords = encounterIds.length
    ? await prisma.opdEncounter.findMany({
        where: { tenantId: payload.tenantId, encounterCoreId: { in: encounterIds } },
      })
    : [];
  const opdByEncounter = opdRecords.reduce<Record<string, (typeof opdRecords)[0]>>((acc, record) => {
    acc[String(record.encounterCoreId || '')] = record;
    return acc;
  }, {});

  const items = bookings
    .filter((booking: any) => {
      if (!booking.startAt) return true;
      return new Date(booking.startAt) >= now;
    })
    .map((booking: any) => {
      const encounterCoreId = String(booking.encounterCoreId || '').trim();
      const opd = encounterCoreId ? opdByEncounter[encounterCoreId] || null : null;
      const arrivedAt = (opd as any)?.opdTimestamps?.arrivedAt || null;
      const status = deriveOpdStatus({ checkedInAt: booking.checkedInAt || null, arrivedAt });
      const flowState = opd?.opdFlowState || null;
      const statusLabel = flowState || status;
      return {
        bookingId: booking.id,
        clinicId: booking.clinicId || null,
        resourceId: booking.resourceId || null,
        startAt: booking.startAt || null,
        endAt: booking.endAt || null,
        status: statusLabel,
        encounterCoreId: encounterCoreId || null,
      };
    });

  return NextResponse.json({ items });
});
