import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createBedReservationSchema } from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const RESERVATION_HOURS = 4; // Default reservation duration

// ─── POST /api/admission/bed-reservation ─────────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const parsed = createBedReservationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { admissionRequestId, bedId } = parsed.data;

      // 1. Fetch admission request
      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id: admissionRequestId },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // Must be VERIFIED or PENDING (emergency)
      if (request.status !== 'VERIFIED' && request.status !== 'PENDING') {
        if (request.urgency !== 'EMERGENCY') {
          return NextResponse.json(
            { error: 'Request must be verified before reserving a bed' },
            { status: 409 }
          );
        }
      }

      // 2. Verify bed exists and is active
      const bed = await prisma.ipdBed.findFirst({
        where: { tenantId, id: bedId, isActive: true },
      });
      if (!bed) {
        return NextResponse.json({ error: 'Bed not found or inactive' }, { status: 404 });
      }

      // 3. Check bed is not occupied
      const occupiedAdmission = await prisma.ipdAdmission.findFirst({
        where: { tenantId, bedId, isActive: true, releasedAt: null },
      });
      if (occupiedAdmission) {
        return NextResponse.json({ error: 'Bed is currently occupied' }, { status: 409 });
      }

      // 4. Check bed is not reserved by another active reservation
      const now = new Date();
      const existingReservation = await prisma.bedReservation.findFirst({
        where: { tenantId, bedId, status: 'ACTIVE' },
      });
      if (existingReservation) {
        // Auto-expire if past expiry
        if (new Date(existingReservation.expiresAt) <= now) {
          await prisma.bedReservation.update({
            where: { id: existingReservation.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          return NextResponse.json(
            { error: 'Bed is already reserved by another admission request' },
            { status: 409 }
          );
        }
      }

      // 5. Cancel any existing reservation for this request
      try {
        const oldReservation = await prisma.bedReservation.findFirst({
          where: { tenantId, admissionRequestId, status: 'ACTIVE' },
        });
        if (oldReservation) {
          await prisma.bedReservation.update({
            where: { id: oldReservation.id },
            data: { status: 'CANCELLED' },
          });
        }
      } catch { /* ignore */ }

      // 6. Create new reservation
      const expiresAt = new Date(now.getTime() + RESERVATION_HOURS * 60 * 60 * 1000);

      const reservation = await prisma.bedReservation.create({
        data: {
          tenantId,
          admissionRequestId,
          bedId,
          reservedBy: userId,
          reservedAt: now,
          expiresAt,
          status: 'ACTIVE',
        },
      });

      // 7. Update admission request
      await prisma.admissionRequest.update({
        where: { id: admissionRequestId },
        data: {
          status: 'BED_ASSIGNED',
          bedReservationId: reservation.id,
          updatedByUserId: userId,
        },
      });

      return NextResponse.json({
        success: true,
        reservation: {
          ...reservation,
          bed: {
            id: bed.id,
            bedLabel: bed.bedLabel || bed.label,
            ward: bed.ward,
            room: bed.room,
            unit: bed.unit,
          },
        },
      }, { status: 201 });
    } catch (err) {
      logger.error('[admission/bed-reservation] POST error:', err);
      return NextResponse.json({ error: 'Failed to create bed reservation' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
