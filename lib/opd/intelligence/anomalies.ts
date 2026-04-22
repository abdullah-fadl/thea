/**
 * OPD Intelligence — Real-time Anomaly Detection Engine
 *
 * 5 anomaly types: sudden_drop, sudden_spike, no_activity,
 *                  unusual_noshow, wait_time_spike
 *
 * Compares today's data against historical baselines (last 4 weeks same day-of-week).
 */

import { prisma } from '@/lib/db/prisma';
import { getDeptNames } from './dataQueries';

// ── Types ──

export type AnomalyType =
  | 'sudden_drop'
  | 'sudden_spike'
  | 'no_activity'
  | 'unusual_noshow'
  | 'wait_time_spike';

export type AnomalySeverity = 'critical' | 'high' | 'medium';

export interface OPDAnomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  departmentId?: string;
  departmentName?: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  detectedAt: string;
  autoResolves: boolean;
}

// ── Helpers ──

function uuid(): string {
  return 'anom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getHistoricalDates(weeksBack: number = 4): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  const dow = today.getDay();

  for (let w = 1; w <= weeksBack; w++) {
    const d = new Date(today);
    d.setDate(d.getDate() - w * 7);
    // Same day of week
    const diff = d.getDay() - dow;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Baseline Computation ──

interface DeptBaseline {
  departmentId: string;
  departmentName: string;
  avgPatients: number;
  stdDevPatients: number;
  avgNoShowRate: number;
  historicalValues: number[];
}

async function getBaselines(_db: any, tenantId: string): Promise<Map<string, DeptBaseline>> {
  const deptNames = await getDeptNames(null, tenantId);
  const historicalDates = getHistoricalDates(4);

  const baselines = new Map<string, DeptBaseline>();

  for (const histDate of historicalDates) {
    const startOfDay = new Date(histDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(histDate);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await prisma.opdDailyData.findMany({
      where: {
        tenantId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      select: { departmentId: true, totalPatients: true, booked: true, noShow: true },
      take: 500,
    });

    // Aggregate per department
    const deptAgg = new Map<string, { patients: number; booked: number; noShow: number }>();
    for (const r of records) {
      const deptId = r.departmentId;
      if (!deptId) continue;
      if (!deptAgg.has(deptId)) deptAgg.set(deptId, { patients: 0, booked: 0, noShow: 0 });
      const a = deptAgg.get(deptId)!;
      a.patients += r.totalPatients || 0;
      a.booked += r.booked || 0;
      a.noShow += r.noShow || 0;
    }

    for (const [deptId, agg] of deptAgg) {
      if (!baselines.has(deptId)) {
        baselines.set(deptId, {
          departmentId: deptId,
          departmentName: deptNames.get(deptId) || deptId,
          avgPatients: 0,
          stdDevPatients: 0,
          avgNoShowRate: 0,
          historicalValues: [],
        });
      }
      baselines.get(deptId)!.historicalValues.push(agg.patients);
    }
  }

  // Compute stats
  for (const [, baseline] of baselines) {
    const vals = baseline.historicalValues;
    if (vals.length > 0) {
      baseline.avgPatients = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      baseline.stdDevPatients = stdDev(vals);
    }
  }

  return baselines;
}

// ── Today's Data ──

interface TodayDeptData {
  departmentId: string;
  totalPatients: number;
  booked: number;
  noShow: number;
  walkIn: number;
}

async function getTodayData(_db: any, tenantId: string): Promise<Map<string, TodayDeptData>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const records = await prisma.opdDailyData.findMany({
    where: {
      tenantId,
      date: { gte: today, lte: endOfDay },
    },
    select: { departmentId: true, totalPatients: true, booked: true, noShow: true, walkIn: true },
    take: 500,
  });

  const result = new Map<string, TodayDeptData>();
  for (const r of records) {
    const deptId = r.departmentId;
    if (!deptId) continue;
    if (!result.has(deptId)) {
      result.set(deptId, { departmentId: deptId, totalPatients: 0, booked: 0, noShow: 0, walkIn: 0 });
    }
    const d = result.get(deptId)!;
    d.totalPatients += r.totalPatients || 0;
    d.booked += r.booked || 0;
    d.noShow += r.noShow || 0;
    d.walkIn += r.walkIn || 0;
  }

  return result;
}

// ── Wait Time Data ──

async function getTodayWaitTimes(_db: any, tenantId: string): Promise<Map<string, { avgWait: number; count: number }>> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // OpdEncounter has flattened timestamp fields: arrivedAt, doctorStartAt
  // We need encounterCore for departmentId
  const encounters = await prisma.opdEncounter.findMany({
    where: {
      tenantId,
      createdAt: { gte: today, lte: endOfDay },
      arrivedAt: { not: null },
      doctorStartAt: { not: null },
    },
    select: {
      arrivedAt: true,
      doctorStartAt: true,
      encounterCore: { select: { department: true } },
    },
    take: 500,
  });

  const result = new Map<string, { waits: number[]; deptId: string }>();
  for (const enc of encounters) {
    const deptId = enc.encounterCore?.department || 'unknown';

    if (enc.arrivedAt && enc.doctorStartAt) {
      const waitMin = Math.round(
        (new Date(enc.doctorStartAt).getTime() - new Date(enc.arrivedAt).getTime()) / 60000,
      );
      if (waitMin >= 0 && waitMin < 300) {
        if (!result.has(deptId)) result.set(deptId, { waits: [], deptId });
        result.get(deptId)!.waits.push(waitMin);
      }
    }
  }

  const output = new Map<string, { avgWait: number; count: number }>();
  for (const [deptId, data] of result) {
    const avg = Math.round(data.waits.reduce((a, b) => a + b, 0) / data.waits.length);
    output.set(deptId, { avgWait: avg, count: data.waits.length });
  }
  return output;
}

// ── Anomaly Detection Main ──

export async function detectAnomalies(
  _db: any,
  tenantId: string,
): Promise<OPDAnomaly[]> {
  const [baselines, todayData, waitTimes] = await Promise.all([
    getBaselines(_db, tenantId),
    getTodayData(_db, tenantId),
    getTodayWaitTimes(_db, tenantId),
  ]);

  const anomalies: OPDAnomaly[] = [];
  const nowStr = new Date().toISOString();
  const deptNames = await getDeptNames(null, tenantId);

  // Check each department that has a baseline
  for (const [deptId, baseline] of baselines) {
    const today = todayData.get(deptId);
    const deptName = baseline.departmentName;

    // 1. SUDDEN_DROP — today's patients < avg - 2*stdDev
    if (today && baseline.avgPatients > 5) {
      const threshold = Math.max(0, baseline.avgPatients - 2 * baseline.stdDevPatients);
      if (today.totalPatients < threshold && today.totalPatients < baseline.avgPatients * 0.5) {
        const deviation = baseline.avgPatients > 0
          ? Math.round(((baseline.avgPatients - today.totalPatients) / baseline.avgPatients) * 100)
          : 0;
        anomalies.push({
          id: uuid(),
          type: 'sudden_drop',
          severity: deviation > 60 ? 'critical' : 'high',
          titleAr: `${deptName} — انخفاض مفاجئ في المرضى`,
          titleEn: `${deptName} — sudden patient drop`,
          descriptionAr: `${today.totalPatients} مريض اليوم مقابل المتوسط ${baseline.avgPatients}. انخفاض ${deviation}%`,
          descriptionEn: `${today.totalPatients} patients today vs average ${baseline.avgPatients}. Down ${deviation}%`,
          departmentId: deptId,
          departmentName: deptName,
          currentValue: today.totalPatients,
          expectedValue: baseline.avgPatients,
          deviationPercent: deviation,
          detectedAt: nowStr,
          autoResolves: true,
        });
      }
    }

    // 2. SUDDEN_SPIKE — today's patients > avg + 2*stdDev
    if (today && baseline.avgPatients > 0) {
      const threshold = baseline.avgPatients + 2 * baseline.stdDevPatients;
      if (today.totalPatients > threshold && today.totalPatients > baseline.avgPatients * 1.5) {
        const deviation = Math.round(((today.totalPatients - baseline.avgPatients) / baseline.avgPatients) * 100);
        anomalies.push({
          id: uuid(),
          type: 'sudden_spike',
          severity: deviation > 80 ? 'critical' : 'high',
          titleAr: `${deptName} — ارتفاع مفاجئ في المرضى`,
          titleEn: `${deptName} — sudden patient spike`,
          descriptionAr: `${today.totalPatients} مريض اليوم مقابل المتوسط ${baseline.avgPatients}. ارتفاع ${deviation}%`,
          descriptionEn: `${today.totalPatients} patients today vs average ${baseline.avgPatients}. Up ${deviation}%`,
          departmentId: deptId,
          departmentName: deptName,
          currentValue: today.totalPatients,
          expectedValue: baseline.avgPatients,
          deviationPercent: deviation,
          detectedAt: nowStr,
          autoResolves: true,
        });
      }
    }

    // 3. NO_ACTIVITY — department with baseline > 5 but 0 patients today (after 10am)
    const hourNow = new Date().getHours();
    if (!today && baseline.avgPatients > 5 && hourNow >= 10) {
      anomalies.push({
        id: uuid(),
        type: 'no_activity',
        severity: 'critical',
        titleAr: `${deptName} — لا يوجد نشاط`,
        titleEn: `${deptName} — no activity`,
        descriptionAr: `لم يتم تسجيل أي مريض حتى الآن. المتوسط اليومي: ${baseline.avgPatients} مريض`,
        descriptionEn: `No patients recorded yet. Daily average: ${baseline.avgPatients} patients`,
        departmentId: deptId,
        departmentName: deptName,
        currentValue: 0,
        expectedValue: baseline.avgPatients,
        deviationPercent: 100,
        detectedAt: nowStr,
        autoResolves: true,
      });
    }

    // 4. UNUSUAL_NOSHOW — today's no-show rate is double the historical avg
    if (today && today.booked > 10) {
      const todayNoShowRate = Math.round((today.noShow / today.booked) * 100);
      // Get historical no-show rates
      const histNoShow = await getHistoricalNoShowRate(_db, tenantId, deptId);
      if (histNoShow > 0 && todayNoShowRate > histNoShow * 2 && todayNoShowRate > 20) {
        anomalies.push({
          id: uuid(),
          type: 'unusual_noshow',
          severity: todayNoShowRate > 40 ? 'critical' : 'high',
          titleAr: `${deptName} — نسبة عدم حضور غير طبيعية`,
          titleEn: `${deptName} — unusual no-show rate`,
          descriptionAr: `نسبة عدم الحضور ${todayNoShowRate}% اليوم مقابل المتوسط ${histNoShow}%`,
          descriptionEn: `No-show rate ${todayNoShowRate}% today vs average ${histNoShow}%`,
          departmentId: deptId,
          departmentName: deptName,
          currentValue: todayNoShowRate,
          expectedValue: histNoShow,
          deviationPercent: Math.round(((todayNoShowRate - histNoShow) / histNoShow) * 100),
          detectedAt: nowStr,
          autoResolves: true,
        });
      }
    }
  }

  // 5. WAIT_TIME_SPIKE — avg wait today > 45 min (Saudi standard: 30 min)
  for (const [deptId, wt] of waitTimes) {
    if (wt.avgWait > 45 && wt.count >= 3) {
      const deptName = deptNames.get(deptId) || deptId;
      anomalies.push({
        id: uuid(),
        type: 'wait_time_spike',
        severity: wt.avgWait > 90 ? 'critical' : wt.avgWait > 60 ? 'high' : 'medium',
        titleAr: `${deptName} — وقت انتظار مرتفع`,
        titleEn: `${deptName} — high wait time`,
        descriptionAr: `متوسط الانتظار ${wt.avgWait} دقيقة (${wt.count} قياس). المعيار: ≤30 دقيقة`,
        descriptionEn: `Average wait ${wt.avgWait} min (${wt.count} samples). Standard: ≤30 min`,
        departmentId: deptId,
        departmentName: deptName,
        currentValue: wt.avgWait,
        expectedValue: 30,
        deviationPercent: Math.round(((wt.avgWait - 30) / 30) * 100),
        detectedAt: nowStr,
        autoResolves: true,
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  anomalies.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return anomalies;
}

// ── Helper: historical no-show rate for a department ──

async function getHistoricalNoShowRate(_db: any, tenantId: string, departmentId: string): Promise<number> {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  fourWeeksAgo.setHours(0, 0, 0, 0);

  const records = await prisma.opdDailyData.findMany({
    where: {
      tenantId,
      departmentId,
      date: { gte: fourWeeksAgo },
    },
    select: { booked: true, noShow: true },
    take: 500,
  });

  let totalBooked = 0;
  let totalNoShow = 0;
  for (const r of records) {
    totalBooked += r.booked || 0;
    totalNoShow += r.noShow || 0;
  }

  return totalBooked > 0 ? Math.round((totalNoShow / totalBooked) * 100) : 0;
}
