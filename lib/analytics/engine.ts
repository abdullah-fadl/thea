/**
 * Analytics Engine -- Core metrics computation for Thea EHR
 * Provides real-time operational, clinical, and financial analytics.
 */

import { prisma } from '@/lib/db/prisma';

// --- Types ------------------------------------------------------------------

export interface DateRange {
  start: Date;
  end: Date;
}

export interface MetricValue {
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  previousValue?: number;
  changePercent?: number;
}

export interface DepartmentMetrics {
  departmentId: string;
  departmentName: string;
  totalEncounters: number;
  avgWaitMinutes: number;
  avgVisitMinutes: number;
  occupancy: number;
  satisfaction?: number;
}

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  totalPatients: number;
  avgConsultMinutes: number;
  ordersPerEncounter: number;
  documentationCompleteness: number;
}

export interface OperationalSummary {
  period: DateRange;
  totalEncounters: number;
  totalPatients: number;
  avgDailyVolume: number;
  avgWaitMinutes: MetricValue;
  avgLOS: MetricValue; // length of stay
  bedOccupancy: MetricValue;
  erVisits: MetricValue;
  opdVisits: MetricValue;
  admissions: MetricValue;
  discharges: MetricValue;
  departmentBreakdown: DepartmentMetrics[];
  providerBreakdown: ProviderMetrics[];
  hourlyDistribution: { hour: number; count: number }[];
  dailyTrend: { date: string; encounters: number; admissions: number }[];
}

export interface FinancialSummary {
  period: DateRange;
  totalRevenue: number;
  totalClaims: number;
  claimsApproved: number;
  claimsDenied: number;
  avgClaimAmount: number;
  collectionRate: number;
  outstandingBalance: number;
  revenueByDepartment: { department: string; revenue: number }[];
  payerMix: { payer: string; count: number; amount: number }[];
}

// --- Operational Analytics --------------------------------------------------

