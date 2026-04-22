/**
 * CDO Dashboard Service — Real Prisma implementation
 *
 * Service for generating dashboard data and quality indicators.
 *
 * Queries the following Prisma models (defined in quality.prisma):
 *   - CdoOutcomeEvent       (@@map("cdo_outcome_events"))
 *   - CdoResponseTimeMetric (@@map("cdo_response_time_metrics"))
 *   - ClinicalDecisionPrompt(@@map("clinical_decision_prompts"))
 *
 * All model access uses CDOPrismaClient typed interface. Every query is
 * wrapped in try/catch so callers degrade gracefully if tables don't exist.
 */

import { prisma } from '@/lib/db/prisma';
import { CDORepository } from '../repositories/CDORepository';
import { QualityIndicator } from '@/lib/models/cdo';
import type { CDOPrismaClient } from '@/lib/cvision/types';
import { v4 as uuidv4 } from 'uuid';

/** Typed CDO prisma client — models may not exist in generated client yet. */
const cdoPrisma = prisma as unknown as CDOPrismaClient;

/** Valid care settings for QualityIndicator. */
type CareSetting = NonNullable<QualityIndicator['careSetting']>;

export interface DashboardSummary {
  periodStart: Date;
  periodEnd: Date;
  careSetting: 'ED' | 'WARD' | 'ICU' | 'ALL';

  qualityIndicators: QualityIndicator[];

  outcomeSummary: {
    totalOutcomes: number;
    outcomesByType: Record<string, number>;
    negativeOutcomes: number;
    positiveOutcomes: number;
  };

  responseTimeSummary: {
    avgTimeToRecognition?: number;
    avgTimeToEscalation?: number;
    thresholdViolations: number;
  };

