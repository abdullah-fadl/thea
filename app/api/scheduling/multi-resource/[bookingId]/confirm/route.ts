import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }, params: Record<string, string>) => {
    try {
      const bookingId = params.bookingId;

      const booking = await prisma.multiResourceBooking.findFirst({
        where: { id: bookingId, tenantId },
      });

      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      if (booking.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Booking is already ${booking.status}` },
          { status: 400 },
        );
      }

      const updated = await prisma.multiResourceBooking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
      });

      return NextResponse.json({ item: updated });
    } catch (e) {
      logger.error('[MULTI-RESOURCE CONFIRM] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
    }
  },
  { permissionKey: 'scheduling.multi-resource.edit' }
);
