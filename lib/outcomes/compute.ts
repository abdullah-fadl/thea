import { createHash } from 'node:crypto';
import { isEnabled } from '@/lib/core/flags';
import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { getOutcome } from './registry';
import {
  OutcomeMetricsDisabled,
  type ComputeArgs,
  type OutcomeMeasurement,
  type OutcomeFormula,
  type CountFormula,
  type SumFormula,
  type DurationBetweenEventsFormula,
  type RatioOfCountsFormula,
} from './types';

// =============================================================================
// Outcome Computation Engine (Phase 6.3)
//
// computeOutcome() reads the Phase 4.2 events table, applies the declarative
// formula from the OutcomeDefinition, and upserts an OutcomeMeasurement row.
//
// Supported formula kinds:
//
//   count
//     Count events matching eventName (+ optional payloadFilter) in period.
//     value = COUNT(*), sampleSize = value.
//
//   sum
//     Sum a numeric field from payloads of matching events in period.
//     value = SUM(payload->field), sampleSize = COUNT(*).
//
//   duration_between_events
//     For each aggregateId that has both a startEvent and endEvent in the period,
//     compute the elapsed time (in the formula's unit).  Then apply the chosen
//     aggregation (median | mean | p75 | p90 | p95 | min | max) across all pairs.
//     value = aggregated duration, sampleSize = number of paired entities.
//
//   ratio_of_counts
//     (COUNT(numeratorEvent) / COUNT(denominatorEvent)) × 100.
//     Returns 0 when denominator is 0.
//     value = ratio %, sampleSize = COUNT(denominatorEvent).
//
// Idempotent: running twice for the same args produces one row (upsert on
//   unique constraint: outcomeKey + tenantId + periodStart + periodGranularity
//   + dimensionsHash).
// =============================================================================

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute (or recompute) an outcome for a given tenant + time period.
 *
 * @throws OutcomeMetricsDisabled when FF_OUTCOME_METRICS_ENABLED is OFF.
 * @throws OutcomeNotFound when the outcomeKey isn't registered.
 */
export async function computeOutcome(
  args: ComputeArgs,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _prisma?: any,
): Promise<OutcomeMeasurement> {
  if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) throw new OutcomeMetricsDisabled();

  const db = _prisma ?? defaultPrisma;
  const def = getOutcome(args.outcomeKey);
  const dims = args.dimensions ?? {};
  const dimHash = hashDimensions(dims);
  const now = new Date();

  const { value, sampleSize } = await applyFormula(
    def.formula,
    args.tenantId,
    args.period.start,
    args.period.end,
    db,
  );

  const row = await db.outcomeMeasurement.upsert({
    where: {
      outcomeKey_tenantId_periodStart_periodGranularity_dimensionsHash: {
        outcomeKey: args.outcomeKey,
        tenantId: args.tenantId,
        periodStart: args.period.start,
        periodGranularity: args.period.granularity,
        dimensionsHash: dimHash,
      },
    },
    update: { value, sampleSize, computedAt: now, periodEnd: args.period.end, dimensions: dims },
    create: {
      outcomeKey: args.outcomeKey,
      tenantId: args.tenantId,
      periodStart: args.period.start,
      periodEnd: args.period.end,
      periodGranularity: args.period.granularity,
      dimensions: dims,
      dimensionsHash: dimHash,
      value,
      sampleSize,
      computedAt: now,
    },
  });

  return dbRowToMeasurement(row);
}

// ─── Dimensions hash ──────────────────────────────────────────────────────────

/** Canonical sha256 of sorted-key JSON so that equal dimension objects always produce equal hashes. */
export function hashDimensions(dims: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b))),
  );
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Formula dispatch ─────────────────────────────────────────────────────────