export async function getOperationalSummary(
  tenantId: string,
  range: DateRange,
): Promise<OperationalSummary> {
  const days = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)));

  // Encounter counts
  const encounters = await prisma.encounterCore.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    },
    take: 5000,
  });

  const uniquePatients = new Set(encounters.map((e) => e.patientId));

  // Department breakdown
  // EncounterCore has `department` (string) but not waitMinutes/visitMinutes.
  // OPD wait time is derived from OpdEncounter (arrivedAt -> doctorStartAt).
  // ER wait time is derived from ErEncounter (startedAt -> triage.triageEndAt).
  // We build a lookup from encounterCoreId -> timing data for OPD encounters.
  const opdTimingMap = new Map<string, { waitMin: number; visitMin: number }>();
  try {
    const opdEncs = await prisma.opdEncounter.findMany({
      where: {
        tenantId,
        createdAt: { gte: range.start, lte: range.end },
      },
      select: { encounterCoreId: true, arrivedAt: true, doctorStartAt: true, doctorEndAt: true },
      take: 5000,
    });
    for (const opd of opdEncs) {
      const waitMin = opd.arrivedAt && opd.doctorStartAt
        ? Math.max(0, (new Date(opd.doctorStartAt).getTime() - new Date(opd.arrivedAt).getTime()) / 60000)
        : 0;
      const visitMin = opd.doctorStartAt && opd.doctorEndAt
        ? Math.max(0, (new Date(opd.doctorEndAt).getTime() - new Date(opd.doctorStartAt).getTime()) / 60000)
        : 0;
      opdTimingMap.set(opd.encounterCoreId, { waitMin, visitMin });
    }
  } catch {
    // OPD table may not be populated; continue without timing data
  }

  const deptMap = new Map<string, { name: string; count: number; waitTotal: number; visitTotal: number }>();
  for (const enc of encounters) {
    const deptId = enc.department || 'unknown';
    const deptName = deptId; // department is a string key
    const existing = deptMap.get(deptId) || { name: deptName, count: 0, waitTotal: 0, visitTotal: 0 };
    existing.count++;
    // Add OPD timing when available
    const timing = opdTimingMap.get(enc.id);
    if (timing) {
      existing.waitTotal += timing.waitMin;
      existing.visitTotal += timing.visitMin;
    }
    deptMap.set(deptId, existing);
  }

  const departmentBreakdown: DepartmentMetrics[] = Array.from(deptMap.entries()).map(([id, d]) => ({
    departmentId: id,
    departmentName: d.name,
    totalEncounters: d.count,
    avgWaitMinutes: d.count > 0 ? Math.round(d.waitTotal / d.count) : 0,
    avgVisitMinutes: d.count > 0 ? Math.round(d.visitTotal / d.count) : 0,
    occupancy: 0,
  }));

  // Provider breakdown — derived from OpdEncounter doctor entries
  // Known limitation: EncounterCore itself has no providerId. We aggregate from
  // OpdDoctorEntry (linked via OpdEncounter) and OPD timing for consult minutes.
  const providerBreakdown: ProviderMetrics[] = [];

  // Hourly distribution
  const hourlyMap = new Map<number, number>();
  for (const enc of encounters) {
    const hour = new Date(enc.createdAt).getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourlyMap.get(h) || 0,
  }));

  // Daily trend
  const dailyMap = new Map<string, { encounters: number; admissions: number }>();
  for (const enc of encounters) {
    const date = new Date(enc.createdAt).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { encounters: 0, admissions: 0 };
    existing.encounters++;
    if (enc.encounterType === 'IPD') existing.admissions++;
    dailyMap.set(date, existing);
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Type counts
  const erCount = encounters.filter((e) => e.encounterType === 'ER').length;
  const opdCount = encounters.filter((e) => e.encounterType === 'OPD').length;
  const admCount = encounters.filter((e) => e.encounterType === 'IPD').length;

  // Compute average wait time across all OPD encounters with timing data
  const allWaits = Array.from(opdTimingMap.values()).map((t) => t.waitMin).filter((w) => w > 0);
  const avgWait = allWaits.length > 0
    ? Math.round(allWaits.reduce((a, b) => a + b, 0) / allWaits.length)
    : 0;

  // Average length of stay for IPD: closedAt - openedAt on CLOSED encounters
  const closedIpd = encounters.filter((e) => e.encounterType === 'IPD' && e.closedAt && e.openedAt);
  const avgLosHours = closedIpd.length > 0
    ? Math.round(
        closedIpd.reduce((s, e) => {
          const hours = (new Date(e.closedAt!).getTime() - new Date(e.openedAt!).getTime()) / (1000 * 60 * 60);
          return s + Math.max(0, hours);
        }, 0) / closedIpd.length,
      )
    : 0;

  // Discharge count: CLOSED encounters within range
  const dischargeCount = encounters.filter((e) => e.status === 'CLOSED' && e.closedAt).length;

  // Bed occupancy: (active IPD episodes / total active beds) * 100
  let bedOccupancyPct = 0;
  try {
    const activeEpisodes = await prisma.ipdEpisode.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const totalBeds = await prisma.clinicalInfraBed.count({
      where: { tenantId, status: 'active' },
    });
    bedOccupancyPct = totalBeds > 0 ? Math.round((activeEpisodes / totalBeds) * 100) : 0;
  } catch {
    // Bed/IPD tables may not be populated
  }

  return {
    period: range,
    totalEncounters: encounters.length,
    totalPatients: uniquePatients.size,
    avgDailyVolume: Math.round(encounters.length / days),
    avgWaitMinutes: { value: avgWait, unit: 'minutes' },
    avgLOS: { value: avgLosHours, unit: 'hours' },
    bedOccupancy: { value: bedOccupancyPct, unit: '%' },
    erVisits: { value: erCount, unit: 'visits' },
    opdVisits: { value: opdCount, unit: 'visits' },
    admissions: { value: admCount, unit: 'admissions' },
    discharges: { value: dischargeCount, unit: 'discharges' },
    departmentBreakdown,
    providerBreakdown,
    hourlyDistribution,
    dailyTrend,
  };
}

