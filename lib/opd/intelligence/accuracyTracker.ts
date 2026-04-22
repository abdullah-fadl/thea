/**
 * OPD Intelligence — Accuracy Tracker
 *
 * Tracks recommendation accuracy by comparing predicted outcomes
 * with actual outcomes. Feeds back into confidence scoring.
 *
 * Accuracy is measured by:
 * 1. Did the predicted condition persist? (validation)
 * 2. Was the recommendation acted upon? (acknowledged vs dismissed)
 * 3. Did the metric improve after action? (outcome tracking)
 *
 * NOTE: The opd_recommendation_accuracy table does not exist in Prisma schema.
 * recordAccuracyCheck is a no-op, getAccuracySummary returns empty results,
 * and validateRecommendations queries Prisma for expired recs but skips accuracy recording.
 */

import { prisma } from '@/lib/db/prisma';
import type { OPDRecommendation } from './recommendations';

// ── Types ──

export interface AccuracyRecord {
  recommendationId: string;
  type: string;
  departmentId?: string;
  doctorId?: string;
  metricAtCreation: number;
  metricAtCheck: number;
  wasActedUpon: boolean;
  wasAccurate: boolean; // did the condition exist when checked?
  metricImproved: boolean;
  checkedAt: string;
}

export interface AccuracySummary {
  totalTracked: number;
  totalAccurate: number;
  accuracyRate: number; // percentage
  totalActedUpon: number;
  actedUponRate: number;
  totalImproved: number;
  improvementRate: number; // of those acted upon
  byType: Record<string, { total: number; accurate: number; rate: number }>;
}

// ── Record accuracy check (no-op — accuracy table not in Prisma schema) ──

export async function recordAccuracyCheck(
  _db: any,
  _tenantId: string,
  _record: AccuracyRecord,
): Promise<void> {
  // No-op: opd_recommendation_accuracy table does not exist in Prisma schema yet
  return;
}

// ── Batch accuracy validation ──
// Checks existing recommendations against current data to see if they were accurate

export async function validateRecommendations(
  _db: any,
  tenantId: string,
): Promise<AccuracyRecord[]> {
  // Get recommendations that have expired but haven't been validated
  const now = new Date();
  const recsToValidate = await prisma.opdRecommendation.findMany({
    where: {
      tenantId,
      expiresAt: { lt: now },
      validated: false,
    },
    take: 200,
  });

  const records: AccuracyRecord[] = [];

  for (const rec of recsToValidate) {
    const r = rec as unknown as OPDRecommendation & { tenantId: string };

    // Get current metric value for comparison
    const currentMetric = await getCurrentMetricValue(_db, tenantId, r);

    const wasActedUpon = r.acknowledged === true;
    const wasAccurate = isRecommendationStillValid(r, currentMetric);
    const metricImproved = wasActedUpon && didMetricImprove(r, currentMetric);

    const accuracyRecord: AccuracyRecord = {
      recommendationId: r.id,
      type: r.type,
      departmentId: r.departmentId,
      doctorId: r.doctorId,
      metricAtCreation: r.metricValue,
      metricAtCheck: currentMetric,
      wasActedUpon,
      wasAccurate,
      metricImproved,
      checkedAt: now.toISOString(),
    };

    records.push(accuracyRecord);

    // Skip accuracy recording (table doesn't exist yet)

    // Mark recommendation as validated
    await prisma.opdRecommendation.updateMany({
      where: { tenantId, id: rec.id },
      data: {
        validated: true,
        validatedAt: now,
        validationResult: {
          accuracyScore: wasAccurate ? (metricImproved ? 100 : 70) : 30,
        },
      },
    });
  }

  return records;
}

// ── Get current metric value for a recommendation ──

