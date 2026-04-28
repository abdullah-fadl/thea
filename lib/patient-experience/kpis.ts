/**
 * Pure KPI computation for the Patient Experience dashboard.
 *
 * Kept I/O-free so it can be unit-tested without spinning up Prisma.
 * The route handler is responsible for fetching the rows in a tenant-scoped
 * window and handing them to `computePxKpis`.
 */

import type { PxStatus, PxSeverity, PxCategory } from './types';

export interface PxCaseRow {
  id: string;
  status: PxStatus | string;
  severity?: PxSeverity | string | null;
  categoryKey?: PxCategory | string | null;
  satisfactionScore?: number | null;
  resolutionMinutes?: number | null;
  escalationLevel?: number | null;
  dueAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
}

export interface PxKpis {
  totalOpen: number;
  totalInProgress: number;
  totalResolved: number;
  totalClosed: number;
  totalEscalated: number;
  total: number;
  avgResolutionMinutes: number | null;
  slaCompliancePct: number | null;
  satisfactionScore: number | null; // mean 1..5
  satisfactionCount: number;
  pendingEscalations: number;
  trendingCategories: Array<{ category: string; count: number }>;
}

const OPEN_STATES = new Set(['OPEN', 'IN_PROGRESS']);

function toDate(d: Date | string | null | undefined): Date | null {
  if (d == null) return null;
  return d instanceof Date ? d : new Date(d);
}

/**
 * Compute the headline KPIs shown on the PX dashboard.
 *
 * `now` is injectable so tests can pin time.
 */
export function computePxKpis(cases: readonly PxCaseRow[], now: Date = new Date()): PxKpis {
  let totalOpen = 0;
  let totalInProgress = 0;
  let totalResolved = 0;
  let totalClosed = 0;
  let totalEscalated = 0;

  let resolutionSum = 0;
  let resolutionCount = 0;

  let satisfactionSum = 0;
  let satisfactionCount = 0;

  // SLA compliance considers only cases with a defined dueAt.
  // - resolved on/before dueAt -> compliant
  // - still open and now > dueAt -> breached
  // - still open and now <= dueAt -> compliant (so far)
  let slaTotal = 0;
  let slaCompliant = 0;

  let pendingEscalations = 0;

  const categoryCounts = new Map<string, number>();

  for (const c of cases) {
    switch (c.status) {
      case 'OPEN':
        totalOpen++;
        break;
      case 'IN_PROGRESS':
        totalInProgress++;
        break;
      case 'RESOLVED':
        totalResolved++;
        break;
      case 'CLOSED':
        totalClosed++;
        break;
      case 'ESCALATED':
        totalEscalated++;
        break;
      default:
        break;
    }

    if (typeof c.resolutionMinutes === 'number' && c.resolutionMinutes >= 0) {
      resolutionSum += c.resolutionMinutes;
      resolutionCount++;
    }

    if (typeof c.satisfactionScore === 'number' && c.satisfactionScore > 0) {
      satisfactionSum += c.satisfactionScore;
      satisfactionCount++;
    }

    const dueAt = toDate(c.dueAt);
    const resolvedAt = toDate(c.resolvedAt);
    if (dueAt) {
      slaTotal++;
      if (resolvedAt) {
        if (resolvedAt.getTime() <= dueAt.getTime()) slaCompliant++;
      } else if (now.getTime() <= dueAt.getTime()) {
        slaCompliant++;
      }
    }

    if (
      (c.escalationLevel ?? 0) > 0 &&
      OPEN_STATES.has(String(c.status))
    ) {
      pendingEscalations++;
    }

    if (c.categoryKey) {
      const k = String(c.categoryKey);
      categoryCounts.set(k, (categoryCounts.get(k) ?? 0) + 1);
    }
  }

  const trendingCategories = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalOpen,
    totalInProgress,
    totalResolved,
    totalClosed,
    totalEscalated,
    total: cases.length,
    avgResolutionMinutes:
      resolutionCount > 0 ? Math.round(resolutionSum / resolutionCount) : null,
    slaCompliancePct: slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 1000) / 10 : null,
    satisfactionScore:
      satisfactionCount > 0
        ? Math.round((satisfactionSum / satisfactionCount) * 100) / 100
        : null,
    satisfactionCount,
    pendingEscalations,
    trendingCategories,
  };
}
