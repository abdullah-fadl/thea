import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { cancelReservationSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reservationId = String((params as any)?.reservationId || '').trim();
  if (!reservationId) {
    return NextResponse.json({ error: 'reservationId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, cancelReservationSchema);
  if ('error' in v) return v.error;

  const reason = String(body.reason || '').trim();
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const existing = await prisma.schedulingReservation.findFirst({
    where: { tenantId, id: reservationId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }
  if (existing.status !== 'ACTIVE') {
    return NextResponse.json({ success: true, noOp: true, reservation: existing });
  }

  // [S-04] Wrap cancel + slot release in a transaction for atomicity
  const now = new Date();
  const reservation = await prisma.$transaction(async (tx) => {
    const updated = await tx.schedulingReservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: now, cancelledByUserId: userId || null },
    });

    // Re-open the slot if it was held/booked
    if (updated.slotId) {
      const slot = await tx.schedulingSlot.findFirst({
        where: { tenantId, id: updated.slotId },
      });
      if (slot && ['HELD', 'BOOKED'].includes(slot.status)) {
        await tx.schedulingSlot.update({
          where: { id: updated.slotId },
          data: { status: 'OPEN' },
        });
      }
    }

    return updated;
  });

  await createAuditLog(
    'scheduling_reservation',
    reservationId,
    'CANCEL',
    userId || 'system',
    user?.email,
    { before: existing, after: reservation, reason },
    tenantId
  );

  return NextResponse.json({ reservation });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
