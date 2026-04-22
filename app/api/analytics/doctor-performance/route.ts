import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Default daily patient targets by provider level
// GP / Resident = 20, Specialist / Consultant = 15
// ---------------------------------------------------------------------------
const DEFAULT_TARGETS: Record<string, number> = {
  CONSULTANT: 15,
  SPECIALIST: 15,
  RESIDENT: 20,
  GP: 20,
};
const FALLBACK_TARGET = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePeriod(raw: string | null): { days: number; label: string } {
  switch (raw) {
    case '7d':
      return { days: 7, label: '7d' };
    case '90d':
      return { days: 90, label: '90d' };
    case '30d':
    default:
      return { days: 30, label: '30d' };
  }
}

function diffMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return ms / 60_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// GET /api/analytics/doctor-performance?period=30d&departmentId=xxx
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const { days, label: periodLabel } = parsePeriod(searchParams.get('period'));
    const departmentId = searchParams.get('departmentId') || null;

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    // 30-day window always for trend (even if period is 7d or 90d)
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 30);

    // -----------------------------------------------------------------------
    // 1. Fetch providers (doctors) with profile for specialty/level
    // -----------------------------------------------------------------------
    const providers = await prisma.clinicalInfraProvider
      .findMany({
        where: { tenantId, isArchived: false },
        select: {
          id: true,
          displayName: true,
          specialtyCode: true,
          profiles: {
            select: { level: true },
            take: 1,
          },
        },
      })
      .catch(() => [] as Array<{ id: string; displayName: string; specialtyCode: string | null; profiles: Array<{ level: string | null }> }>);

    interface ProviderInfo {
      name: string;
      specialty: string;
      level: string | null;
    }
    const providerMap = new Map<string, ProviderInfo>(
      providers.map((p) => [
        p.id,
        {
          name: p.displayName,
          specialty: p.specialtyCode || 'GENERAL',
          level: p.profiles[0]?.level || null,
        },
      ]),
    );

    // -----------------------------------------------------------------------
    // 2. Fetch bookings in the period (with doctor assignment)
    // -----------------------------------------------------------------------
    const bookingWhere: any = {
      tenantId,
      createdAt: { gte: periodStart },
    };
    if (departmentId) {
      bookingWhere.departmentId = departmentId;
    }

    const bookings = await prisma.opdBooking
      .findMany({
        where: bookingWhere,
        select: {
          id: true,
          doctorId: true,
          status: true,
          visitType: true,
          encounterCoreId: true,
          createdAt: true,
          bookingDate: true,
          date: true,
        },
      })
      .catch(() => [] as Array<{
        id: string;
        doctorId: string | null;
        status: string;
        visitType: string | null;
        encounterCoreId: string | null;
        createdAt: Date;
        bookingDate: Date | null;
        date: string | null;
      }>);

    // -----------------------------------------------------------------------
    // 3. Fetch OPD encounters in the period (for timing data)
    // -----------------------------------------------------------------------
    const encounterWhere: any = {
      tenantId,
      createdAt: { gte: periodStart },
    };

    const encounters = await prisma.opdEncounter
      .findMany({
        where: encounterWhere,
        select: {
          id: true,
          encounterCoreId: true,
          arrivedAt: true,
          doctorStartAt: true,
          doctorEndAt: true,
          createdAt: true,
        },
      })
      .catch(() => [] as Array<{
        id: string;
        encounterCoreId: string;
        arrivedAt: Date | null;
        doctorStartAt: Date | null;
        doctorEndAt: Date | null;
        createdAt: Date;
      }>);

    // Map encounterCoreId -> encounter timing
    const encounterByCore = new Map<string, {
      arrivedAt: Date | null;
      doctorStartAt: Date | null;
      doctorEndAt: Date | null;
    }>();
    for (const enc of encounters) {
      encounterByCore.set(enc.encounterCoreId, {
        arrivedAt: enc.arrivedAt,
        doctorStartAt: enc.doctorStartAt,
        doctorEndAt: enc.doctorEndAt,
      });
    }

    // -----------------------------------------------------------------------
    // 4. Fetch encounter cores for department filtering
    // -----------------------------------------------------------------------
    const encounterCoreIds = bookings
      .map((b) => b.encounterCoreId)
      .filter(Boolean) as string[];

    let encounterCoreDeptMap = new Map<string, string>();
    if (encounterCoreIds.length > 0) {
      const coreWhere: any = {
        tenantId,
        id: { in: encounterCoreIds },
      };
      if (departmentId) {
        coreWhere.department = departmentId;
      }
      const cores = await prisma.encounterCore
        .findMany({
          where: coreWhere,
          select: { id: true, department: true },
        })
        .catch(() => [] as Array<{ id: string; department: string }>);
      encounterCoreDeptMap = new Map(cores.map((c) => [c.id, c.department]));
    }

    // -----------------------------------------------------------------------
    // 5. Fetch orders count grouped by encounterCoreId
    // -----------------------------------------------------------------------
    let orderCountByEncounter = new Map<string, number>();
    if (encounterCoreIds.length > 0) {
      const orderGroups = await prisma.ordersHub
        .groupBy({
          by: ['encounterCoreId'],
          where: {
            tenantId,
            encounterCoreId: { in: encounterCoreIds },
          },
          _count: { id: true },
        })
        .catch(() => [] as Array<{ encounterCoreId: string | null; _count: { id: number } }>);

      for (const g of orderGroups) {
        if (g.encounterCoreId) {
          orderCountByEncounter.set(g.encounterCoreId, g._count.id);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 6. Fetch clinical notes for documentation completeness
    // -----------------------------------------------------------------------
    let notedEncounterCoreIds = new Set<string>();
    if (encounterCoreIds.length > 0) {
      const notes = await prisma.clinicalNote
        .findMany({
          where: {
            tenantId,
            encounterCoreId: { in: encounterCoreIds },
          },
          select: { encounterCoreId: true },
          distinct: ['encounterCoreId'],
        })
        .catch(() => [] as Array<{ encounterCoreId: string | null }>);

      for (const n of notes) {
        if (n.encounterCoreId) notedEncounterCoreIds.add(n.encounterCoreId);
      }
    }

    // Also check OPD doctor entries as an alternative documentation source
    const opdEncounterIds = encounters.map((e) => e.id);
    let documentedOpdEncounterIds = new Set<string>();
    if (opdEncounterIds.length > 0) {
      const docEntries = await prisma.opdDoctorEntry
        .findMany({
          where: {
            opdEncounterId: { in: opdEncounterIds },
          },
          select: { opdEncounterId: true },
          distinct: ['opdEncounterId'],
        })
        .catch(() => [] as Array<{ opdEncounterId: string }>);

      for (const de of docEntries) {
        documentedOpdEncounterIds.add(de.opdEncounterId);
      }
    }

    // Map OPD encounter ID -> encounterCoreId for cross-reference
    const opdEncIdToCoreId = new Map<string, string>();
    for (const enc of encounters) {
      opdEncIdToCoreId.set(enc.id, enc.encounterCoreId);
    }

    // Merge: an encounter is documented if it has a clinical note OR a doctor entry
    Array.from(documentedOpdEncounterIds).forEach((opdEncId) => {
      const coreId = opdEncIdToCoreId.get(opdEncId);
      if (coreId) notedEncounterCoreIds.add(coreId);
    });

    // -----------------------------------------------------------------------
    // 7. Fetch trend data — bookings per doctor per day (last 30 days)
    // -----------------------------------------------------------------------
    const trendBookings = await prisma.opdBooking
      .findMany({
        where: {
          tenantId,
          createdAt: { gte: trendStart },
          ...(departmentId ? { departmentId } : {}),
        },
        select: {
          doctorId: true,
          createdAt: true,
        },
      })
      .catch(() => [] as Array<{ doctorId: string | null; createdAt: Date }>);

    // Build per-doctor daily trend
    const doctorTrendMap = new Map<string, Map<string, number>>();
    for (const tb of trendBookings) {
      if (!tb.doctorId) continue;
      const day = tb.createdAt.toISOString().split('T')[0];
      if (!doctorTrendMap.has(tb.doctorId)) {
        doctorTrendMap.set(tb.doctorId, new Map());
      }
      const dayMap = doctorTrendMap.get(tb.doctorId)!;
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }

    // Generate full 30-day date range for trend output
    const trendDates: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendDates.push(d.toISOString().split('T')[0]);
    }

    // -----------------------------------------------------------------------
    // 8. Aggregate per-doctor metrics
    // -----------------------------------------------------------------------

    interface DoctorAgg {
      totalPatients: number;
      newPatients: number;
      followUps: number;
      completed: number;
      cancelled: number;
      noShow: number;
      consultMinutes: number[];
      waitMinutes: number[];
      orderCounts: number[];
      encounterCoreIds: string[];
      activeDays: Set<string>;
    }

    const doctorAggs = new Map<string, DoctorAgg>();

    function ensureAgg(doctorId: string): DoctorAgg {
      if (!doctorAggs.has(doctorId)) {
        doctorAggs.set(doctorId, {
          totalPatients: 0,
          newPatients: 0,
          followUps: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          consultMinutes: [],
          waitMinutes: [],
          orderCounts: [],
          encounterCoreIds: [],
          activeDays: new Set(),
        });
      }
      return doctorAggs.get(doctorId)!;
    }

    for (const bk of bookings) {
      if (!bk.doctorId) continue;

      // If department filter is applied, verify the encounter is in that department
      if (departmentId && bk.encounterCoreId) {
        const dept = encounterCoreDeptMap.get(bk.encounterCoreId);
        if (!dept) continue; // encounter not in the filtered department
      }

      const agg = ensureAgg(bk.doctorId);
      agg.totalPatients++;

      // Visit type classification
      // FVC = First Visit Cash, FVH = First Visit Health insurance — these are new patients
      // FU = Follow-Up, RV = Return Visit, REF = Referral — these are follow-ups
      const vt = bk.visitType || '';
      if (vt === 'FVC' || vt === 'FVH') {
        agg.newPatients++;
      } else {
        agg.followUps++;
      }

      // Status classification
      const st = bk.status?.toUpperCase() || '';
      if (st === 'COMPLETED') {
        agg.completed++;
      } else if (st === 'CANCELLED') {
        agg.cancelled++;
      } else if (st === 'NO_SHOW') {
        agg.noShow++;
      }

      // Track active day
      const bookingDay = bk.date || bk.bookingDate?.toISOString().split('T')[0] || bk.createdAt.toISOString().split('T')[0];
      agg.activeDays.add(bookingDay);

      // Timing from the linked OPD encounter
      if (bk.encounterCoreId) {
        agg.encounterCoreIds.push(bk.encounterCoreId);

        const timing = encounterByCore.get(bk.encounterCoreId);
        if (timing) {
          // Consultation time: doctorStartAt -> doctorEndAt
          const consultMins = diffMinutes(timing.doctorStartAt, timing.doctorEndAt);
          if (consultMins !== null && consultMins >= 1 && consultMins <= 120) {
            agg.consultMinutes.push(consultMins);
          }

          // Wait time: arrivedAt -> doctorStartAt
          const waitMins = diffMinutes(timing.arrivedAt, timing.doctorStartAt);
          if (waitMins !== null && waitMins >= 0 && waitMins <= 300) {
            agg.waitMinutes.push(waitMins);
          }
        }

        // Orders count
        const oc = orderCountByEncounter.get(bk.encounterCoreId);
        if (oc !== undefined) {
          agg.orderCounts.push(oc);
        } else {
          agg.orderCounts.push(0);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 9. Build response per doctor
    // -----------------------------------------------------------------------

    const departmentTotalPatients = Array.from(doctorAggs.values()).reduce(
      (sum, a) => sum + a.totalPatients,
      0,
    );

    // Count business days in period (exclude Fri/Sat for Saudi workweek)
    const businessDays = countBusinessDays(periodStart, new Date());

    interface DoctorResult {
      doctorId: string;
      name: string;
      specialty: string;
      metrics: {
        totalPatients: number;
        newPatients: number;
        followUps: number;
        completed: number;
        cancelled: number;
        noShow: number;
        completionRate: number;
        noShowRate: number;
      };
      utilization: {
        target: number;
        avgDaily: number;
        utilizationPct: number;
        censusSharePct: number;
      };
      productivity: {
        avgConsultMinutes: number;
        avgWaitMinutes: number;
        ordersPerEncounter: number;
        documentationPct: number;
      };
      trend: Array<{ date: string; count: number }>;
    }

    const doctors: DoctorResult[] = [];

    // Include all known providers, even those with 0 patients
    const allDoctorIdsList = Array.from(doctorAggs.keys()).concat(
      providers.map((p) => p.id),
    );
    // Deduplicate
    const seenIds = new Set<string>();
    const uniqueDoctorIds: string[] = [];
    for (const did of allDoctorIdsList) {
      if (!seenIds.has(did)) {
        seenIds.add(did);
        uniqueDoctorIds.push(did);
      }
    }

    for (const doctorId of uniqueDoctorIds) {
      const info = providerMap.get(doctorId);
      if (!info) continue; // skip bookings referencing deleted/unknown providers

      const agg = doctorAggs.get(doctorId);
      const total = agg?.totalPatients || 0;
      const completed = agg?.completed || 0;
      const cancelled = agg?.cancelled || 0;
      const noShow = agg?.noShow || 0;
      const newP = agg?.newPatients || 0;
      const followUp = agg?.followUps || 0;

      // Target
      const target = DEFAULT_TARGETS[info.level || ''] || FALLBACK_TARGET;

      // Avg daily = total patients / business days in period (at least 1)
      const effectiveDays = businessDays > 0 ? businessDays : 1;
      const avgDaily = round2(total / effectiveDays);

      // Utilization %
      const utilizationPct = target > 0 ? round2((avgDaily / target) * 100) : 0;

      // Census share %
      const censusSharePct =
        departmentTotalPatients > 0
          ? round2((total / departmentTotalPatients) * 100)
          : 0;

      // Productivity
      const consultArr = agg?.consultMinutes || [];
      const waitArr = agg?.waitMinutes || [];
      const orderArr = agg?.orderCounts || [];
      const encCoreIds = agg?.encounterCoreIds || [];

      const avgConsultMinutes =
        consultArr.length > 0
          ? round2(consultArr.reduce((s, v) => s + v, 0) / consultArr.length)
          : 0;

      const avgWaitMinutes =
        waitArr.length > 0
          ? round2(waitArr.reduce((s, v) => s + v, 0) / waitArr.length)
          : 0;

      const ordersPerEncounter =
        orderArr.length > 0
          ? round2(orderArr.reduce((s, v) => s + v, 0) / orderArr.length)
          : 0;

      // Documentation completeness: encounters with notes / total encounters
      const documentedCount = encCoreIds.filter((eid) => notedEncounterCoreIds.has(eid)).length;
      const documentationPct =
        encCoreIds.length > 0
          ? round2((documentedCount / encCoreIds.length) * 100)
          : 0;

      // Completion / no-show rates
      const completionRate =
        total > 0 ? round2((completed / total) * 100) : 0;
      const noShowRate =
        total > 0 ? round2((noShow / total) * 100) : 0;

      // Trend — last 30 days
      const dayMap = doctorTrendMap.get(doctorId) || new Map();
      const trend = trendDates.map((d) => ({ date: d, count: dayMap.get(d) || 0 }));

      doctors.push({
        doctorId,
        name: info.name,
        specialty: info.specialty,
        metrics: {
          totalPatients: total,
          newPatients: newP,
          followUps: followUp,
          completed,
          cancelled,
          noShow,
          completionRate,
          noShowRate,
        },
        utilization: {
          target,
          avgDaily,
          utilizationPct,
          censusSharePct,
        },
        productivity: {
          avgConsultMinutes,
          avgWaitMinutes,
          ordersPerEncounter,
          documentationPct,
        },
        trend,
      });
    }

    // Sort doctors by volume descending (most active first)
    doctors.sort((a, b) => b.metrics.totalPatients - a.metrics.totalPatients);

    // -----------------------------------------------------------------------
    // 10. Rankings (top 10 per category)
    // -----------------------------------------------------------------------
    const activeDoctors = doctors.filter((d) => d.metrics.totalPatients > 0);

    const byVolume = activeDoctors
      .slice(0, 10)
      .map((d) => ({ doctorId: d.doctorId, name: d.name, count: d.metrics.totalPatients }));

    const byUtilization = [...activeDoctors]
      .sort((a, b) => b.utilization.utilizationPct - a.utilization.utilizationPct)
      .slice(0, 10)
      .map((d) => ({ doctorId: d.doctorId, name: d.name, pct: d.utilization.utilizationPct }));

    const byDocumentation = [...activeDoctors]
      .sort((a, b) => b.productivity.documentationPct - a.productivity.documentationPct)
      .slice(0, 10)
      .map((d) => ({ doctorId: d.doctorId, name: d.name, pct: d.productivity.documentationPct }));

    // -----------------------------------------------------------------------
    // 11. Weekly comparison (this week vs last week)
    // -----------------------------------------------------------------------
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - dayOfWeek);
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    for (const bk of bookings) {
      const bDate = bk.createdAt;
      if (bDate >= thisWeekStart) {
        thisWeekTotal++;
      } else if (bDate >= lastWeekStart && bDate < lastWeekEnd) {
        lastWeekTotal++;
      }
    }

    return NextResponse.json({
      period: periodLabel,
      departmentFilter: departmentId,
      totalDoctors: doctors.length,
      departmentTotalPatients,
      weeklyComparison: {
        thisWeek: thisWeekTotal,
        lastWeek: lastWeekTotal,
        changePct:
          lastWeekTotal > 0
            ? round2(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
            : thisWeekTotal > 0
              ? 100
              : 0,
      },
      doctors,
      rankings: {
        byVolume,
        byUtilization,
        byDocumentation,
      },
    });
  }),
  { permissionKey: 'analytics.view' },
);

// ---------------------------------------------------------------------------
// Count business days (Sun-Thu for Saudi Arabia)
// Friday and Saturday are the weekend
// ---------------------------------------------------------------------------
function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(23, 59, 59, 999);

  while (current <= endNorm) {
    const day = current.getDay(); // 0=Sun, 5=Fri, 6=Sat
    if (day !== 5 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}