  promptSummary: {
    totalActivePrompts: number;
    unacknowledgedHighRisk: number;
    promptsBySeverity: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Aggregate result shape from Prisma. */
interface PrismaAggregateResult {
  _avg?: { timeMinutes?: number | null };
  _count?: { id?: number };
}

/** Group-by result row with a string key and _count. */
interface GroupByRow {
  [key: string]: unknown;
  _count: { id: number };
}

/** Safe Prisma call — returns fallback on any error (table missing, etc.) */
async function tryQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Build the shared where-clause fragment used by most queries. */
function dateAndSettingWhere(
  periodStart: Date,
  periodEnd: Date,
  careSetting: string,
  dateField: string = 'occurredAt'
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    [dateField]: {
      gte: periodStart,
      lte: periodEnd,
    },
  };
  if (careSetting !== 'ALL') {
    where.careSetting = careSetting;
  }
  return where;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CDODashboardService {
  // =========================================================================
  // Public: full dashboard summary
  // =========================================================================

  static async generateDashboardSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: 'ED' | 'WARD' | 'ICU' | 'ALL' = 'ED'
  ): Promise<DashboardSummary> {
    const qualityIndicators = await CDORepository.getQualityIndicators(
      undefined,
      periodStart,
      periodEnd,
      careSetting === 'ALL' ? undefined : careSetting
    );

    const [outcomeSummary, responseTimeSummary, promptSummary] =
      await Promise.all([
        this.calculateOutcomeSummary(periodStart, periodEnd, careSetting),
        this.calculateResponseTimeSummary(periodStart, periodEnd, careSetting),
        this.calculatePromptSummary(periodStart, periodEnd, careSetting),
      ]);

    return {
      periodStart,
      periodEnd,
      careSetting,
      qualityIndicators,
      outcomeSummary,
      responseTimeSummary,
      promptSummary,
    };
  }

  // =========================================================================
  // Public: calculate & persist quality indicators
  // =========================================================================

  static async calculateQualityIndicators(
    periodStart: Date,
    periodEnd: Date,
    careSetting: 'ED' | 'WARD' | 'ICU' | 'ALL' = 'ED'
  ): Promise<QualityIndicator[]> {
    const indicators: QualityIndicator[] = [];

    const [
      failureToRescue,
      avgTimeToRecognition,
      avgTimeToEscalation,
      icuTransferAfterDelay,
    ] = await Promise.all([
      this.calculateFailureToRescue(periodStart, periodEnd, careSetting),
      this.calculateAvgTimeToRecognition(periodStart, periodEnd, careSetting),
      this.calculateAvgTimeToEscalation(periodStart, periodEnd, careSetting),
      this.calculateICUTransferAfterDelay(periodStart, periodEnd, careSetting),
    ]);

    if (failureToRescue) indicators.push(failureToRescue);
    if (avgTimeToRecognition) indicators.push(avgTimeToRecognition);
    if (avgTimeToEscalation) indicators.push(avgTimeToEscalation);
    if (icuTransferAfterDelay) indicators.push(icuTransferAfterDelay);

    // Persist all computed indicators in parallel
    await Promise.all(
      indicators.map((ind) => CDORepository.saveQualityIndicator(ind))
    );

    return indicators;
  }

  // =========================================================================
  // Private: individual quality indicator calculations
  // =========================================================================

  /**
   * Failure-to-rescue count — CdoOutcomeEvent where
   * outcomeType = 'FAILURE_TO_RESCUE'.
   */
  private static async calculateFailureToRescue(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const where = {
      ...dateAndSettingWhere(periodStart, periodEnd, careSetting),
      outcomeType: 'FAILURE_TO_RESCUE',
    };

    const numerator = await tryQuery(
      () => cdoPrisma.cdoOutcomeEvent!.count({ where }),
      0
    );

    // Denominator: total outcome events in the same period (for rate calc)
    const denominator = await tryQuery(
      () =>
        cdoPrisma.cdoOutcomeEvent!.count({
          where: dateAndSettingWhere(periodStart, periodEnd, careSetting),
        }),
      0
    );

    const rate =
      denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    // Target: < 5 % failure-to-rescue rate (clinical benchmark)
    const targetRate = 5;

    return {
      id: uuidv4(),
      indicatorType: 'FAILURE_TO_RESCUE',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as CareSetting,
      numerator,
      denominator: denominator || undefined,
      rate,
      targetRate,
      exceedsTarget: rate > targetRate,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Average time-to-recognition — CdoResponseTimeMetric where
   * metricType = 'RECOGNITION'. Returns average of timeMinutes.
   */
  private static async calculateAvgTimeToRecognition(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const where = {
      ...dateAndSettingWhere(periodStart, periodEnd, careSetting),
      metricType: 'RECOGNITION',
    };

    const agg = await tryQuery(
      () =>
        cdoPrisma.cdoResponseTimeMetric!.aggregate({
          where,
          _avg: { timeMinutes: true },
          _count: { id: true },
        }) as Promise<PrismaAggregateResult>,
      null
    );

    if (!agg || agg._count?.id === 0) return null;

    const avgMinutes = Math.round((agg._avg?.timeMinutes ?? 0) * 100) / 100;
    // Target: recognition within 15 min on average
    const targetRate = 15;

    return {
      id: uuidv4(),
      indicatorType: 'TIME_TO_RECOGNITION_AVG',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as CareSetting,
      numerator: avgMinutes,
      denominator: agg._count?.id,
      rate: avgMinutes,
      targetRate,
      exceedsTarget: avgMinutes > targetRate,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Average time-to-escalation — CdoResponseTimeMetric where
   * metricType = 'ESCALATION'. Returns average of timeMinutes.
   */
  private static async calculateAvgTimeToEscalation(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const where = {
      ...dateAndSettingWhere(periodStart, periodEnd, careSetting),
      metricType: 'ESCALATION',
    };

    const agg = await tryQuery(
      () =>
        cdoPrisma.cdoResponseTimeMetric!.aggregate({
          where,
          _avg: { timeMinutes: true },
          _count: { id: true },
        }) as Promise<PrismaAggregateResult>,
      null
    );

    if (!agg || agg._count?.id === 0) return null;

    const avgMinutes = Math.round((agg._avg?.timeMinutes ?? 0) * 100) / 100;
    // Target: escalation within 30 min on average
    const targetRate = 30;

    return {
      id: uuidv4(),
      indicatorType: 'TIME_TO_ESCALATION_AVG',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as CareSetting,
      numerator: avgMinutes,
      denominator: agg._count?.id,
      rate: avgMinutes,
      targetRate,
      exceedsTarget: avgMinutes > targetRate,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * ICU transfer after delay count — CdoOutcomeEvent where
   * outcomeType = 'ICU_TRANSFER_DELAY'.
   */
  private static async calculateICUTransferAfterDelay(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<QualityIndicator | null> {
    const where = {
      ...dateAndSettingWhere(periodStart, periodEnd, careSetting),
      outcomeType: 'ICU_TRANSFER_DELAY',
    };

    const numerator = await tryQuery(
      () => cdoPrisma.cdoOutcomeEvent!.count({ where }),
      0
    );

    // Denominator: total ICU transfers (delayed + on-time)
    const totalTransfers = await tryQuery(
      () =>
        cdoPrisma.cdoOutcomeEvent!.count({
          where: {
            ...dateAndSettingWhere(periodStart, periodEnd, careSetting),
            outcomeType: { in: ['ICU_TRANSFER_DELAY', 'ICU_TRANSFER'] },
          },
        }),
      0
    );

    const rate =
      totalTransfers > 0
        ? Math.round((numerator / totalTransfers) * 10000) / 100
        : 0;

    // Target: < 10 % delayed ICU transfers
    const targetRate = 10;

    return {
      id: uuidv4(),
      indicatorType: 'ICU_TRANSFER_AFTER_DELAY_COUNT',
      periodType: 'CUSTOM',
      periodStart,
      periodEnd,
      careSetting: careSetting as CareSetting,
      numerator,
      denominator: totalTransfers || undefined,
      rate,
      targetRate,
      exceedsTarget: rate > targetRate,
      exceedsBenchmark: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  // =========================================================================
  // Private: summary aggregations
  // =========================================================================

  /**
   * Outcome summary — groups CdoOutcomeEvent by outcomeType and counts
   * negative vs positive outcomes using the isNegative flag.
   */
  private static async calculateOutcomeSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<DashboardSummary['outcomeSummary']> {
    const baseWhere = dateAndSettingWhere(periodStart, periodEnd, careSetting);

    // Group by outcomeType to get counts per type
    const grouped = await tryQuery(
      () =>
        cdoPrisma.cdoOutcomeEvent!.groupBy({
          by: ['outcomeType'],
          where: baseWhere,
          _count: { id: true },
        }) as Promise<(GroupByRow & { outcomeType: string })[]>,
      [] as (GroupByRow & { outcomeType: string })[]
    );

    const outcomesByType: Record<string, number> = {};
    let totalOutcomes = 0;
    for (const row of grouped) {
      outcomesByType[row.outcomeType] = row._count.id;
      totalOutcomes += row._count.id;
    }

    // Count negatives and positives
    const [negativeOutcomes, positiveOutcomes] = await Promise.all([
      tryQuery(
        () =>
          cdoPrisma.cdoOutcomeEvent!.count({
            where: { ...baseWhere, isNegative: true },
          }),
        0
      ),
      tryQuery(
        () =>
          cdoPrisma.cdoOutcomeEvent!.count({
            where: { ...baseWhere, isNegative: false },
          }),
        0
      ),
    ]);

    return {
      totalOutcomes,
      outcomesByType,
      negativeOutcomes,
      positiveOutcomes,
    };
  }

  /**
   * Response time summary — average recognition & escalation times and
   * count of threshold violations from CdoResponseTimeMetric.
   */
  private static async calculateResponseTimeSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<DashboardSummary['responseTimeSummary']> {
    const baseWhere = dateAndSettingWhere(periodStart, periodEnd, careSetting);

    // Average recognition time
    const recognitionAgg = await tryQuery(
      () =>
        cdoPrisma.cdoResponseTimeMetric!.aggregate({
          where: { ...baseWhere, metricType: 'RECOGNITION' },
          _avg: { timeMinutes: true },
        }) as Promise<PrismaAggregateResult>,
      null
    );

    // Average escalation time
    const escalationAgg = await tryQuery(
      () =>
        cdoPrisma.cdoResponseTimeMetric!.aggregate({
          where: { ...baseWhere, metricType: 'ESCALATION' },
          _avg: { timeMinutes: true },
        }) as Promise<PrismaAggregateResult>,
      null
    );

    // Count of any metric that exceeded its threshold
    const thresholdViolations = await tryQuery(
      () =>
        cdoPrisma.cdoResponseTimeMetric!.count({
          where: { ...baseWhere, exceededThreshold: true },
        }),
      0
    );

    const avgTimeToRecognition =
      recognitionAgg?._avg?.timeMinutes != null
        ? Math.round(recognitionAgg._avg.timeMinutes * 100) / 100
        : undefined;

    const avgTimeToEscalation =
      escalationAgg?._avg?.timeMinutes != null
        ? Math.round(escalationAgg._avg.timeMinutes * 100) / 100
        : undefined;

    return {
      avgTimeToRecognition,
      avgTimeToEscalation,
      thresholdViolations,
    };
  }

  /**
   * Prompt summary — counts ClinicalDecisionPrompt by status and severity.
   * "unacknowledgedHighRisk" = ACTIVE prompts with severity HIGH or CRITICAL.
   */
  private static async calculatePromptSummary(
    periodStart: Date,
    periodEnd: Date,
    careSetting: string
  ): Promise<DashboardSummary['promptSummary']> {
    const baseWhere = dateAndSettingWhere(
      periodStart,
      periodEnd,
      careSetting,
      'createdAt'
    );

    // Total active prompts in the period
    const totalActivePrompts = await tryQuery(
      () =>
        cdoPrisma.clinicalDecisionPrompt!.count({
          where: { ...baseWhere, status: 'ACTIVE' },
        }),
      0
    );

    // Unacknowledged high-risk = ACTIVE + severity in (HIGH, CRITICAL)
    const unacknowledgedHighRisk = await tryQuery(
      () =>
        cdoPrisma.clinicalDecisionPrompt!.count({
          where: {
            ...baseWhere,
            status: 'ACTIVE',
            severity: { in: ['HIGH', 'CRITICAL'] },
          },
        }),
      0
    );

    // Group by severity for the breakdown
    const grouped = await tryQuery(
      () =>
        cdoPrisma.clinicalDecisionPrompt!.groupBy({
          by: ['severity'],
          where: baseWhere,
          _count: { id: true },
        }) as Promise<(GroupByRow & { severity: string })[]>,
      [] as (GroupByRow & { severity: string })[]
    );

    const promptsBySeverity: Record<string, number> = {};
    for (const row of grouped) {
      promptsBySeverity[row.severity] = row._count.id;
    }

    return {
      totalActivePrompts,
      unacknowledgedHighRisk,
      promptsBySeverity,
    };
  }
}
