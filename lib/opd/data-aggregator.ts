/**
 * OPD Data Aggregator
 * Aggregates data from opd_daily_data and opd_census tables
 * to provide unified data for OPD dashboard pages.
 * Migrated from MongoDB to Prisma.
 */

import { prisma } from '@/lib/db/prisma';

interface DateRange {
  gte?: Date;
  lte?: Date;
}

/**
 * Convert OpdDailyData to census format for compatibility
 */
function convertDailyDataToCensus(dailyData: any): any {
  return {
    id: dailyData.id,
    date: dailyData.date,
    departmentId: dailyData.departmentId,
    doctorId: dailyData.doctorId,
    clinicId: dailyData.clinicId || '',
    patientCount: dailyData.totalPatients,
    newPatients: (dailyData.fv || 0) + (dailyData.fcv || 0),
    followUpPatients: (dailyData.fuv || 0) + (dailyData.rv || 0),
    booked: dailyData.booked,
    walkIn: dailyData.walkIn,
    noShow: dailyData.noShow,
    utilizationRate: calculateUtilization(dailyData),
    slotsPerHour: dailyData.slotsPerHour,
    clinicStartTime: dailyData.clinicStartTime,
    clinicEndTime: dailyData.clinicEndTime,
    timeDistribution: dailyData.timeDistribution,
    procedures: dailyData.procedures,
    orSurgeries: dailyData.orSurgeries,
    admissions: dailyData.admissions,
    cath: dailyData.cath,
    deliveriesNormal: dailyData.deliveriesNormal,
    deliveriesSC: dailyData.deliveriesSC,
    ivf: dailyData.ivf,
  };
}

/**
 * Calculate utilization rate from daily data
 */
function calculateUtilization(dailyData: any): number {
  if (!dailyData.clinicStartTime || !dailyData.clinicEndTime) return 0;

  const [startHour, startMin] = dailyData.clinicStartTime.split(':').map(Number);
  const [endHour, endMin] = dailyData.clinicEndTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const durationHours = (endMinutes - startMinutes) / 60;

  if (durationHours <= 0) return 0;

  const target = durationHours * (dailyData.slotsPerHour || 0);
  if (target === 0) return 0;

  return Math.round(((dailyData.totalPatients || 0) / target) * 100);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve tenant key (e.g. 'thea-owner-dev') to tenant UUID for Prisma queries.
 * OpdCensus/OpdDailyData.tenantId are @db.Uuid (Tenant.id), not the business key.
 */
export async function resolveTenantIdToUuid(tenantIdOrKey: string): Promise<string | null> {
  if (!tenantIdOrKey) return null;
  if (UUID_REGEX.test(tenantIdOrKey)) return tenantIdOrKey;
  const tenant = await prisma.tenant.findFirst({
    where: { tenantId: tenantIdOrKey },
    select: { id: true },
  });
  return tenant?.id ?? null;
}

/**
 * Get aggregated OPD data from both opd_daily_data and opd_census
 * WITH tenant isolation
 */
export async function getAggregatedOPDData(
  dateRange: DateRange,
  departmentId?: string,
  tenantId?: string
) {
  if (!tenantId) return [];

  const tenantUuid = await resolveTenantIdToUuid(tenantId);
  if (!tenantUuid) return [];

  // Build date filters
  const dateFilter: any = {};
  if (dateRange.gte) dateFilter.gte = dateRange.gte;
  if (dateRange.lte) dateFilter.lte = dateRange.lte;

  const censusWhere: any = { tenantId: tenantUuid };
  const dailyDataWhere: any = { tenantId: tenantUuid };
  if (Object.keys(dateFilter).length > 0) {
    censusWhere.date = dateFilter;
    dailyDataWhere.date = dateFilter;
  }
  if (departmentId) {
    censusWhere.departmentId = departmentId;
    dailyDataWhere.departmentId = departmentId;
  }

  const [censusRecords, dailyDataRecords] = await Promise.all([
    prisma.opdCensus.findMany({ where: censusWhere, take: 5000 }),
    prisma.opdDailyData.findMany({ where: dailyDataWhere, take: 5000 }),
  ]);

  // Convert daily data to census format
  const convertedDailyData = dailyDataRecords.map((record: any) =>
    convertDailyDataToCensus(record)
  );

  // Merge records, prioritizing daily data (more recent/accurate)
  const mergedRecords: any[] = [];
  const dailyDataMap = new Map<string, any>();

  convertedDailyData.forEach((record: any) => {
    if (!record.doctorId) return;
    const recordDate = record.date instanceof Date ? record.date : new Date(record.date);
    const dateStr = recordDate.toISOString().split('T')[0];
    const key = `${record.doctorId}_${dateStr}`;
    dailyDataMap.set(key, record);
    mergedRecords.push(record);
  });

  // Add census records that don't have daily data equivalent
  censusRecords.forEach((record: any) => {
    if (!record.doctorId) {
      mergedRecords.push(record);
      return;
    }
    const recordDate = record.date instanceof Date ? record.date : new Date(record.date);
    const dateStr = recordDate.toISOString().split('T')[0];
    const key = `${record.doctorId}_${dateStr}`;
    if (!dailyDataMap.has(key)) {
      mergedRecords.push(record);
    }
  });

  return mergedRecords;
}

/**
 * Get statistics from aggregated data
 */
export function calculateStatsFromRecords(records: any[]) {
  const totalVisits = records.reduce((sum, r) => sum + (r.patientCount || 0), 0);
  const newPatients = records.reduce((sum, r) => sum + (r.newPatients || 0), 0);
  const followUpPatients = records.reduce((sum, r) => sum + (r.followUpPatients || 0), 0);
  const booked = records.reduce((sum, r) => sum + (r.booked || 0), 0);
  const walkIn = records.reduce((sum, r) => sum + (r.walkIn || 0), 0);
  const noShow = records.reduce((sum, r) => sum + (r.noShow || 0), 0);

  const utilizationRates = records
    .map((r) => r.utilizationRate || 0)
    .filter((rate: number) => rate > 0);
  const avgUtilization = utilizationRates.length > 0
    ? Math.round(utilizationRates.reduce((sum: number, rate: number) => sum + rate, 0) / utilizationRates.length)
    : 0;

  const activeClinicIds = new Set(
    records
      .map((r) => r.clinicId)
      .filter((id: string) => id)
  );
  const activeClinics = activeClinicIds.size;

  return {
    totalVisits,
    newPatients,
    followUpPatients,
    booked,
    walkIn,
    noShow,
    avgUtilization,
    activeClinics,
  };
}
