import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/referrals/smart-recommend?specialtyCode=cardiology&limit=5
 *
 * Returns provider recommendations ranked by availability, utilization, and activity.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const specialtyCode = req.nextUrl.searchParams.get('specialtyCode');
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get('limit')) || 5, 1),
      20
    );

    if (!specialtyCode) {
      return NextResponse.json(
        { error: 'specialtyCode required' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Special case: __ALL__ returns every active provider (manual override from UI)
    if (specialtyCode === '__ALL__') {
      const allResources = await prisma.schedulingResource.findMany({
        where: { tenantId, status: 'ACTIVE', resourceType: { in: ['DOCTOR', 'PROVIDER'] } },
        include: {
          slots: {
            where: { date: today },
            include: { reservations: { where: { status: 'ACTIVE' } } },
          },
        },
      });
      const allWithStats = allResources.map((resource) => buildProviderStats(resource, specialtyCode, now, twoHoursLater));
      const sortedAll = allWithStats.sort((a, b) => b.score - a.score);
      return NextResponse.json({ recommendations: [], allProviders: sortedAll });
    }

    // 1. Get all active DOCTOR/PROVIDER resources for this specialty
    let resources = await prisma.schedulingResource.findMany({
      where: {
        tenantId,
        specialtyCode: { equals: specialtyCode, mode: 'insensitive' },
        status: 'ACTIVE',
        resourceType: { in: ['DOCTOR', 'PROVIDER'] },
      },
      include: {
        slots: {
          where: { date: today },
          include: { reservations: { where: { status: 'ACTIVE' } } },
        },
      },
    });

    // 1b. Fallback: try matching by clinic linked to the specialty
    if (resources.length === 0) {
      const specialty = await prisma.clinicalInfraSpecialty.findFirst({
        where: {
          tenantId,
          OR: [
            { code: { equals: specialtyCode, mode: 'insensitive' } },
            { shortCode: { equals: specialtyCode, mode: 'insensitive' } },
            { name: { equals: specialtyCode, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (specialty) {
        const clinics = await prisma.clinicalInfraClinic.findMany({
          where: { tenantId, specialtyId: specialty.id, isArchived: { not: true } },
          select: { id: true },
        });
        const clinicIds = clinics.map((c) => c.id);
        if (clinicIds.length > 0) {
          resources = await prisma.schedulingResource.findMany({
            where: {
              tenantId,
              status: 'ACTIVE',
              resourceType: { in: ['DOCTOR', 'PROVIDER'] },
              clinicId: { in: clinicIds },
            },
            include: {
              slots: {
                where: { date: today },
                include: { reservations: { where: { status: 'ACTIVE' } } },
              },
            },
          });
        }
      }
    }

    // No last-resort fallback — caller handles empty list in UI

    // 2. Calculate stats for each provider
    const providersWithStats = resources.map((resource) =>
      buildProviderStats(resource, specialtyCode, now, twoHoursLater)
    );

    // 3. Sort by score (descending)
    const sorted = providersWithStats.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      recommendations: sorted.slice(0, limit),
      allProviders: sorted,
    });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['referral.create', 'referral.view', 'opd.doctor.encounter.view'],
  }
);

function buildProviderStats(resource: any, specialtyCode: string, now: Date, twoHoursLater: Date) {
  const slots = resource.slots || [];
  const totalSlotsToday = slots.length;
  const bookedSlots = slots.filter(
    (s: any) => s.status === 'BOOKED' || s.status === 'CHECKED_IN' || s.reservations.length > 0
  ).length;
  const blockedSlots = slots.filter((s: any) => s.status === 'BLOCKED').length;
  const effectiveTotal = totalSlotsToday - blockedSlots;
  const availableSlotsToday = Math.max(0, effectiveTotal - bookedSlots);
  const utilizationPct = effectiveTotal > 0 ? Math.round((bookedSlots / effectiveTotal) * 100) : 0;
  const isActiveNow = slots.some((s: any) => {
    const slotStart = new Date(s.startAt);
    const slotEnd = new Date(s.endAt);
    return (slotStart <= now && slotEnd >= now) || (slotStart >= now && slotStart <= twoHoursLater);
  });
  const openSlots = slots
    .filter((s: any) => s.status === 'OPEN' && s.reservations.length === 0 && new Date(s.startAt) > now)
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const nextAvailableSlot = openSlots[0]?.startAt?.toISOString() || null;
  const stats = {
    availableSlotsToday,
    totalSlotsToday: effectiveTotal,
    bookedToday: bookedSlots,
    utilizationPct,
    currentQueueSize: bookedSlots,
    avgWaitMinutes: 0,
  };
  const score = calculateScore({ availableSlotsToday, utilizationPct, isActiveNow });
  const recommendation = getRecommendation(availableSlotsToday, utilizationPct, isActiveNow);
  return {
    providerId: resource.resourceRefProviderId || resource.id,
    providerName: resource.nameEn || resource.displayName,
    providerNameAr: resource.nameAr || resource.displayName,
    specialtyCode: resource.specialtyCode || specialtyCode,
    clinicId: resource.clinicId,
    level: resource.level,
    score,
    isActiveNow,
    nextAvailableSlot,
    stats,
    recommendation,
  };
}

/**
 * Score calculation (0–100)
 *
 * - 40% weight for available slots (more = better, capped at 10)
 * - 30% weight for low utilization (lower = better)
 * - 30% bonus if provider is active right now
 */
function calculateScore(stats: {
  availableSlotsToday: number;
  utilizationPct: number;
  isActiveNow: boolean;
}): number {
  const AVAILABLE_WEIGHT = 40;
  const UTILIZATION_WEIGHT = 30;
  const ACTIVE_NOW_WEIGHT = 30;

  const availableScore =
    Math.min(stats.availableSlotsToday / 10, 1) * AVAILABLE_WEIGHT;
  const utilizationScore =
    (1 - stats.utilizationPct / 100) * UTILIZATION_WEIGHT;
  const activeScore = stats.isActiveNow ? ACTIVE_NOW_WEIGHT : 0;

  return Math.round(availableScore + utilizationScore + activeScore);
}

/**
 * Generate recommendation reason and confidence level.
 */
function getRecommendation(
  availableSlotsToday: number,
  utilizationPct: number,
  isActiveNow: boolean
): { reason: string; reasonEn: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  if (availableSlotsToday >= 5 && isActiveNow) {
    return {
      reason: 'عنده عيادة الآن وعدد مرضى قليل',
      reasonEn: 'Active now with low patient count',
      confidence: 'HIGH',
    };
  }
  if (availableSlotsToday >= 3 && isActiveNow) {
    return {
      reason: 'عنده عيادة الآن ومتاح',
      reasonEn: 'Active now and available',
      confidence: 'HIGH',
    };
  }
  if (availableSlotsToday >= 5) {
    return {
      reason: 'عدد مرضى قليل اليوم',
      reasonEn: 'Low patient count today',
      confidence: 'HIGH',
    };
  }
  if (isActiveNow) {
    return {
      reason: 'عنده عيادة الآن',
      reasonEn: 'Currently active',
      confidence: 'MEDIUM',
    };
  }
  if (utilizationPct < 50) {
    return {
      reason: 'نسبة إشغال منخفضة',
      reasonEn: 'Low utilization rate',
      confidence: 'MEDIUM',
    };
  }
  if (availableSlotsToday > 0) {
    return {
      reason: 'متاح للتحويل',
      reasonEn: 'Available for referral',
      confidence: 'LOW',
    };
  }
  return {
    reason: 'مشغول — قد لا يكون متاح اليوم',
    reasonEn: 'Busy — may not be available today',
    confidence: 'LOW',
  };
}
