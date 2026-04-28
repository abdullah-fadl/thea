/**
 * Phase 6.3 — computeOutcome() tests
 *
 * Cases:
 *  1. Flag OFF → throws OutcomeMetricsDisabled
 *  2. count formula happy path → value = event count, sampleSize = value
 *  3. sum formula happy path → value = sum of payload field, sampleSize = event count
 *  4. duration_between_events happy path → median minutes, sampleSize = paired count
 *  5. ratio_of_counts happy path → (num / denom) × 100, sampleSize = denom
 *  6. duration formula with no matching events → value = 0, sampleSize = 0
 *  7. idempotent upsert: run twice → same row, no duplicate (composite unique hit)
 *  8. dimensionsHash is consistent for equal dimension objects
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { computeOutcome, hashDimensions } from '@/lib/outcomes/compute';
import { registerOutcome, _resetRegistryForTest } from '@/lib/outcomes/registry';
import { OutcomeMetricsDisabled, type OutcomeDefinition } from '@/lib/outcomes/types';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

// We pass prisma as a second argument to computeOutcome(), so no module-level mock needed.

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

const TENANT = '00000000-0000-0000-0000-000000000001';
const T0 = new Date('2026-04-18T00:00:00Z');
const T1 = new Date('2026-04-19T00:00:00Z');

/** Build a minimal fake prisma that records upsert calls and returns the upserted row. */
function makeFakePrisma(eventRecords: object[] = []) {
  const upsertedRow = {
    id: 'meas-1',
    outcomeKey: '',
    tenantId: TENANT,
    periodStart: T0,
    periodEnd: T1,
    periodGranularity: 'day',
    dimensions: {},
    dimensionsHash: '',
    value: 0,
    sampleSize: 0,
    computedAt: new Date(),
  };

  const upsert = vi.fn().mockImplementation(({ create }: { create: typeof upsertedRow }) => {
    upsertedRow.outcomeKey     = create.outcomeKey;
    upsertedRow.value          = create.value;
    upsertedRow.sampleSize     = create.sampleSize;
    upsertedRow.dimensionsHash = create.dimensionsHash;
    return Promise.resolve({ ...upsertedRow });
  });

  return {
    eventRecord: {
      findMany: vi.fn().mockResolvedValue(eventRecords),
    },
    outcomeMeasurement: { upsert },
    _upsert: upsert,
  };
}

const period = { start: T0, end: T1, granularity: 'day' as const };

const countDef: OutcomeDefinition = {
  key: 'test.count',
  name: 'Count test',
  description: '',
  unit: 'count',
  direction: 'higher_is_better',
  formula: { kind: 'count', eventName: 'test.event@v1' },
  tags: [],
  status: 'active',
};

const sumDef: OutcomeDefinition = {
  key: 'test.sum',
  name: 'Sum test',
  description: '',
  unit: 'minutes',
  direction: 'higher_is_better',
  formula: { kind: 'sum', eventName: 'test.event@v1', field: 'amount' },
  tags: [],
  status: 'active',
};

const durationDef: OutcomeDefinition = {
  key: 'test.duration',
  name: 'Duration test',
  description: '',
  unit: 'minutes',
  direction: 'lower_is_better',
  target: 30,
  formula: {
    kind: 'duration_between_events',
    startEvent: 'er.patient.arrived@v1',
    endEvent:   'er.provider.assigned@v1',
    groupBy: 'aggregateId',
    aggregation: 'median',
    unit: 'minutes',
  },
  tags: [],
  status: 'active',
};

const ratioDef: OutcomeDefinition = {
  key: 'test.ratio',
  name: 'Ratio test',
  description: '',
  unit: 'percent',
  direction: 'lower_is_better',
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent:   'er.triage.critical@v1',
    denominatorEvent: 'er.patient.arrived@v1',
  },
  tags: [],
  status: 'active',
};

