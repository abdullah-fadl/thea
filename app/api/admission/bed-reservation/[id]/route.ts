import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── DELETE /api/admission/bed-reservation/[id] ──────────────────────────────
export const DELETE = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const id = req.nextUrl.pathname.split('/').at(-1) || '';

      // 1. Fetch reservation
      const reservation = await prisma.bedReservation.findFirst({
        where: { tenantId, id },
      });
      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      if (reservation.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: `Cannot cancel reservation with status '${reservation.status}'` },
          { status: 409 }
        );
      }

      // 2. Cancel reservation
      await prisma.bedReservation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // 3. Revert admission request status if it was BED_ASSIGNED
      try {
        const request = await prisma.admissionRequest.findFirst({
          where: { tenantId, id: reservation.admissionRequestId },
        });
        if (request && request.status === 'BED_ASSIGNED') {
          await prisma.admissionRequest.update({
            where: { id: request.id },
            data: {
              status: 'VERIFIED',
              bedReservationId: null,
              updatedByUserId: userId,
            },
          });
        }
      } catch {
        // Revert is best-effort
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      logger.error('[admission/bed-reservation/[id]] DELETE error:', err);
      return NextResponse.json({ error: 'Failed to cancel reservation' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
