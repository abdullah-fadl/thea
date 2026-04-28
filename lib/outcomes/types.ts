// =============================================================================
// Outcome Metrics Framework — Types (Phase 6.3)
// =============================================================================

// ─── Formula kinds ────────────────────────────────────────────────────────────

/**
 * count — count events matching criteria within the period.
 *
 * Example:
 *   { kind: 'count', eventName: 'er.patient.arrived@v1' }
 *   → how many patients arrived in the ER this week
 */
export interface CountFormula {
  kind: 'count';
  eventName: string;
  /** Optional filter on payload fields: { fieldPath: expectedValue } */
  payloadFilter?: Record<string, unknown>;
}

/**
 * sum — sum a numeric field from event payloads within the period.
 *
 * Example:
 *   { kind: 'sum', eventName: 'billing.claim.submitted@v1', field: 'amount' }
 *   → total claim amount submitted this month
 */
export interface SumFormula {
  kind: 'sum';
  eventName: string;
  /** Dot-path into payload (e.g. 'amount', 'details.durationMs'). */
  field: string;
  payloadFilter?: Record<string, unknown>;
}

/**
 * duration_between_events — compute a statistical aggregate of the elapsed time
 * between a start event and an end event, grouped per aggregate entity.
 *
 * Only pairs where both start and end fall within the period are counted.
 *
 * Example:
 *   {
 *     kind: 'duration_between_events',
 *     startEvent: 'er.patient.arrived@v1',
 *     endEvent:   'er.provider.assigned@v1',
 *     groupBy:    'patient.aggregateId',
 *     aggregation: 'median',
 *     unit: 'minutes'
 *   }
 *   → median door-to-provider minutes this week
 */
export interface DurationBetweenEventsFormula {
  kind: 'duration_between_events';
  startEvent: string;
  endEvent: string;
  /** Which field from the event envelope to group by for pairing ('patient.aggregateId' | 'aggregateId'). */
  groupBy: 'aggregateId' | 'patient.aggregateId';
  /** Statistical aggregation to apply across all pairs. */
  aggregation: 'mean' | 'median' | 'p75' | 'p90' | 'p95' | 'min' | 'max';
  /** Unit for the resulting duration ('minutes' | 'hours' | 'seconds'). */
  unit: 'seconds' | 'minutes' | 'hours';
}

/**
 * ratio_of_counts — (count_a / count_b) × 100, expressed as a percentage.
 *
 * Example:
 *   {
 *     kind: 'ratio_of_counts',
 *     numeratorEvent:   'er.triage.critical@v1',
 *     denominatorEvent: 'er.patient.arrived@v1'
 *   }
 *   → % of ER arrivals triaged as critical
 */
export interface RatioOfCountsFormula {
  kind: 'ratio_of_counts';
  numeratorEvent: string;
  denominatorEvent: string;
  numeratorFilter?: Record<string, unknown>;
  denominatorFilter?: Record<string, unknown>;
}

export type OutcomeFormula =
  | CountFormula
  | SumFormula
  | DurationBetweenEventsFormula
  | RatioOfCountsFormula;

// ─── Outcome definition ───────────────────────────────────────────────────────

export type OutcomeDirection = 'higher_is_better' | 'lower_is_better' | 'target';
export type PeriodGranularity = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
export type OutcomeStatus = 'active' | 'archived';

/** Declarative outcome descriptor — registered at boot, stored in outcome_definitions. */
export interface OutcomeDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  direction: OutcomeDirection;
  target?: number;
  targetTolerance?: number;
  formula: OutcomeFormula;
  tags: string[];
  status: OutcomeStatus;
}

// ─── Measurement ──────────────────────────────────────────────────────────────

/** One computed measurement for a (outcome, tenant, period, dimensions) tuple. */
export interface OutcomeMeasurement {
  id: string;
  outcomeKey: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  periodGranularity: PeriodGranularity;
  dimensions: Record<string, unknown>;
  dimensionsHash: string;
  value: number;
  sampleSize: number;
  computedAt: Date;
}

// ─── Compute args ─────────────────────────────────────────────────────────────

export interface ComputeArgs {
  outcomeKey: string;
  tenantId: string;
  period: {
    start: Date;
    end: Date;
    granularity: PeriodGranularity;
  };
  dimensions?: Record<string, unknown>;
}

// ─── Report helpers ───────────────────────────────────────────────────────────

export interface MeasurementsQueryArgs {
  outcomeKey: string;
  tenantId: string;
  range: { start: Date; end: Date };
  granularity: PeriodGranularity;
  dimensions?: Record<string, unknown>;
}

export type TargetStatus = 'on_target' | 'above' | 'below' | 'no_target';

export interface TargetComparison {
  status: TargetStatus;
  delta: number;
  percentDelta: number;
}

// ─── Error classes ────────────────────────────────────────────────────────────

export class OutcomeMetricsDisabled extends Error {
  constructor() {
    super(
      'Outcome metrics are disabled (FF_OUTCOME_METRICS_ENABLED is OFF) — ' +
        'set THEA_FF_OUTCOME_METRICS_ENABLED=true and apply migration 20260424000010_outcome_metrics',
    );
    this.name = 'OutcomeMetricsDisabled';
  }
}

export class OutcomeNotFound extends Error {
  constructor(public readonly key: string) {
    super(`Outcome not found in registry: ${key}`);
    this.name = 'OutcomeNotFound';
  }
}

export class OutcomeDuplicateKey extends Error {
  constructor(public readonly key: string) {
    super(`Outcome already registered: ${key}`);
    this.name = 'OutcomeDuplicateKey';
  }
}
