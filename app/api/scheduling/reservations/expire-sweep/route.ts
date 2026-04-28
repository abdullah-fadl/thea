import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const expired = await prisma.schedulingReservation.findMany({
    where: { tenantId, status: 'ACTIVE', reservationType: 'HOLD', expiresAt: { lte: now } },
    take: 500,
  });

  let expiredCount = 0;
  for (const reservation of expired) {
    // Atomically update only if still ACTIVE
    const updateResult = await prisma.schedulingReservation.updateMany({
      where: { tenantId, id: reservation.id, status: 'ACTIVE' },
      data: { status: 'EXPIRED', expiredAt: now, expiredByUserId: userId || null },
    });
    if (updateResult.count === 0) continue;

    expiredCount += 1;
    const updated = await prisma.schedulingReservation.findUnique({ where: { id: reservation.id } });
    await createAuditLog(
      'scheduling_reservation',
      reservation.id,
      'EXPIRE',
      userId || 'system',
      user?.email,
      { after: updated },
      tenantId
    );

    const slot = await prisma.schedulingSlot.findFirst({
      where: { tenantId, id: reservation.slotId },
    });
    if (slot && slot.status === 'HELD') {
      await prisma.schedulingSlot.update({
        where: { id: reservation.slotId },
        data: { status: 'OPEN' },
      });
      await createAuditLog(
        'scheduling_slot',
        reservation.slotId,
        'STATUS_CHANGE',
        userId || 'system',
        user?.email,
        { before: slot, after: { ...slot, status: 'OPEN' } },
        tenantId
      );
    }
  }

  return NextResponse.json({ expiredCount });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
