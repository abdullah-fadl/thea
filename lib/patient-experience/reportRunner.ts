/**
 * Server-side report runner: fetches the rows a single PxReportType needs
 * and runs the pure builder over them. Kept separate from the route handler
 * so /reports/[type] and /reports/[type]/export share the same code path.
 */

import { prisma } from '@/lib/db/prisma';
import {
  buildResolutionTimeDistribution,
  buildSatisfactionOverTime,
  buildSlaComplianceTrend,
  buildTopComplaintSources,
  buildVolumeByCategory,
  type PxReportPayload,
} from './reports';
import type { PxCaseRow } from './kpis';
import type { PxReportType } from './types';

export interface PxReportInput {
  tenantUuid: string;
  reportType: PxReportType;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

export async function runPxReport(input: PxReportInput): Promise<PxReportPayload> {
  const { tenantUuid, reportType } = input;

  const dateRange: { gte?: Date; lte?: Date } = {};
  if (input.dateFrom) dateRange.gte = input.dateFrom;
  if (input.dateTo) dateRange.lte = input.dateTo;
  // Sensible default window when neither bound supplied: last 90 days.
  if (!input.dateFrom && !input.dateTo) {
    dateRange.gte = new Date(Date.now() - 90 * DAY);
  }

  switch (reportType) {
    case 'volume-by-category': {
      const cases = (await prisma.pxCase.findMany({
        where: { tenantId: tenantUuid, active: true, createdAt: dateRange },
        select: { id: true, status: true, categoryKey: true, createdAt: true },
      })) as unknown as PxCaseRow[];
      return { type: 'volume-by-category', rows: buildVolumeByCategory(cases) };
    }

    case 'sla-compliance-trend': {
      const cases = (await prisma.pxCase.findMany({
        where: { tenantId: tenantUuid, active: true, createdAt: dateRange },
        select: {
          id: true,
          status: true,
          dueAt: true,
          resolvedAt: true,
          createdAt: true,
        },
      })) as unknown as PxCaseRow[];
      return { type: 'sla-compliance-trend', rows: buildSlaComplianceTrend(cases) };
    }

    case 'top-complaint-sources': {
      const visits = await prisma.pxVisitExperience.findMany({
        where: { tenantId: tenantUuid, createdAt: dateRange },
        select: { departmentKey: true, hasComplaint: true },
      });
      return {
        type: 'top-complaint-sources',
        rows: buildTopComplaintSources(visits),
      };
    }

    case 'resolution-time-distribution': {
      const cases = (await prisma.pxCase.findMany({
        where: {
          tenantId: tenantUuid,
          active: true,
          createdAt: dateRange,
          resolutionMinutes: { not: null },
        },
        select: { id: true, status: true, resolutionMinutes: true, createdAt: true },
      })) as unknown as PxCaseRow[];
      return {
        type: 'resolution-time-distribution',
        rows: buildResolutionTimeDistribution(cases),
      };
    }

    case 'satisfaction-over-time': {
      const visits = await prisma.pxVisitExperience.findMany({
        where: {
          tenantId: tenantUuid,
          createdAt: dateRange,
          satisfactionScore: { not: null },
        },
        select: { satisfactionScore: true, createdAt: true },
      });
      return {
        type: 'satisfaction-over-time',
        rows: buildSatisfactionOverTime(visits),
      };
    }

    default: {
      const _exhaustive: never = reportType;
      throw new Error(`Unknown PX report type: ${String(_exhaustive)}`);
    }
  }
}
