/**
 * HAI Rate Calculation Engine — NHSN-standard HAI rate formulas.
 * VAP/CLABSI/CAUTI per 1000 device-days, SSI per 100 procedures.
 */

import { prisma, prismaModel } from '@/lib/db/prisma';

// ── NHSN Benchmark Percentiles (per 1000 device-days unless noted) ──────────
// Source: CDC NHSN 2022 aggregate data for adult ICUs
export const NHSN_BENCHMARKS: Record<string, { p25: number; p50: number; p75: number; p90: number; unit: string }> = {
  VAP:    { p25: 0.0, p50: 0.5, p75: 1.5, p90: 3.2, unit: '/1000 vent-days' },
  CLABSI: { p25: 0.0, p50: 0.6, p75: 1.3, p90: 2.4, unit: '/1000 CL-days' },
  CAUTI:  { p25: 0.0, p50: 0.8, p75: 1.8, p90: 3.5, unit: '/1000 cath-days' },
  SSI:    { p25: 0.5, p50: 1.2, p75: 2.5, p90: 4.0, unit: '/100 procedures' },
};

export interface HAIRateResult {
  type: string;
  infections: number;
  denominatorValue: number;
  denominatorLabel: string;
  rate: number;
  benchmark: typeof NHSN_BENCHMARKS['VAP'] | null;
  percentilePosition: string; // 'below_p25' | 'p25_p50' | 'p50_p75' | 'p75_p90' | 'above_p90'
}

export interface MonthlyRate {
  month: string; // YYYY-MM
  type: string;
  infections: number;
  denominator: number;
  rate: number;
}

function getPercentilePosition(rate: number, bench: typeof NHSN_BENCHMARKS['VAP']): string {
  if (rate <= bench.p25) return 'below_p25';
  if (rate <= bench.p50) return 'p25_p50';
  if (rate <= bench.p75) return 'p50_p75';
  if (rate <= bench.p90) return 'p75_p90';
  return 'above_p90';
}

/**
 * Get total device-days for a date range by summing DeviceDayRecord entries.
 */
export async function getDeviceDayTotals(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  department?: string
): Promise<{ patientDays: number; ventilatorDays: number; centralLineDays: number; urinaryCatheterDays: number }> {
  const where: any = {
    tenantId,
    recordDate: { gte: startDate, lte: endDate },
  };
  if (department) where.department = department;

  const result: any = await prismaModel('deviceDayRecord')?.aggregate?.({
    where,
    _sum: {
      patientDays: true,
      ventilatorDays: true,
      centralLineDays: true,
      urinaryCatheterDays: true,
    },
  }).catch(() => null);

  return {
    patientDays: result?._sum?.patientDays || 0,
    ventilatorDays: result?._sum?.ventilatorDays || 0,
    centralLineDays: result?._sum?.centralLineDays || 0,
    urinaryCatheterDays: result?._sum?.urinaryCatheterDays || 0,
  };
}

/**
 * Get completed surgical procedure count from OrCase model.
 */
export async function getProcedureCount(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    const count = await prisma.orCase.count({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'CLOSED'] },
        createdAt: { gte: startDate, lte: endDate },
      },
    });
    return count;
  } catch {
    return 0;
  }
}

/**
 * Count HAI infections by type from InfectionSurveillance model.
 */
