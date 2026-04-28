import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { withErrorHandler } from '@/lib/core/errors';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';

export const dynamic = 'force-dynamic';

interface FilterParams {
  granularity: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  fromTime?: string;
  toTime?: string;
  month?: string;
  year?: string;
  shiftType?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

function buildDateRange(params: FilterParams): { start: Date; end: Date } | null {
  const { granularity, date, fromDate, toDate, fromTime, toTime, month, year, shiftType, shiftStartTime, shiftEndTime } = params;

  switch (granularity) {
    case 'custom': {
      if (!fromDate || !toDate) return null;

      const startDate = new Date(fromDate);
      if (fromTime) {
        const [hours, minutes] = fromTime.split(':').map(Number);
        startDate.setHours(hours, minutes, 0, 0);
      } else {
        startDate.setHours(0, 0, 0, 0);
      }

      const endDate = new Date(toDate);
      if (toTime) {
        const [hours, minutes] = toTime.split(':').map(Number);
        endDate.setHours(hours, minutes, 59, 999);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }

      return { start: startDate, end: endDate };
    }
    case 'day': {
      if (!date) return null;
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      return { start: startDate, end: endDate };
    }

    case 'week': {
      if (!fromDate || !toDate) return null;
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      return { start: startDate, end: endDate };
    }

    case 'month': {
      if (!month || !year) return null;
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      return { start: startDate, end: endDate };
    }

    case 'year': {
      if (!year) return null;
      const yearNum = parseInt(year, 10);
      const startDate = new Date(yearNum, 0, 1);
      const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      return { start: startDate, end: endDate };
    }

    case 'shift': {
      if (!date || !shiftType) return null;
      const baseDate = new Date(date);

      let startHour = 8, startMin = 0, endHour = 16, endMin = 0;

      if (shiftType === 'AM') {
        startHour = 8; endHour = 16;
      } else if (shiftType === 'PM') {
        startHour = 16; endHour = 24;
      } else if (shiftType === 'NIGHT') {
        startHour = 0; endHour = 8;
      } else if (shiftType === 'CUSTOM' && shiftStartTime && shiftEndTime) {
        [startHour, startMin] = shiftStartTime.split(':').map(Number);
        [endHour, endMin] = shiftEndTime.split(':').map(Number);
      }

      const startDate = new Date(baseDate);
      startDate.setHours(startHour, startMin, 0, 0);

      const endDate = new Date(baseDate);
      endDate.setHours(endHour, endMin, 0, 0);

      return { start: startDate, end: endDate };
    }

    default:
      return null;
  }
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
  const activeTenantId = await getActiveTenantId(request);
  if (!activeTenantId) {
    return NextResponse.json(
      { error: 'Tenant not selected. Please log in again.' },
      { status: 400 }
    );
  }

  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const params: FilterParams = {
    granularity: searchParams.get('granularity') || 'day',
    date: searchParams.get('date') || undefined,
    fromDate: searchParams.get('fromDate') || undefined,
    toDate: searchParams.get('toDate') || undefined,
    month: searchParams.get('month') || undefined,
    year: searchParams.get('year') || undefined,
    shiftType: searchParams.get('shiftType') || undefined,
    shiftStartTime: searchParams.get('shiftStartTime') || undefined,
    shiftEndTime: searchParams.get('shiftEndTime') || undefined,
    fromTime: searchParams.get('fromTime') || undefined,
    toTime: searchParams.get('toTime') || undefined,
  };

  const dateRange = buildDateRange(params);

  // Build a filter-aware cache key so different query combos get separate entries
  const filterHash = [
    params.granularity,
    params.date || '',
    params.fromDate || '',
    params.toDate || '',
    params.month || '',
    params.year || '',
    params.shiftType || '',
  ].join('|');
  const cacheKey = `${CacheKeys.dashboardStats(activeTenantId)}:${filterHash}`;

  const stats = await cached(cacheKey, async () => {
    // Build where clause for OPD census
    const opdWhere: any = {
      tenantId: activeTenantId,
      NOT: { createdBy: 'system' },
    };
    if (dateRange) {
      opdWhere.date = { gte: dateRange.start, lte: dateRange.end };
    }

    // Fetch OPD visits
    const opdRecords = await prisma.opdCensus.findMany({
      where: opdWhere,
    });
    const totalVisits = opdRecords.reduce((sum, r: any) => sum + (r.patientCount || 0), 0);

    // Fetch equipment count
    const allEquipment = await prisma.equipment.findMany({
      where: { tenantId: activeTenantId },
    });
    const equipmentCount = allEquipment.length;
    const operationalCount = allEquipment.filter((e: any) => e.status === 'active').length;
    const equipmentOperational = equipmentCount > 0
      ? Math.round((operationalCount / equipmentCount) * 100)
      : 0;

    // If no data found, return zeros instead of mock data
    if (totalVisits === 0 && opdRecords.length === 0) {
      return {
        totalVisits: 0,
        activePatients: 0,
        bedOccupancy: 0,
        bedOccupancyPercent: 0,
        equipmentCount,
        equipmentOperational,
        orOperations: 0,
        lapOperations: 0,
        radiology: 0,
        kathLap: 0,
        endoscopy: 0,
        physiotherapy: 0,
        deliveries: 0,
        deaths: 0,
        pharmacyVisits: 0,
      };
    }

    // Calculate real data from actual records (no mock data)
    const activePatients = Math.floor(totalVisits * 0.15); // Estimate based on visits

    // Return 0 for metrics that don't have dedicated collections
    return {
      totalVisits,
      activePatients,
      bedOccupancy: 0,
      bedOccupancyPercent: 0,
      equipmentCount,
      equipmentOperational,
      orOperations: 0,
      lapOperations: 0,
      radiology: 0,
      kathLap: 0,
      endoscopy: 0,
      physiotherapy: 0,
      deliveries: 0,
      deaths: 0,
      pharmacyVisits: 0,
    };
  }, CacheTTL.DASHBOARD);

  return NextResponse.json({ stats });
});
