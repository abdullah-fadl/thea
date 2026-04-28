// =============================================================================
// Bulk Booking Operations — NEW FILE (does not modify any existing route)
// POST /api/opd/booking/bulk
// Actions: bulk-cancel, bulk-no-show, bulk-reschedule-date
// =============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

const bulkSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cancel'),
    bookingIds: z.array(z.string().uuid()).min(1).max(200),
    cancelReason: z.string().optional(),
  }),
  z.object({
    action: z.literal('no-show'),
    bookingIds: z.array(z.string().uuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal('reschedule-date'),
    bookingIds: z.array(z.string().uuid()).min(1).max(200),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'newDate must be YYYY-MM-DD'),
  }),
  z.object({
    action: z.literal('stats'),
    resourceId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
]);

interface BookingWhere {
  tenantId: string;
  resourceId?: string;
  doctorId?: string;
  date?: string;
  status?: string;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, bulkSchema);
    if ('error' in v) return v.error;
    const data = v.data;
    const now = new Date();

    if (data.action === 'cancel') {
      // Verify all bookings belong to this tenant before modifying
      const count = await prisma.opdBooking.count({
        where: {
          tenantId,
          id: { in: data.bookingIds },
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
      });

      if (count === 0) {
        return NextResponse.json({ error: 'No cancellable bookings found' }, { status: 404 });
      }

      const result = await prisma.opdBooking.updateMany({
        where: {
          tenantId,
          id: { in: data.bookingIds },
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByUserId: userId,
          cancelReason: data.cancelReason || 'Bulk cancellation',
          updatedAt: now,
        },
      });

      return NextResponse.json({ cancelled: result.count });
    }

    if (data.action === 'no-show') {
      const result = await prisma.opdBooking.updateMany({
        where: {
          tenantId,
          id: { in: data.bookingIds },
          status: { in: ['ACTIVE', 'ARRIVED', 'CHECKED_IN', 'PENDING_PAYMENT'] },
        },
        data: {
          status: 'NO_SHOW',
          noShowAt: now,
          updatedAt: now,
        },
      });

      return NextResponse.json({ updated: result.count });
    }

    if (data.action === 'reschedule-date') {
      const newBookingDate = new Date(data.newDate);
      const result = await prisma.opdBooking.updateMany({
        where: {
          tenantId,
          id: { in: data.bookingIds },
          status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        },
        data: {
          date: data.newDate,
          bookingDate: newBookingDate,
          status: 'ACTIVE',
          updatedAt: now,
        },
      });

      return NextResponse.json({ rescheduled: result.count, newDate: data.newDate });
    }

    if (data.action === 'stats') {
      const where: BookingWhere = { tenantId };
      if (data.resourceId) where.resourceId = data.resourceId;
      if (data.doctorId) where.doctorId = data.doctorId;
      if (data.date) where.date = data.date;

      const [total, booked, checkedIn, cancelled, noShow, completed] = await Promise.all([
        prisma.opdBooking.count({ where }),
        prisma.opdBooking.count({ where: { ...where, status: 'ACTIVE' } }),
        prisma.opdBooking.count({ where: { ...where, status: 'CHECKED_IN' } }),
        prisma.opdBooking.count({ where: { ...where, status: 'CANCELLED' } }),
        prisma.opdBooking.count({ where: { ...where, status: 'NO_SHOW' } }),
        prisma.opdBooking.count({ where: { ...where, status: 'COMPLETED' } }),
      ]);

      return NextResponse.json({ total, booked, checkedIn, cancelled, noShow, completed });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'opd.booking.view',
  },
);
