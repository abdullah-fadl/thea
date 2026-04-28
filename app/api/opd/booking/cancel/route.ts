import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { cancelBookingSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, cancelBookingSchema);
  if ('error' in v) return v.error;
  const { bookingId, reason } = v.data;

  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId, id: bookingId },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.status !== 'ACTIVE') {
    return NextResponse.json({ success: true, noOp: true, booking });
  }

  if (booking.encounterCoreId) {
    const encounter = await prisma.encounterCore.findFirst({
      where: { tenantId, id: booking.encounterCoreId },
      select: { status: true },
    });
    if (encounter?.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Cannot cancel after check-in' }, { status: 409 });
    }
  }

  const slotIds = booking.slotIds || [];
  const now = new Date();

  // Use Prisma interactive transaction for atomicity
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check for conflicting active reservations on these slots
      if (slotIds.length > 0) {
        const otherReservations = await tx.schedulingReservation.findFirst({
          where: {
            tenantId,
            slotId: { in: slotIds },
            status: 'ACTIVE',
            bookingId: { not: bookingId },
          },
        });
        if (otherReservations) {
          throw new Error('SLOT_CONFLICT');
        }
      }

      // Cancel the booking
      const updatedBooking = await tx.opdBooking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelReason: reason,
          cancelledAt: now,
          cancelledByUserId: userId || null,
        },
      });

      // Cancel associated reservations
      await tx.schedulingReservation.updateMany({
        where: { tenantId, bookingId, status: 'ACTIVE' },
        data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: now },
      });

      // Release slots back to OPEN
      if (slotIds.length > 0) {
        await tx.schedulingSlot.updateMany({
          where: { tenantId, id: { in: slotIds }, status: { in: ['BOOKED', 'BLOCKED'] } },
          data: { status: 'OPEN' },
        });
      }

      return updatedBooking;
    });

    await createAuditLog(
      'opd_booking',
      result.id,
      'CANCEL',
      userId || 'system',
      user?.email,
      { after: result, reason },
      tenantId
    );

    return NextResponse.json({ booking: result });
  } catch (error) {
    if (String((error as Error).message || '') === 'SLOT_CONFLICT') {
      return NextResponse.json({ error: 'Slot conflict', code: 'SLOT_CONFLICT' }, { status: 409 });
    }
    logger.error('Booking cancel error', { category: 'opd', error });
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.booking.cancel' }
);
