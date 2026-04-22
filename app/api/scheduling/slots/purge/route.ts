import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    resourceId: z.string().min(1),
    fromDate: z.string().min(1),
    toDate: z.string().min(1),
    mode: z.string().optional(),
    force: z.boolean().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const resourceId = String(body.resourceId || '').trim();
  const fromDate = String(body.fromDate || '').trim();
  const toDate = String(body.toDate || '').trim();
  const mode = String(body.mode || 'OPEN_ONLY').trim().toUpperCase();
  const force = Boolean(body.force);

  if (!resourceId || !fromDate || !toDate) {
    return NextResponse.json({ error: 'Validation failed', missing: ['resourceId', 'fromDate', 'toDate'] }, { status: 400 });
  }
  if (!['OPEN_ONLY', 'ALL'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode', allowed: ['OPEN_ONLY', 'ALL'] }, { status: 400 });
  }

  if (mode === 'OPEN_ONLY') {
    const result = await prisma.schedulingSlot.deleteMany({
      where: {
        tenantId,
        resourceId,
        date: { gte: fromDate, lte: toDate },
        status: 'OPEN',
      },
    });
    return NextResponse.json({ deletedSlots: result.count });
  }

  // mode === 'ALL'
  const now = new Date();
  const cancelReason = 'ADMIN_PURGE';

  const slots = await prisma.schedulingSlot.findMany({
    where: { tenantId, resourceId, date: { gte: fromDate, lte: toDate } },
    select: { id: true },
    take: 5000,
  });
  const slotIds = slots.map((s) => s.id);

  // Cancel OPD bookings (if any) so UI/flows don't reference deleted slots.
  const bookings = await prisma.opdBooking.findMany({
    where: { tenantId, resourceId, date: { gte: fromDate, lte: toDate } },
    select: { id: true, status: true, encounterCoreId: true },
    take: 5000,
  });
  const activeBookingIds = bookings
    .filter((b) => String(b.status || '').toUpperCase() === 'ACTIVE')
    .map((b) => b.id);

  // Protect against deleting slots that have an ACTIVE encounter unless forced.
  const encounterIds = bookings
    .map((b) => b.encounterCoreId)
    .filter((id): id is string => Boolean(id));
  if (!force && encounterIds.length) {
    const activeEncounters = await prisma.encounterCore.findMany({
      where: { tenantId, id: { in: encounterIds }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (activeEncounters.length) {
      return NextResponse.json(
        {
          error: 'Cannot purge: active encounters exist',
          code: 'ACTIVE_ENCOUNTER_EXISTS',
          activeEncounterIds: activeEncounters.map((e) => e.id),
        },
        { status: 409 }
      );
    }
  }

  let cancelledBookings = 0;
  if (activeBookingIds.length) {
    const result = await prisma.opdBooking.updateMany({
      where: { tenantId, id: { in: activeBookingIds }, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelReason, cancelledAt: now },
    });
    cancelledBookings = result.count;
  }

  // Cancel & delete scheduling reservations tied to the slots.
  let cancelledReservations = 0;
  let deletedReservations = 0;
  if (slotIds.length) {
    const cancelRes = await prisma.schedulingReservation.updateMany({
      where: { tenantId, slotId: { in: slotIds }, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelReason, cancelledAt: now },
    });
    cancelledReservations = cancelRes.count;

    const delRes = await prisma.schedulingReservation.deleteMany({
      where: { tenantId, slotId: { in: slotIds } },
    });
    deletedReservations = delRes.count;
  }

  // Finally delete slots themselves.
  const delSlots = await prisma.schedulingSlot.deleteMany({
    where: { tenantId, resourceId, date: { gte: fromDate, lte: toDate } },
  });

  return NextResponse.json({
    mode: 'ALL',
    resourceId,
    fromDate,
    toDate,
    cancelledBookings,
    cancelledReservations,
    deletedReservations,
    deletedSlots: delSlots.count,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.delete' }
);
