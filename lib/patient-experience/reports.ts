/**
 * Pure report builders for Patient Experience analytics.
 *
 * Each builder takes raw rows (already tenant-scoped + windowed by the route
 * handler) and returns chart-ready data. No I/O, easily unit-testable.
 */

import type { PxCaseRow } from './kpis';
import type { PxReportType } from './types';

export interface CategoryVolumeBucket {
  category: string;
  count: number;
}

export interface SlaTrendBucket {
  date: string; // YYYY-MM-DD
  total: number;
  compliant: number;
  compliancePct: number | null;
}

export interface ComplaintSourceBucket {
  source: string; // departmentKey OR 'unspecified'
  count: number;
}

export interface ResolutionBucket {
  bucket: string; // human-readable range
  count: number;
}

export interface SatisfactionPoint {
  date: string;
  mean: number | null;
  count: number;
}

export type PxReportPayload =
  | { type: 'volume-by-category'; rows: CategoryVolumeBucket[] }
  | { type: 'sla-compliance-trend'; rows: SlaTrendBucket[] }
  | { type: 'top-complaint-sources'; rows: ComplaintSourceBucket[] }
  | { type: 'resolution-time-distribution'; rows: ResolutionBucket[] }
  | { type: 'satisfaction-over-time'; rows: SatisfactionPoint[] };

function dateKey(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

export function buildVolumeByCategory(cases: readonly PxCaseRow[]): CategoryVolumeBucket[] {
  const m = new Map<string, number>();
  for (const c of cases) {
    const k = c.categoryKey ? String(c.categoryKey) : 'unspecified';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildSlaComplianceTrend(
  cases: readonly PxCaseRow[],
  now: Date = new Date(),
): SlaTrendBucket[] {
  const m = new Map<string, { total: number; compliant: number }>();
  for (const c of cases) {
    if (!c.dueAt) continue;
    const day = dateKey(c.createdAt);
    const bucket = m.get(day) ?? { total: 0, compliant: 0 };
    bucket.total++;
    const due = new Date(c.dueAt);
    const resolved = c.resolvedAt ? new Date(c.resolvedAt) : null;
    if (resolved) {
      if (resolved.getTime() <= due.getTime()) bucket.compliant++;
    } else if (now.getTime() <= due.getTime()) {
      bucket.compliant++;
    }
    m.set(day, bucket);
  }
  return Array.from(m.entries())
    .map(([date, v]) => ({
      date,
      total: v.total,
      compliant: v.compliant,
      compliancePct: v.total > 0 ? Math.round((v.compliant / v.total) * 1000) / 10 : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildTopComplaintSources(
  visits: readonly { departmentKey?: string | null; hasComplaint?: boolean | null }[],
): ComplaintSourceBucket[] {
  const m = new Map<string, number>();
  for (const v of visits) {
    if (!v.hasComplaint) continue;
    const k = v.departmentKey ? String(v.departmentKey) : 'unspecified';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

const RESOLUTION_BUCKETS: Array<{ label: string; max: number }> = [
  { label: '<1h', max: 60 },
  { label: '1-4h', max: 60 * 4 },
  { label: '4-24h', max: 60 * 24 },
  { label: '1-3d', max: 60 * 24 * 3 },
  { label: '3-7d', max: 60 * 24 * 7 },
  { label: '>7d', max: Number.POSITIVE_INFINITY },
];

export function buildResolutionTimeDistribution(
  cases: readonly PxCaseRow[],
): ResolutionBucket[] {
  const counts = RESOLUTION_BUCKETS.map((b) => ({ bucket: b.label, count: 0 }));
  for (const c of cases) {
    const m = c.resolutionMinutes;
    if (typeof m !== 'number' || m < 0) continue;
    for (let i = 0; i < RESOLUTION_BUCKETS.length; i++) {
      if (m < RESOLUTION_BUCKETS[i]!.max) {
        counts[i]!.count++;
        break;
      }
    }
  }
  return counts;
}

export function buildSatisfactionOverTime(
  signals: readonly { createdAt: Date | string; satisfactionScore?: number | null }[],
): SatisfactionPoint[] {
  const m = new Map<string, { sum: number; count: number }>();
  for (const s of signals) {
    if (typeof s.satisfactionScore !== 'number' || s.satisfactionScore <= 0) continue;
    const day = dateKey(s.createdAt);
    const v = m.get(day) ?? { sum: 0, count: 0 };
    v.sum += s.satisfactionScore;
    v.count++;
    m.set(day, v);
  }
  return Array.from(m.entries())
    .map(([date, v]) => ({
      date,
      mean: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : null,
      count: v.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function isPxReportType(value: string): value is PxReportType {
  return [
    'volume-by-category',
    'sla-compliance-trend',
    'top-complaint-sources',
    'resolution-time-distribution',
    'satisfaction-over-time',
  ].includes(value);
}
