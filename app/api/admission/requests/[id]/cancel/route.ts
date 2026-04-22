import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

const db = prisma as unknown as Record<string, Record<string, (...args: any[]) => Promise<any>>>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── POST /api/admission/requests/[id]/cancel ────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      const body = await req.json().catch(() => ({}));
      const cancelReason = (body as Record<string, unknown>).cancelReason || '';

      // 1. Fetch request
      const request = await db.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // 2. Cannot cancel if already admitted or cancelled
      if (request.status === 'ADMITTED') {
        return NextResponse.json(
          { error: 'Cannot cancel an already admitted request. Use discharge workflow instead.' },
          { status: 409 }
        );
      }
      if (request.status === 'CANCELLED') {
        return NextResponse.json({ success: true, noOp: true, message: 'Already cancelled' });
      }

      // 3. Release any active bed reservation
      try {
        const activeReservation = await db.bedReservation.findFirst({
          where: { tenantId, admissionRequestId: id, status: 'ACTIVE' },
        });
        if (activeReservation) {
          await db.bedReservation.update({
            where: { id: activeReservation.id },
            data: { status: 'CANCELLED' },
          });
        }
      } catch {
        // Reservation cleanup optional
      }

      // 4. Update request to CANCELLED
      const updated = await db.admissionRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: cancelReason || null,
          cancelledBy: userId,
          cancelledAt: new Date(),
          bedReservationId: null,
          updatedByUserId: userId,
        },
      });

      return NextResponse.json({ success: true, request: updated });
    } catch (err) {
      logger.error('[admission/requests/[id]/cancel] POST error:', err);
      return NextResponse.json({ error: 'Failed to cancel admission request' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
