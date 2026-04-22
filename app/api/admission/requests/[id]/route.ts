import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import {
  updateAdmissionRequestSchema,
  isValidTransition,
} from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET /api/admission/requests/[id] ────────────────────────────────────────
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const id = req.nextUrl.pathname.split('/').at(-1) || '';

      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // Fetch checklist
      let checklist = null;
      try {
        checklist = await prisma.admissionChecklist.findFirst({
          where: { tenantId, admissionRequestId: id },
        });
      } catch { /* checklist may not exist */ }

      // Fetch active bed reservation
      let reservation = null;
      try {
        reservation = await prisma.bedReservation.findFirst({
          where: { tenantId, admissionRequestId: id, status: 'ACTIVE' },
        });
        // Check if reservation expired
        if (reservation && new Date(reservation.expiresAt) < new Date()) {
          await prisma.bedReservation.update({
            where: { id: reservation.id },
            data: { status: 'EXPIRED' },
          });
          reservation = null;
        }
      } catch { /* reservation may not exist */ }

      // Count available beds for the target department
      let availableBedCount = 0;
      try {
        const allBeds = await prisma.ipdBed.findMany({
          where: {
            tenantId,
            isActive: true,
            ...(request.targetDepartment ? { ward: request.targetDepartment } : {}),
          },
          take: 500,
        });

        const occupiedBedIds = new Set<string>();
        const activeAdmissions = await prisma.ipdAdmission.findMany({
          where: { tenantId, isActive: true, releasedAt: null },
          select: { bedId: true },
          take: 500,
        });
        for (const a of activeAdmissions) {
          if (a.bedId) occupiedBedIds.add(a.bedId);
        }

        const reservedBedIds = new Set<string>();
        const activeReservations = await prisma.bedReservation.findMany({
          where: { tenantId, status: 'ACTIVE' },
          select: { bedId: true, expiresAt: true },
          take: 500,
        });
        const now = new Date();
        for (const r of activeReservations) {
          if (new Date(r.expiresAt) > now) {
            reservedBedIds.add(r.bedId);
          }
        }

        availableBedCount = allBeds.filter(
          (b: any) => !occupiedBedIds.has(b.id) && !reservedBedIds.has(b.id)
        ).length;
      } catch { /* bed count may fail */ }

      return NextResponse.json({
        request,
        checklist,
        reservation,
        availableBedCount,
      });
    } catch (err) {
      logger.error('[admission/requests/[id]] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch admission request' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);

// ─── PATCH /api/admission/requests/[id] ──────────────────────────────────────
export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const id = req.nextUrl.pathname.split('/').at(-1) || '';
      const body = await req.json();

      const parsed = updateAdmissionRequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      const updates: any = { updatedByUserId: userId };

      // Validate status transition if status is being changed
      if (parsed.data.status && parsed.data.status !== request.status) {
        const transition = isValidTransition(request.status, parsed.data.status, request.urgency);
        if (!transition.valid) {
          return NextResponse.json(
            { error: transition.reason || 'Invalid status transition' },
            { status: 409 }
          );
        }
        updates.status = parsed.data.status;

        if (parsed.data.status === 'CANCELLED') {
          updates.cancelReason = parsed.data.cancelReason || null;
          updates.cancelledBy = userId;
          updates.cancelledAt = new Date();
        }
      }

      if (parsed.data.admittingDoctorId !== undefined) updates.admittingDoctorId = parsed.data.admittingDoctorId;
      if (parsed.data.admittingDoctorName !== undefined) updates.admittingDoctorName = parsed.data.admittingDoctorName;
      if (parsed.data.targetDepartment !== undefined) updates.targetDepartment = parsed.data.targetDepartment;
      if (parsed.data.targetUnit !== undefined) updates.targetUnit = parsed.data.targetUnit;
      if (parsed.data.urgency !== undefined) updates.urgency = parsed.data.urgency;
      if (parsed.data.bedType !== undefined) updates.bedType = parsed.data.bedType;

      const updated = await prisma.admissionRequest.update({
        where: { id },
        data: updates,
      });

      return NextResponse.json({ success: true, request: updated });
    } catch (err) {
      logger.error('[admission/requests/[id]] PATCH error:', err);
      return NextResponse.json({ error: 'Failed to update admission request' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
