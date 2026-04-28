import { isEnabled } from '@/lib/core/flags';
import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { hashDimensions } from './compute';
import {
  OutcomeMetricsDisabled,
  type MeasurementsQueryArgs,
  type OutcomeMeasurement,
  type OutcomeDefinition,
  type TargetComparison,
} from './types';

// =============================================================================
// Outcome Reporter — read-side helpers (Phase 6.3)
//
// getMeasurements(): reads stored OutcomeMeasurement rows for dashboards.
//   Does NOT recompute — call computeOutcome() first if fresh values are needed.
//
// compareToTarget(): evaluates a measurement against its definition's target
//   for 'on_target' / 'above' / 'below' / 'no_target' status.
// =============================================================================

/**
 * Retrieve stored measurements for a given outcome + tenant over a date range.
 *
 * @throws OutcomeMetricsDisabled when FF_OUTCOME_METRICS_ENABLED is OFF.
 */
export async function getMeasurements(
  args: MeasurementsQueryArgs,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _prisma?: any,
): Promise<OutcomeMeasurement[]> {
  if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) throw new OutcomeMetricsDisabled();

  const db = _prisma ?? defaultPrisma;
  const where: Record<string, unknown> = {
    outcomeKey: args.outcomeKey,
    tenantId: args.tenantId,
    periodGranularity: args.granularity,
    periodStart: { gte: args.range.start, lte: args.range.end },
  };

  if (args.dimensions && Object.keys(args.dimensions).length > 0) {
    where.dimensionsHash = hashDimensions(args.dimensions);
  }

  const rows = await db.outcomeMeasurement.findMany({
    where,
    orderBy: { periodStart: 'asc' },
  });

  return rows.map(rowToMeasurement);
}

/**
 * Compare a measurement value against the outcome definition's target.
 *
 * direction = 'lower_is_better': above target is bad, below is good.
 * direction = 'higher_is_better': above target is good, below is bad.
 * direction = 'target': within tolerance is 'on_target', otherwise 'above'/'below'.
 *
 * Returns 'no_target' when the definition has no target set.
 */
export function compareToTarget(
  measurement: OutcomeMeasurement,
  definition: OutcomeDefinition,
): TargetComparison {
  if (definition.target === undefined || definition.target === null) {
    return { status: 'no_target', delta: 0, percentDelta: 0 };
  }

  const delta = measurement.value - definition.target;
  const percentDelta =
    definition.target !== 0 ? (delta / Math.abs(definition.target)) * 100 : 0;

  const tolerance = definition.targetTolerance ?? 0;

  switch (definition.direction) {
    case 'target': {
      const status =
        Math.abs(delta) <= tolerance ? 'on_target' : delta > 0 ? 'above' : 'below';
      return { status, delta, percentDelta };
    }
    case 'lower_is_better': {
      // below target (or within tolerance) = on_target; above = bad (above)
      const status =
        delta <= tolerance ? 'on_target' : 'above';
      return { status, delta, percentDelta };
    }
    case 'higher_is_better': {
      // above target (or within tolerance) = on_target; below = bad (below)
      const status =
        delta >= -tolerance ? 'on_target' : 'below';
      return { status, delta, percentDelta };
    }
  }
}

// ─── DB row → domain type ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMeasurement(row: any): OutcomeMeasurement {
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
