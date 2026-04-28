/**
 * CDO Repository — Prisma-backed
 *
 * Repository for CDO entities (the 7 entities from Section 16).
 * Models: CdoOutcomeEvent, CdoResponseTimeMetric, ClinicalDecisionPrompt
 * in prisma/schema/quality.prisma. Uses CDOPrismaClient typed interface.
 * tryPrisma wrapper provides graceful degradation if tables don't exist yet.
 */

import { prisma } from '@/lib/db/prisma';
import {
  ClinicalDecisionPrompt,
  OutcomeEvent,
  RiskFlag,
  ResponseTimeMetric,
  TransitionOutcome,
  ReadmissionEvent,
  QualityIndicator,
} from '@/lib/models/cdo';
import type { CDOPrismaClient } from '@/lib/cvision/types';

/** Typed CDO prisma client — models may not exist in generated client yet. */
const cdoPrisma = prisma as unknown as CDOPrismaClient;

// Helper: try a Prisma call, return fallback on failure
async function tryPrisma<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Build a where clause with optional filters. */
function buildWhere(base: Record<string, unknown>, ...filters: [string, unknown][]): Record<string, unknown> {
  const where = { ...base };
  for (const [key, value] of filters) {
    if (value !== undefined) where[key] = value;
  }
  return where;
}