async function applyFormula(
  formula: OutcomeFormula,
  tenantId: string,
  start: Date,
  end: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<{ value: number; sampleSize: number }> {
  switch (formula.kind) {
    case 'count':          return applyCount(formula, tenantId, start, end, db);
    case 'sum':            return applySum(formula, tenantId, start, end, db);
    case 'duration_between_events': return applyDuration(formula, tenantId, start, end, db);
    case 'ratio_of_counts': return applyRatio(formula, tenantId, start, end, db);
  }
}

// ─── count ────────────────────────────────────────────────────────────────────

async function applyCount(
  formula: CountFormula,
  tenantId: string,
  start: Date,
  end: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<{ value: number; sampleSize: number }> {
  const rows = await db.eventRecord.findMany({
    where: {
      tenantId,
      eventName: formula.eventName,
      emittedAt: { gte: start, lt: end },
    },
    select: { id: true, payload: true },
  });

  const filtered = formula.payloadFilter
    ? rows.filter((r: { payload: unknown }) => matchesFilter(r.payload, formula.payloadFilter!))
    : rows;

  return { value: filtered.length, sampleSize: filtered.length };
}

// ─── sum ──────────────────────────────────────────────────────────────────────

async function applySum(
  formula: SumFormula,
  tenantId: string,
  start: Date,
  end: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<{ value: number; sampleSize: number }> {
  const rows = await db.eventRecord.findMany({
    where: {
      tenantId,
      eventName: formula.eventName,
      emittedAt: { gte: start, lt: end },
    },
    select: { payload: true },
  });

  const filtered = formula.payloadFilter
    ? rows.filter((r: { payload: unknown }) => matchesFilter(r.payload, formula.payloadFilter!))
    : rows;

  let total = 0;
  for (const row of filtered) {
    const v = getNestedField(row.payload, formula.field);
    if (typeof v === 'number') total += v;
  }

  return { value: total, sampleSize: filtered.length };
}

// ─── duration_between_events ──────────────────────────────────────────────────

async function applyDuration(
  formula: DurationBetweenEventsFormula,
  tenantId: string,
  start: Date,
  end: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<{ value: number; sampleSize: number }> {
  const [startRows, endRows] = await Promise.all([
    db.eventRecord.findMany({
      where: { tenantId, eventName: formula.startEvent, emittedAt: { gte: start, lt: end } },
      select: { aggregateId: true, emittedAt: true },
    }),
    db.eventRecord.findMany({
      where: { tenantId, eventName: formula.endEvent, emittedAt: { gte: start, lt: end } },
      select: { aggregateId: true, emittedAt: true },
    }),
  ]);

  // Index start times by aggregateId (keep earliest in period)
  const startMap = new Map<string, Date>();
  for (const r of startRows) {
    const existing = startMap.get(r.aggregateId);
    if (!existing || r.emittedAt < existing) startMap.set(r.aggregateId, r.emittedAt);
  }

  // Build durations for aggregateIds that have both start and end
  const durations: number[] = [];
  for (const r of endRows) {
    const s = startMap.get(r.aggregateId);
    if (!s) continue;
    const diffMs = r.emittedAt.getTime() - s.getTime();
    if (diffMs < 0) continue; // end before start — skip malformed pair
    durations.push(msToDuration(diffMs, formula.unit));
  }

  if (durations.length === 0) return { value: 0, sampleSize: 0 };

  return { value: aggregate(durations, formula.aggregation), sampleSize: durations.length };
}

// ─── ratio_of_counts ──────────────────────────────────────────────────────────

async function applyRatio(
  formula: RatioOfCountsFormula,
  tenantId: string,
  start: Date,
  end: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<{ value: number; sampleSize: number }> {
  const [numRows, denomRows] = await Promise.all([
    db.eventRecord.findMany({
      where: { tenantId, eventName: formula.numeratorEvent, emittedAt: { gte: start, lt: end } },
      select: { id: true, payload: true },
    }),
    db.eventRecord.findMany({
      where: { tenantId, eventName: formula.denominatorEvent, emittedAt: { gte: start, lt: end } },
      select: { id: true, payload: true },
    }),
  ]);

  const numFiltered = formula.numeratorFilter
    ? numRows.filter((r: { payload: unknown }) => matchesFilter(r.payload, formula.numeratorFilter!))
    : numRows;

  const denomFiltered = formula.denominatorFilter
    ? denomRows.filter((r: { payload: unknown }) => matchesFilter(r.payload, formula.denominatorFilter!))
    : denomRows;

  const denom = denomFiltered.length;
  if (denom === 0) return { value: 0, sampleSize: 0 };

  return {
    value: (numFiltered.length / denom) * 100,
    sampleSize: denom,
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function matchesFilter(payload: unknown, filter: Record<string, unknown>): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  for (const [key, expected] of Object.entries(filter)) {
    const actual = getNestedField(payload, key);
    if (actual !== expected) return false;
  }
  return true;
}

function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function msToDuration(ms: number, unit: 'seconds' | 'minutes' | 'hours'): number {
  if (unit === 'seconds') return ms / 1000;
  if (unit === 'minutes') return ms / 60_000;
  return ms / 3_600_000;
}

function aggregate(values: number[], method: DurationBetweenEventsFormula['aggregation']): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  switch (method) {
    case 'min':    return sorted[0];
    case 'max':    return sorted[n - 1];
    case 'mean':   return sorted.reduce((s, v) => s + v, 0) / n;
    case 'median': return percentile(sorted, 50);
    case 'p75':    return percentile(sorted, 75);
    case 'p90':    return percentile(sorted, 90);
    case 'p95':    return percentile(sorted, 95);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ─── DB row → domain type ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToMeasurement(row: any): OutcomeMeasurement {
  return {
    id: row.id,
    outcomeKey: row.outcomeKey,
    tenantId: row.tenantId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    periodGranularity: row.periodGranularity,
    dimensions: (row.dimensions ?? {}) as Record<string, unknown>,
    dimensionsHash: row.dimensionsHash,
    value: row.value,
    sampleSize: row.sampleSize,
    computedAt: row.computedAt,
  };
}