export async function getHAICounts(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  department?: string
): Promise<Record<string, number>> {
  const where: any = {
    tenantId,
    onset: 'HEALTHCARE_ASSOCIATED',
    reportDate: { gte: startDate, lte: endDate },
  };

  const records = await prismaModel('infectionSurveillance')?.findMany?.({
    where,
    select: { infectionType: true },
  }).catch(() => []);

  const counts: Record<string, number> = {};
  for (const r of (records || [])) {
    const t = r.infectionType || 'OTHER';
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

/**
 * Calculate standardized HAI rates with NHSN benchmark comparison.
 */
export async function calculateHAIRates(
  tenantId: string,
  startMonth: string,  // YYYY-MM
  endMonth: string     // YYYY-MM
): Promise<{ rates: HAIRateResult[]; monthlyTrend: MonthlyRate[]; deviceDayTotals: any }> {
  const startDate = new Date(startMonth + '-01T00:00:00Z');
  const endParts = endMonth.split('-');
  const endYear = parseInt(endParts[0]);
  const endMon = parseInt(endParts[1]);
  const lastDay = new Date(endYear, endMon, 0).getDate();
  const endDate = new Date(`${endMonth}-${lastDay}T23:59:59Z`);

  // Get totals
  const deviceDays = await getDeviceDayTotals(tenantId, startDate, endDate);
  const haiCounts = await getHAICounts(tenantId, startDate, endDate);
  const procedureCount = await getProcedureCount(tenantId, startDate, endDate);

  // Calculate rates
  const rates: HAIRateResult[] = [
    {
      type: 'VAP',
      infections: haiCounts['VAP'] || 0,
      denominatorValue: deviceDays.ventilatorDays,
      denominatorLabel: 'ventilator-days',
      rate: deviceDays.ventilatorDays > 0
        ? parseFloat(((haiCounts['VAP'] || 0) / deviceDays.ventilatorDays * 1000).toFixed(2))
        : 0,
      benchmark: NHSN_BENCHMARKS.VAP,
      percentilePosition: 'below_p25',
    },
    {
      type: 'CLABSI',
      infections: haiCounts['CLABSI'] || 0,
      denominatorValue: deviceDays.centralLineDays,
      denominatorLabel: 'central line-days',
      rate: deviceDays.centralLineDays > 0
        ? parseFloat(((haiCounts['CLABSI'] || 0) / deviceDays.centralLineDays * 1000).toFixed(2))
        : 0,
      benchmark: NHSN_BENCHMARKS.CLABSI,
      percentilePosition: 'below_p25',
    },
    {
      type: 'CAUTI',
      infections: haiCounts['CAUTI'] || 0,
      denominatorValue: deviceDays.urinaryCatheterDays,
      denominatorLabel: 'catheter-days',
      rate: deviceDays.urinaryCatheterDays > 0
        ? parseFloat(((haiCounts['CAUTI'] || 0) / deviceDays.urinaryCatheterDays * 1000).toFixed(2))
        : 0,
      benchmark: NHSN_BENCHMARKS.CAUTI,
      percentilePosition: 'below_p25',
    },
    {
      type: 'SSI',
      infections: haiCounts['SSI'] || 0,
      denominatorValue: procedureCount,
      denominatorLabel: 'procedures',
      rate: procedureCount > 0
        ? parseFloat(((haiCounts['SSI'] || 0) / procedureCount * 100).toFixed(2))
        : 0,
      benchmark: NHSN_BENCHMARKS.SSI,
      percentilePosition: 'below_p25',
    },
  ];

  // Set percentile position
  for (const r of rates) {
    if (r.benchmark) {
      r.percentilePosition = getPercentilePosition(r.rate, r.benchmark);
    }
  }

  // Monthly trend (iterate through months in range)
  const monthlyTrend: MonthlyRate[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59);
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

    const mDeviceDays = await getDeviceDayTotals(tenantId, monthStart, monthEnd);
    const mHaiCounts = await getHAICounts(tenantId, monthStart, monthEnd);
    const mProcCount = await getProcedureCount(tenantId, monthStart, monthEnd);

    for (const type of ['VAP', 'CLABSI', 'CAUTI', 'SSI'] as const) {
      const infections = mHaiCounts[type] || 0;
      let denominator = 0;
      let rate = 0;
      if (type === 'VAP') { denominator = mDeviceDays.ventilatorDays; rate = denominator > 0 ? (infections / denominator) * 1000 : 0; }
      else if (type === 'CLABSI') { denominator = mDeviceDays.centralLineDays; rate = denominator > 0 ? (infections / denominator) * 1000 : 0; }
      else if (type === 'CAUTI') { denominator = mDeviceDays.urinaryCatheterDays; rate = denominator > 0 ? (infections / denominator) * 1000 : 0; }
      else { denominator = mProcCount; rate = denominator > 0 ? (infections / denominator) * 100 : 0; }

      monthlyTrend.push({ month: monthStr, type, infections, denominator, rate: parseFloat(rate.toFixed(2)) });
    }

    cur.setMonth(cur.getMonth() + 1);
  }

  return { rates, monthlyTrend, deviceDayTotals: deviceDays };
}