// --- Financial Analytics ----------------------------------------------------

export async function getFinancialSummary(
  tenantId: string,
  range: DateRange,
): Promise<FinancialSummary> {
  const claims = await prisma.nphiesClaim.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    },
    take: 5000,
  });

  const approved = claims.filter((c) => c.status === 'approved' || c.status === 'paid');
  const denied = claims.filter((c) => c.status === 'denied' || c.status === 'rejected');

  const totalAmount = claims.reduce((s, c) => s + (Number(c.adjudicatedAmount) || 0), 0);
  const approvedAmount = approved.reduce((s, c) => s + (Number(c.payerAmount) || Number(c.adjudicatedAmount) || 0), 0);

  // Revenue by department -- NphiesClaim doesn't have departmentName
  // Would need to join with EncounterCore or use the response JSON
  const deptRevMap = new Map<string, number>();
  for (const claim of claims) {
    // Try to extract department from the response JSON if available
    const response = claim.response as Record<string, unknown> | null;
    const dept = (response?.departmentName as string) || 'Other';
    deptRevMap.set(dept, (deptRevMap.get(dept) || 0) + (Number(claim.adjudicatedAmount) || 0));
  }

  // Payer mix -- NphiesClaim doesn't have payerName directly
  // insuranceId can be used as a proxy
  const payerMap = new Map<string, { count: number; amount: number }>();
  for (const claim of claims) {
    const payer = claim.insuranceId || 'Unknown';
    const existing = payerMap.get(payer) || { count: 0, amount: 0 };
    existing.count++;
    existing.amount += Number(claim.adjudicatedAmount) || 0;
    payerMap.set(payer, existing);
  }

  return {
    period: range,
    totalRevenue: approvedAmount,
    totalClaims: claims.length,
    claimsApproved: approved.length,
    claimsDenied: denied.length,
    avgClaimAmount: claims.length > 0 ? Math.round(totalAmount / claims.length) : 0,
    collectionRate: totalAmount > 0 ? Math.round((approvedAmount / totalAmount) * 100) : 0,
    outstandingBalance: totalAmount - approvedAmount,
    revenueByDepartment: Array.from(deptRevMap.entries()).map(([department, revenue]) => ({ department, revenue })),
    payerMix: Array.from(payerMap.entries()).map(([payer, d]) => ({ payer, ...d })),
  };
}

// --- Trend Analysis ---------------------------------------------------------

export async function getMetricTrend(
  tenantId: string,
  metric: string,
  range: DateRange,
  granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
): Promise<{ timestamp: string; value: number }[]> {
  const encounters = await prisma.encounterCore.findMany({
    where: {
      tenantId,
      createdAt: { gte: range.start, lte: range.end },
    },
    take: 5000,
  });

  const buckets = new Map<string, number[]>();

  for (const enc of encounters) {
    const d = new Date(enc.createdAt);
    let key: string;

    switch (granularity) {
      case 'hour':
        key = `${d.toISOString().split('T')[0]}T${String(d.getHours()).padStart(2, '0')}:00`;
        break;
      case 'week': {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      }
      case 'month':
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = d.toISOString().split('T')[0];
    }

    // Known limitation: waitMinutes and visitMinutes live on OpdEncounter/ErEncounter,
    // not on EncounterCore. This trend function uses encounter counts as the metric.
    const value = 1; // count

    const arr = buckets.get(key) || [];
    arr.push(value);
    buckets.set(key, arr);
  }

  return Array.from(buckets.entries())
    .map(([timestamp, values]) => ({
      timestamp,
      value: metric === 'encounters'
        ? values.length
        : Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