describe('computeOutcome()', () => {
  beforeEach(() => { _resetRegistryForTest(); disableFlag(); });
  afterEach(()  => { _resetRegistryForTest(); disableFlag(); });

  it('1. flag OFF → throws OutcomeMetricsDisabled', async () => {
    await expect(
      computeOutcome({ outcomeKey: 'test.count', tenantId: TENANT, period }),
    ).rejects.toThrow(OutcomeMetricsDisabled);
  });

  it('2. count formula happy path', async () => {
    enableFlag();
    registerOutcome(countDef);
    const events = [
      { id: '1', payload: {} },
      { id: '2', payload: {} },
      { id: '3', payload: {} },
    ];
    const db = makeFakePrisma(events);
    const result = await computeOutcome({ outcomeKey: 'test.count', tenantId: TENANT, period }, db);
    expect(result.value).toBe(3);
    expect(result.sampleSize).toBe(3);
    expect(db._upsert).toHaveBeenCalledOnce();
  });

  it('3. sum formula happy path', async () => {
    enableFlag();
    registerOutcome(sumDef);
    const events = [
      { payload: { amount: 10 } },
      { payload: { amount: 25 } },
      { payload: { amount: 5 } },
    ];
    const db = makeFakePrisma(events);
    const result = await computeOutcome({ outcomeKey: 'test.sum', tenantId: TENANT, period }, db);
    expect(result.value).toBe(40);
    expect(result.sampleSize).toBe(3);
  });

  it('4. duration_between_events happy path — median minutes', async () => {
    enableFlag();
    registerOutcome(durationDef);

    // Three patient pairs: 10 min, 20 min, 30 min → median = 20
    const t = (offsetMin: number) => new Date(T0.getTime() + offsetMin * 60_000);

    const startRows = [
      { aggregateId: 'p1', emittedAt: t(0)  },
      { aggregateId: 'p2', emittedAt: t(0)  },
      { aggregateId: 'p3', emittedAt: t(0)  },
    ];
    const endRows = [
      { aggregateId: 'p1', emittedAt: t(10) },
      { aggregateId: 'p2', emittedAt: t(20) },
      { aggregateId: 'p3', emittedAt: t(30) },
    ];

    // findMany is called twice: once for startEvent, once for endEvent
    const db = {
      eventRecord: {
        findMany: vi.fn()
          .mockResolvedValueOnce(startRows)
          .mockResolvedValueOnce(endRows),
      },
      outcomeMeasurement: {
        upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ ...create, id: 'meas-4', computedAt: new Date() }),
        ),
      },
      _upsert: undefined as unknown,
    };
    db._upsert = db.outcomeMeasurement.upsert;

    const result = await computeOutcome({ outcomeKey: 'test.duration', tenantId: TENANT, period }, db);
    expect(result.value).toBe(20);
    expect(result.sampleSize).toBe(3);
  });

  it('5. ratio_of_counts happy path → percentage', async () => {
    enableFlag();
    registerOutcome(ratioDef);

    // 2 critical out of 10 arrivals = 20%
    const db = {
      eventRecord: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: '1', payload: {} }, { id: '2', payload: {} }]) // numerator = 2
          .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: String(i), payload: {} }))), // denom = 10
      },
      outcomeMeasurement: {
        upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ ...create, id: 'meas-5', computedAt: new Date() }),
        ),
      },
    };

    const result = await computeOutcome({ outcomeKey: 'test.ratio', tenantId: TENANT, period }, db);
    expect(result.value).toBeCloseTo(20);
    expect(result.sampleSize).toBe(10);
  });

  it('6. duration formula with no matching events → value = 0, sampleSize = 0', async () => {
    enableFlag();
    registerOutcome(durationDef);

    const db = {
      eventRecord: { findMany: vi.fn().mockResolvedValue([]) },
      outcomeMeasurement: {
        upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ ...create, id: 'meas-6', computedAt: new Date() }),
        ),
      },
    };

    const result = await computeOutcome({ outcomeKey: 'test.duration', tenantId: TENANT, period }, db);
    expect(result.value).toBe(0);
    expect(result.sampleSize).toBe(0);
  });

  it('7. idempotent upsert — upsert called on both runs', async () => {
    enableFlag();
    registerOutcome(countDef);

    const db = makeFakePrisma([{ id: '1', payload: {} }]);
    await computeOutcome({ outcomeKey: 'test.count', tenantId: TENANT, period }, db);
    await computeOutcome({ outcomeKey: 'test.count', tenantId: TENANT, period }, db);

    // upsert was called twice — idempotency is enforced by the DB unique constraint
    expect(db._upsert).toHaveBeenCalledTimes(2);
  });

  it('8. dimensionsHash is consistent for equal dimension objects', () => {
    const a = hashDimensions({ hospitalId: 'h1', departmentCode: 'ER' });
    const b = hashDimensions({ departmentCode: 'ER', hospitalId: 'h1' }); // different key order
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // sha256 hex string
  });
});
