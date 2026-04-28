import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET /api/admission/stats ────────────────────────────────────────────────
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // ── Today's admissions ─────────────────────────────────────────────────
      let todayAdmissions = 0;
      try {
        todayAdmissions = await prisma.admissionRequest.count({
          where: {
            tenantId,
            status: 'ADMITTED',
            updatedAt: { gte: todayStart },
          },
        });
      } catch { /* continue */ }

      // ── Pending count ──────────────────────────────────────────────────────
      let pendingCount = 0;
      try {
        pendingCount = await prisma.admissionRequest.count({
          where: {
            tenantId,
            status: { notIn: ['ADMITTED', 'CANCELLED'] },
          },
        });
      } catch { /* continue */ }

      // ── Average wait time (admitted in last 30 days) ───────────────────────
      let avgWaitHours = 0;
      try {
        const recentAdmitted = await prisma.admissionRequest.findMany({
          where: {
            tenantId,
            status: 'ADMITTED',
            updatedAt: { gte: thirtyDaysAgo },
          },
          select: { createdAt: true, updatedAt: true },
          take: 200,
        });

        if (recentAdmitted.length > 0) {
          const totalMs = recentAdmitted.reduce(
            (sum: number, r) =>
              sum + (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()),
            0
          );
          avgWaitHours = Math.round((totalMs / recentAdmitted.length / 3600000) * 10) / 10;
        }
      } catch { /* continue */ }

      // ── Occupancy by department ────────────────────────────────────────────
      const occupancy: Array<{
        department: string;
        totalBeds: number;
        occupied: number;
        available: number;
        occupancyRate: number;
      }> = [];

      try {
        const allBeds = await prisma.ipdBed.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, ward: true, departmentName: true },
          take: 500,
        });

        const activeAdmissions = await prisma.ipdAdmission.findMany({
          where: { tenantId, isActive: true, releasedAt: null },
          select: { bedId: true },
          take: 500,
        });
        const occupiedBedIds = new Set(activeAdmissions.map((a) => a.bedId));

        // Group by department
        const deptMap: Record<string, { total: number; occupied: number }> = {};
        for (const bed of allBeds) {
          const dept = bed.ward || bed.departmentName || 'Unassigned';
          if (!deptMap[dept]) deptMap[dept] = { total: 0, occupied: 0 };
          deptMap[dept].total++;
          if (occupiedBedIds.has(bed.id)) deptMap[dept].occupied++;
        }

        for (const [dept, counts] of Object.entries(deptMap)) {
          occupancy.push({
            department: dept,
            totalBeds: counts.total,
            occupied: counts.occupied,
            available: counts.total - counts.occupied,
            occupancyRate: counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0,
          });
        }
        occupancy.sort((a, b) => b.occupancyRate - a.occupancyRate);
      } catch { /* continue */ }

      // ── Source breakdown (last 30 days) ────────────────────────────────────
      const sourceBreakdown: Record<string, number> = {};
      try {
        const recentRequests = await prisma.admissionRequest.findMany({
          where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
          select: { source: true },
          take: 200,
        });
        for (const r of recentRequests) {
          sourceBreakdown[r.source] = (sourceBreakdown[r.source] || 0) + 1;
        }
      } catch { /* continue */ }

      // ── 7-day admission trend ──────────────────────────────────────────────
      const trend: Array<{ date: string; count: number }> = [];
      try {
        const admittedLast7 = await prisma.admissionRequest.findMany({
          where: {
            tenantId,
            status: 'ADMITTED',
            updatedAt: { gte: sevenDaysAgo },
          },
          select: { updatedAt: true },
          take: 200,
        });

        // Build daily counts
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          const count = admittedLast7.filter((r) => {
            const rDate = new Date(r.updatedAt).toISOString().split('T')[0];
            return rDate === dateStr;
          }).length;
          trend.push({ date: dateStr, count });
        }
      } catch { /* continue */ }

      // ── Average Length of Stay (last 90 days, discharged) ──────────────────
      const alos: Array<{ department: string; avgDays: number; count: number }> = [];
      try {
        const discharged = await prisma.ipdEpisode.findMany({
          where: {
            tenantId,
            status: 'DISCHARGED',
            closedAt: { gte: ninetyDaysAgo },
          },
          select: { serviceUnit: true, createdAt: true, closedAt: true },
          take: 500,
        });

        const deptLos: Record<string, { totalDays: number; count: number }> = {};
        for (const ep of discharged) {
          if (!ep.closedAt) continue;
          const dept = ep.serviceUnit || 'Unknown';
          const days = (new Date(ep.closedAt).getTime() - new Date(ep.createdAt).getTime()) / 86400000;
          if (!deptLos[dept]) deptLos[dept] = { totalDays: 0, count: 0 };
          deptLos[dept].totalDays += days;
          deptLos[dept].count++;
        }

        for (const [dept, data] of Object.entries(deptLos)) {
          alos.push({
            department: dept,
            avgDays: Math.round((data.totalDays / data.count) * 10) / 10,
            count: data.count,
          });
        }
        alos.sort((a, b) => b.avgDays - a.avgDays);
      } catch { /* continue */ }

      // ── Overall occupancy rate ─────────────────────────────────────────────
      const totalActiveBeds = occupancy.reduce((s, o) => s + o.totalBeds, 0);
      const totalOccupied = occupancy.reduce((s, o) => s + o.occupied, 0);
      const overallOccupancy = totalActiveBeds > 0
        ? Math.round((totalOccupied / totalActiveBeds) * 100)
        : 0;

      return NextResponse.json({
        todayAdmissions,
        pendingCount,
        avgWaitHours,
        overallOccupancy,
        occupancy,
        sourceBreakdown,
        trend,
        alos,
      });
    } catch (err) {
      logger.error('[admission/stats] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);