export class CDORepository {
  // ClinicalDecisionPrompt operations
  static async savePrompt(prompt: ClinicalDecisionPrompt): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.clinicalDecisionPrompt?.create?.({ data: prompt as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getPromptById(id: string): Promise<ClinicalDecisionPrompt | null> {
    return tryPrisma(
      async () => {
        const p = await cdoPrisma.clinicalDecisionPrompt?.findFirst?.({ where: { id } });
        return (p as ClinicalDecisionPrompt) || null;
      },
      null
    );
  }

  static async getPromptsByVisitId(erVisitId: string): Promise<ClinicalDecisionPrompt[]> {
    return tryPrisma(
      async () => {
        const prompts = await cdoPrisma.clinicalDecisionPrompt?.findMany?.({
          where: { erVisitId },
          orderBy: { createdAt: 'desc' },
        });
        return (prompts as ClinicalDecisionPrompt[] | undefined) || [];
      },
      []
    );
  }

  static async getActivePrompts(
    erVisitId?: string,
    requiresAcknowledgment?: boolean
  ): Promise<ClinicalDecisionPrompt[]> {
    return tryPrisma(
      async () => {
        const where = buildWhere(
          { status: 'ACTIVE' },
          ['erVisitId', erVisitId],
          ['requiresAcknowledgment', requiresAcknowledgment],
        );
        const prompts = await cdoPrisma.clinicalDecisionPrompt?.findMany?.({
          where,
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        });
        return (prompts as ClinicalDecisionPrompt[] | undefined) || [];
      },
      []
    );
  }

  static async acknowledgePrompt(
    id: string,
    acknowledgedBy: string,
    acknowledgmentNotes?: string
  ): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.clinicalDecisionPrompt?.update?.({
        where: { id },
        data: {
          acknowledgedAt: new Date(),
          acknowledgedBy,
          acknowledgmentNotes,
          status: 'ACKNOWLEDGED',
          updatedAt: new Date(),
          updatedBy: acknowledgedBy,
        },
      }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async updatePromptStatus(
    id: string,
    status: ClinicalDecisionPrompt['status'],
    updatedBy: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      updatedBy,
    };
    if (status === 'RESOLVED') {
      update.resolvedAt = new Date();
      update.resolvedBy = updatedBy;
    }
    await tryPrisma(
      () => cdoPrisma.clinicalDecisionPrompt?.update?.({ where: { id }, data: update }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  // RiskFlag operations
  static async saveRiskFlag(flag: RiskFlag): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.cdoRiskFlag?.create?.({ data: flag as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getRiskFlagsByVisitId(erVisitId: string): Promise<RiskFlag[]> {
    return tryPrisma(
      async () => {
        const flags = await cdoPrisma.cdoRiskFlag?.findMany?.({
          where: { erVisitId },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        });
        return (flags as RiskFlag[] | undefined) || [];
      },
      []
    );
  }

  static async getActiveRiskFlags(erVisitId?: string): Promise<RiskFlag[]> {
    return tryPrisma(
      async () => {
        const where = buildWhere({ status: 'ACTIVE' }, ['erVisitId', erVisitId]);
        const flags = await cdoPrisma.cdoRiskFlag?.findMany?.({
          where,
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        });
        return (flags as RiskFlag[] | undefined) || [];
      },
      []
    );
  }

  static async updateRiskFlagStatus(
    id: string,
    status: RiskFlag['status'],
    updatedBy: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      updatedBy,
    };
    if (status === 'RESOLVED') {
      update.resolvedAt = new Date();
      update.resolvedBy = updatedBy;
    }
    await tryPrisma(
      () => cdoPrisma.cdoRiskFlag?.update?.({ where: { id }, data: update }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  // OutcomeEvent operations
  static async saveOutcomeEvent(event: OutcomeEvent): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.cdoOutcomeEvent?.create?.({ data: event as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getOutcomeEventsByVisitId(erVisitId: string): Promise<OutcomeEvent[]> {
    return tryPrisma(
      async () => {
        const events = await cdoPrisma.cdoOutcomeEvent?.findMany?.({
          where: { erVisitId },
          orderBy: { eventTimestamp: 'desc' },
        });
        return (events as OutcomeEvent[] | undefined) || [];
      },
      []
    );
  }

  // ResponseTimeMetric operations
  static async saveResponseTimeMetric(metric: ResponseTimeMetric): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.cdoResponseTimeMetric?.create?.({ data: metric as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getResponseTimeMetricsByVisitId(erVisitId: string): Promise<ResponseTimeMetric[]> {
    return tryPrisma(
      async () => {
        const metrics = await cdoPrisma.cdoResponseTimeMetric?.findMany?.({
          where: { erVisitId },
          orderBy: { startTimestamp: 'desc' },
        });
        return (metrics as ResponseTimeMetric[] | undefined) || [];
      },
      []
    );
  }

  // TransitionOutcome operations
  static async saveTransitionOutcome(outcome: TransitionOutcome): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.cdoTransitionOutcome?.create?.({ data: outcome as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getTransitionOutcomesByVisitId(erVisitId: string): Promise<TransitionOutcome[]> {
    return tryPrisma(
      async () => {
        const outcomes = await cdoPrisma.cdoTransitionOutcome?.findMany?.({
          where: { erVisitId },
          orderBy: { transitionTimestamp: 'desc' },
        });
        return (outcomes as TransitionOutcome[] | undefined) || [];
      },
      []
    );
  }

  // ReadmissionEvent operations
  static async saveReadmissionEvent(event: ReadmissionEvent): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.cdoReadmissionEvent?.create?.({ data: event as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getReadmissionEventsByVisitId(erVisitId: string): Promise<ReadmissionEvent[]> {
    return tryPrisma(
      async () => {
        const events = await cdoPrisma.cdoReadmissionEvent?.findMany?.({
          where: {
            OR: [{ previousErVisitId: erVisitId }, { readmissionErVisitId: erVisitId }],
          },
          orderBy: { readmissionTimestamp: 'desc' },
        });
        return (events as ReadmissionEvent[] | undefined) || [];
      },
      []
    );
  }

  // QualityIndicator operations
  static async saveQualityIndicator(indicator: QualityIndicator): Promise<void> {
    await tryPrisma(
      () => cdoPrisma.cdoQualityIndicator?.create?.({ data: indicator as unknown as Record<string, unknown> }) ?? Promise.resolve(undefined),
      undefined
    );
  }

  static async getQualityIndicators(
    indicatorType?: QualityIndicator['indicatorType'],
    periodStart?: Date,
    periodEnd?: Date,
    careSetting?: QualityIndicator['careSetting']
  ): Promise<QualityIndicator[]> {
    return tryPrisma(
      async () => {
        const where: Record<string, unknown> = {};
        if (indicatorType) where.indicatorType = indicatorType;
        if (periodStart) where.periodStart = { gte: periodStart };
        if (periodEnd) where.periodEnd = { ...(where.periodEnd as Record<string, unknown> ?? {}), lte: periodEnd };
        if (careSetting) where.careSetting = careSetting;

        const indicators = await cdoPrisma.cdoQualityIndicator?.findMany?.({
          where,
          orderBy: { periodStart: 'desc' },
        });
        return (indicators as QualityIndicator[] | undefined) || [];
      },
      []
    );
  }
}
