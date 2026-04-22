import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET /api/admission/available-beds ───────────────────────────────────────
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const ward = url.searchParams.get('ward');
      const unit = url.searchParams.get('unit');
      const departmentId = url.searchParams.get('departmentId');

      // 1. Fetch all beds
      const bedWhere: Record<string, unknown> = { tenantId };
      if (ward) bedWhere.ward = ward;
      if (unit) bedWhere.unit = unit;
      if (departmentId) bedWhere.departmentId = departmentId;

      const allBeds = await prisma.ipdBed.findMany({
        where: bedWhere,
        orderBy: [{ ward: 'asc' }, { bedLabel: 'asc' }],
        take: 500,
      });

      // 2. Get occupied bed IDs (active admissions)
      const occupiedBedIds = new Set<string>();
      const activeAdmissions = await prisma.ipdAdmission.findMany({
        where: { tenantId, isActive: true, releasedAt: null },
        select: { bedId: true, patientName: true, episodeId: true },
        take: 500,
      });
      const admissionByBed: Record<string, any> = {};
      for (const a of activeAdmissions) {
        if (a.bedId) {
          occupiedBedIds.add(a.bedId);
          admissionByBed[a.bedId] = a;
        }
      }

      // 3. Get reserved bed IDs (active reservations) and auto-expire old ones
      const reservedBedIds = new Set<string>();
      const reservationByBed: Record<string, any> = {};
      const now = new Date();

      const activeReservations = await prisma.bedReservation.findMany({
        where: { tenantId, status: 'ACTIVE' },
        take: 500,
      });

      for (const r of activeReservations) {
        if (new Date(r.expiresAt) <= now) {
          // Auto-expire
          try {
            await prisma.bedReservation.update({
              where: { id: r.id },
              data: { status: 'EXPIRED' },
            });
          } catch { /* ignore */ }
        } else {
          reservedBedIds.add(r.bedId);
          reservationByBed[r.bedId] = r;
        }
      }

      // 4. Classify beds and group by ward
      const wardMap: Record<string, {
        ward: string;
        beds: any[];
        available: number;
        occupied: number;
        reserved: number;
        inactive: number;
      }> = {};

      let totalBeds = 0;
      let totalAvailable = 0;
      let totalOccupied = 0;
      let totalReserved = 0;
      let totalInactive = 0;

      for (const bed of allBeds) {
        const wardName = bed.ward || bed.departmentName || 'Unassigned';
        if (!wardMap[wardName]) {
          wardMap[wardName] = { ward: wardName, beds: [], available: 0, occupied: 0, reserved: 0, inactive: 0 };
        }

        let bedStatus: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'INACTIVE';
        let occupant = null;
        let reservation = null;

        if (!bed.isActive) {
          bedStatus = 'INACTIVE';
          totalInactive++;
          wardMap[wardName].inactive++;
        } else if (occupiedBedIds.has(bed.id)) {
          bedStatus = 'OCCUPIED';
          occupant = admissionByBed[bed.id] || null;
          totalOccupied++;
          wardMap[wardName].occupied++;
        } else if (reservedBedIds.has(bed.id)) {
          bedStatus = 'RESERVED';
          reservation = reservationByBed[bed.id] || null;
          totalReserved++;
          wardMap[wardName].reserved++;
        } else {
          bedStatus = 'AVAILABLE';
          totalAvailable++;
          wardMap[wardName].available++;
        }

        totalBeds++;

        wardMap[wardName].beds.push({
          id: bed.id,
          bedLabel: bed.bedLabel || bed.label,
          ward: bed.ward,
          room: bed.room,
          unit: bed.unit,
          departmentId: bed.departmentId,
          departmentName: bed.departmentName,
          isActive: bed.isActive,
          status: bedStatus,
          occupant: occupant
            ? { patientName: occupant.patientName, episodeId: occupant.episodeId }
            : null,
          reservation: reservation
            ? {
                id: reservation.id,
                admissionRequestId: reservation.admissionRequestId,
                expiresAt: reservation.expiresAt,
              }
            : null,
        });
      }

      return NextResponse.json({
        wards: Object.values(wardMap),
        summary: {
          total: totalBeds,
          available: totalAvailable,
          occupied: totalOccupied,
          reserved: totalReserved,
          inactive: totalInactive,
          occupancyRate:
            totalBeds - totalInactive > 0
              ? Math.round((totalOccupied / (totalBeds - totalInactive)) * 100)
              : 0,
        },
      });
    } catch (err) {
      logger.error('[admission/available-beds] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch available beds' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);
