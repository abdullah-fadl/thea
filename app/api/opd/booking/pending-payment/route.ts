import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { bookingPendingPaymentSchema } from '@/lib/validation/opd.schema';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bookingPendingPaymentSchema);
  if ('error' in v) return v.error;
  const { bookingId, isFirstVisit } = v.data;

  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId, id: bookingId },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.bookingType !== 'PATIENT') {
    return NextResponse.json({ error: 'Only patient bookings can be updated' }, { status: 400 });
  }

  // [R-07] Validate booking status before allowing pending payment transition
  const allowedStatuses = ['ACTIVE', 'CHECKED_IN'];
  if (!allowedStatuses.includes(String(booking.status || ''))) {
    return NextResponse.json(
      { error: 'Cannot change payment status for ' + booking.status + ' booking' },
      { status: 400 }
    );
  }

  const now = new Date();
  const patch: Record<string, any> = {
    status: 'PENDING_PAYMENT',
    pendingPaymentAt: now,
    updatedByUserId: userId || null,
  };
  if (isFirstVisit !== undefined) {
    patch.isFirstVisit = isFirstVisit;
  }

  await prisma.opdBooking.update({
    where: { id: bookingId },
    data: patch,
  });

  return NextResponse.json({ success: true, bookingId });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
