import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const cancelBookingBodySchema = z.object({
  reason: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const v = validateBody(body, cancelBookingBodySchema);
    if ('error' in v) return v.error;
    const reason = String(body.reason || 'Cancelled by patient').trim();

    const portalUser = await prisma.patientPortalUser.findFirst({
      where: { tenantId: payload.tenantId, id: payload.portalUserId },
    });
    if (!portalUser) {
      return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
    }

    const booking = await prisma.opdBooking.findFirst({
      where: { tenantId: payload.tenantId, id: bookingId },
    });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const ownsBooking =
      String((booking as any).portalUserId || '') === String(portalUser.id || '') ||
      (portalUser.patientMasterId && String(booking.patientMasterId || '') === String(portalUser.patientMasterId || ''));
    if (!ownsBooking) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
    }

    if (booking.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Booking is already cancelled or completed' }, { status: 400 });
    }

    if (booking.encounterCoreId) {
      const encounter = await prisma.encounterCore.findFirst({
        where: { tenantId: payload.tenantId, id: booking.encounterCoreId },
      });
      if (encounter?.status === 'ACTIVE') {
        return NextResponse.json(
          { error: 'Cannot cancel after check-in. Please contact reception.' },
          { status: 409 }
        );
      }
    }

    const now = new Date();
    const steps = { booking: false, reservations: false, slots: false };

    // Step 1: Cancel the booking (with status guard)
    const bookingUpdateResult = await prisma.opdBooking.updateMany({
      where: { tenantId: payload.tenantId, id: bookingId, status: 'ACTIVE' },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledAt: now,
        cancelledByUserId: portalUser.id,
        updatedAt: now,
      },
    });
    if (!bookingUpdateResult.count) {
      return NextResponse.json({ error: 'Booking is already cancelled or completed' }, { status: 409 });
    }
    steps.booking = true;

    // Step 2: Cancel associated reservations
    try {
      await prisma.schedulingReservation.updateMany({
        where: { tenantId: payload.tenantId, bookingId, status: 'ACTIVE' },
        data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: now } as any,
      });
      steps.reservations = true;
    } catch {
      // Log failure but proceed — booking is already cancelled
    }

    // Step 3: Release slots
    try {
      const reservations = await prisma.schedulingReservation.findMany({
        where: { tenantId: payload.tenantId, bookingId },
      });
      const slotIds = Array.from(new Set(reservations.map((r) => String(r.slotId || '')).filter(Boolean)));
      if (slotIds.length) {
        await prisma.schedulingSlot.updateMany({
          where: { tenantId: payload.tenantId, id: { in: slotIds }, status: { in: ['BOOKED', 'BLOCKED'] } },
          data: { status: 'OPEN' } as any,
        });
      }
      steps.slots = true;
    } catch {
      // Log failure but proceed — booking is already cancelled
    }

    // If any downstream step failed, record for background repair
    if (!steps.reservations || !steps.slots) {
      prisma.failedCancellation.create({
        data: {
          tenantId: payload.tenantId,
          bookingId,
          steps: steps as object,
          reason,
          createdAt: now,
        },
      }).catch(() => {});
    }

    // Audit log (fire and forget)
    createAuditLog(
      'opd_booking',
      bookingId,
      'CANCEL',
      portalUser.id || 'portal',
      (portalUser as any).email || undefined,
      { reason, source: 'portal', steps },
      payload.tenantId
    ).catch(() => {});

  return NextResponse.json({ success: true, message: 'Appointment cancelled successfully' });
});
