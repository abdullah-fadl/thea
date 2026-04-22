import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { updateBookingStatusSchema } from '@/lib/validation/opd.schema';

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const bookingId = String((params as { bookingId?: string } | undefined)?.bookingId || '').trim();
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateBookingStatusSchema);
  if ('error' in v) return v.error;
  const { status, reason } = v.data;

  const updateData: Record<string, any> = {
    status,
    updatedBy: userId || null,
  };

  // [R-02] Cover all booking statuses with timestamps
  switch (status) {
    case 'ACTIVE':
      updateData.activatedAt = new Date();
      break;
    case 'PENDING_PAYMENT':
      updateData.pendingPaymentAt = new Date();
      break;
    case 'CHECKED_IN':
    case 'ARRIVED':
      updateData.checkedInAt = new Date();
      break;
    case 'IN_PROGRESS':
      updateData.inProgressAt = new Date();
      break;
    case 'COMPLETED':
      updateData.completedAt = new Date();
      break;
    case 'NO_SHOW':
      updateData.noShowAt = new Date();
      updateData.noShowReason = reason;
      break;
    case 'CANCELLED':
      updateData.cancelledAt = new Date();
      updateData.cancelReason = reason;
      break;
  }

  const existing = await prisma.opdBooking.findFirst({
    where: { tenantId, id: bookingId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const booking = await prisma.opdBooking.update({
    where: { id: bookingId },
    data: updateData,
  });

  return NextResponse.json({ success: true, booking });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
