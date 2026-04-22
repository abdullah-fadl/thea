/**
 * Lab TAT (Turnaround Time) Tracking
 *
 * Tracks timestamps at each stage of the lab workflow:
 *  ordered → collected → received → in_progress → resulted → verified
 *
 * Calculates TAT metrics for individual orders and aggregate dashboards.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabStage = 'ordered' | 'collected' | 'received' | 'in_progress' | 'resulted' | 'verified';

export const LAB_STAGES: LabStage[] = ['ordered', 'collected', 'received', 'in_progress', 'resulted', 'verified'];

export interface LabTimestamps {
  orderedAt?: string;
  collectedAt?: string;
  receivedAt?: string;
  inProgressAt?: string;
  resultedAt?: string;
  verifiedAt?: string;
}

export interface TATBreakdown {
  orderToCollect?: number;
  collectToReceive?: number;
  receiveToResult?: number;
  resultToVerify?: number;
  totalTAT?: number;
}

export interface TATMetrics {
  period: string;
  department?: string;
  totalOrders: number;
  completedOrders: number;
  averageTAT: number;
  medianTAT: number;
  p90TAT: number;
  withinTarget: number;
  withinTargetPercent: number;
  breakdown: {
    avgOrderToCollect: number;
    avgCollectToReceive: number;
    avgReceiveToResult: number;
    avgResultToVerify: number;
  };
}

export const STAGE_LABELS: Record<LabStage, { ar: string; en: string }> = {
  ordered: { ar: 'طلب', en: 'Ordered' },
  collected: { ar: 'تجميع', en: 'Collected' },
  received: { ar: 'استلام', en: 'Received' },
  in_progress: { ar: 'قيد الفحص', en: 'In Progress' },
  resulted: { ar: 'نتيجة', en: 'Resulted' },
  verified: { ar: 'تحقق', en: 'Verified' },
};

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

function diffMinutes(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 60000) : undefined;
}

/**
 * Calculate TAT breakdown for a single order.
 */
export function calculateTATBreakdown(ts: LabTimestamps): TATBreakdown {
  return {
    orderToCollect: diffMinutes(ts.orderedAt, ts.collectedAt),
    collectToReceive: diffMinutes(ts.collectedAt, ts.receivedAt),
    receiveToResult: diffMinutes(ts.receivedAt, ts.resultedAt),
    resultToVerify: diffMinutes(ts.resultedAt, ts.verifiedAt),
    totalTAT: diffMinutes(ts.orderedAt, ts.verifiedAt ?? ts.resultedAt),
  };
}

/**
 * Get current stage based on timestamps.
 */
export function getCurrentStage(ts: LabTimestamps): LabStage {
  if (ts.verifiedAt) return 'verified';
  if (ts.resultedAt) return 'resulted';
  if (ts.inProgressAt) return 'in_progress';
  if (ts.receivedAt) return 'received';
  if (ts.collectedAt) return 'collected';
  return 'ordered';
}

/**
 * Check if TAT exceeds target.
 *
 * @param ts              - lab timestamps
 * @param targetMinutes   - target TAT in minutes
 * @returns true if current elapsed time from order exceeds target
 */
export function isTATExceeded(ts: LabTimestamps, targetMinutes: number): boolean {
  if (!ts.orderedAt) return false;
  const endTime = ts.verifiedAt ?? ts.resultedAt ?? new Date().toISOString();
  const elapsed = diffMinutes(ts.orderedAt, endTime);
  return elapsed !== undefined && elapsed > targetMinutes;
}

/**
 * Format minutes into human-readable duration.
 */
export function formatTAT(minutes: number | undefined): string {
  if (minutes === undefined) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format minutes into bilingual label.
 */
export function formatTATBilingual(minutes: number | undefined): { ar: string; en: string } {
  if (minutes === undefined) return { ar: '—', en: '—' };
  if (minutes < 60) return { ar: `${minutes} دقيقة`, en: `${minutes} min` };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const enStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
  const arStr = m > 0 ? `${h} ساعة ${m} دقيقة` : `${h} ساعة`;
  return { ar: arStr, en: enStr };
}

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

/**
 * Compute aggregate TAT metrics from a batch of orders.
 *
 * @param orders         - array of { timestamps, department? }
 * @param targetMinutes  - target TAT to measure compliance
 * @param period         - label for the time period (e.g., "2026-02-17")
 */
export function computeTATMetrics(
  orders: { timestamps: LabTimestamps; department?: string }[],
  targetMinutes: number,
  period: string,
): TATMetrics {
  const breakdowns = orders.map((o) => calculateTATBreakdown(o.timestamps));

  const totalTATs = breakdowns
    .map((b) => b.totalTAT)
    .filter((t): t is number => t !== undefined);

  totalTATs.sort((a, b) => a - b);

  const withinTarget = totalTATs.filter((t) => t <= targetMinutes).length;

  const orderToCollects = breakdowns.map((b) => b.orderToCollect).filter((t): t is number => t !== undefined);
  const collectToReceives = breakdowns.map((b) => b.collectToReceive).filter((t): t is number => t !== undefined);
  const receiveToResults = breakdowns.map((b) => b.receiveToResult).filter((t): t is number => t !== undefined);
  const resultToVerifies = breakdowns.map((b) => b.resultToVerify).filter((t): t is number => t !== undefined);

  return {
    period,
    totalOrders: orders.length,
    completedOrders: totalTATs.length,
    averageTAT: average(totalTATs),
    medianTAT: percentile(totalTATs, 50),
    p90TAT: percentile(totalTATs, 90),
    withinTarget,
    withinTargetPercent: totalTATs.length > 0 ? Math.round((withinTarget / totalTATs.length) * 100) : 0,
    breakdown: {
      avgOrderToCollect: average(orderToCollects),
      avgCollectToReceive: average(collectToReceives),
      avgReceiveToResult: average(receiveToResults),
      avgResultToVerify: average(resultToVerifies),
    },
  };
}