async function getCurrentMetricValue(
  _db: any,
  tenantId: string,
  rec: OPDRecommendation,
): Promise<number> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  switch (rec.type) {
    case 'capacity_warning':
    case 'add_doctor':
    case 'close_clinic': {
      // Get latest utilization for the department
      if (!rec.departmentId) return 0;
      const records = await prisma.opdDailyData.findMany({
        where: {
          tenantId,
          departmentId: rec.departmentId,
          date: { gte: oneWeekAgo },
        },
        select: { totalPatients: true, slotsPerHour: true, clinicStartTime: true, clinicEndTime: true },
        take: 500,
      });

      if (records.length === 0) return 0;
      const utils: number[] = [];
      for (const r of records) {
        if (r.clinicStartTime && r.clinicEndTime && r.slotsPerHour) {
          const [sh, sm] = r.clinicStartTime.split(':').map(Number);
          const [eh, em] = r.clinicEndTime.split(':').map(Number);
          const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
          const target = hours * r.slotsPerHour;
          if (target > 0) utils.push(Math.round(((r.totalPatients || 0) / target) * 100));
        }
      }
      return utils.length > 0 ? Math.round(utils.reduce((a, b) => a + b, 0) / utils.length) : 0;
    }

    case 'noshow_prevention':
    case 'revenue_opportunity': {
      // Get latest no-show rate for the department
      if (!rec.departmentId) return 0;
      const records = await prisma.opdDailyData.findMany({
        where: {
          tenantId,
          departmentId: rec.departmentId,
          date: { gte: oneWeekAgo },
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

    case 'burnout_risk': {
      // Get latest achievement for the doctor
      if (!rec.doctorId) return 0;
      const records = await prisma.opdDailyData.findMany({
        where: {
          tenantId,
          doctorId: rec.doctorId,
          date: { gte: oneWeekAgo },
        },
        select: { totalPatients: true, slotsPerHour: true, clinicStartTime: true, clinicEndTime: true },
        take: 500,
      });

      let totalPatients = 0;
      let totalTarget = 0;
      for (const r of records) {
        totalPatients += r.totalPatients || 0;
        if (r.clinicStartTime && r.clinicEndTime && r.slotsPerHour) {
          const [sh, sm] = r.clinicStartTime.split(':').map(Number);
          const [eh, em] = r.clinicEndTime.split(':').map(Number);
          const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
          totalTarget += hours * r.slotsPerHour;
        }
      }
      return totalTarget > 0 ? Math.round((totalPatients / totalTarget) * 100) : 0;
    }

    case 'schedule_optimize': {
      return rec.metricValue; // schedule variance doesn't change quickly
    }

    default:
      return 0;
  }
}

// ── Check if recommendation was accurate ──

function isRecommendationStillValid(rec: OPDRecommendation, currentMetric: number): boolean {
  switch (rec.type) {
    case 'capacity_warning':
    case 'add_doctor':
      return currentMetric >= rec.threshold;
    case 'close_clinic':
      return currentMetric < rec.threshold;
    case 'noshow_prevention':
    case 'revenue_opportunity':
      return currentMetric >= rec.threshold;
    case 'burnout_risk':
      return currentMetric >= rec.threshold;
    case 'schedule_optimize':
      return currentMetric >= rec.threshold;
    default:
      return false;
  }
}

// ── Check if metric improved after action ──

function didMetricImprove(rec: OPDRecommendation, currentMetric: number): boolean {
  switch (rec.type) {
    case 'capacity_warning':
    case 'add_doctor':
      // Improvement = utilization decreased (more capacity)
      return currentMetric < rec.metricValue;
    case 'close_clinic':
      // Improvement = utilization increased (better use of resources)
      return currentMetric > rec.metricValue;
    case 'noshow_prevention':
    case 'revenue_opportunity':
      // Improvement = no-show rate decreased
      return currentMetric < rec.metricValue;
    case 'burnout_risk':
      // Improvement = workload decreased
      return currentMetric < rec.metricValue;
    case 'schedule_optimize':
      // Improvement = variance decreased
      return currentMetric < rec.metricValue;
    default:
      return false;
  }
}

// ── Get accuracy summary (returns empty — no accuracy table yet) ──

export async function getAccuracySummary(
  _db: any,
  _tenantId: string,
  _months: number = 3,
): Promise<AccuracySummary> {
  // No accuracy table in Prisma schema yet — return empty results
  return {
    totalTracked: 0,
    totalAccurate: 0,
    accuracyRate: 0,
    totalActedUpon: 0,
    actedUponRate: 0,
    totalImproved: 0,
    improvementRate: 0,
    byType: {},
  };
}
