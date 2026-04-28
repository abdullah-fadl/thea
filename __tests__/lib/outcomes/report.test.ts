/**
 * Phase 6.3 — getMeasurements() + compareToTarget() tests
 *
 * Cases:
 *  1. getMeasurements() flag OFF → throws OutcomeMetricsDisabled
 *  2. getMeasurements() returns stored rows filtered by range
 *  3. compareToTarget() direction=lower_is_better — on target
 *  4. compareToTarget() direction=higher_is_better — below target
 *  5. compareToTarget() direction=target — within tolerance → on_target
 *  6. compareToTarget() no target defined → no_target
 *  7. getMeasurements() dimensions filter applied via dimensionsHash
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { getMeasurements, compareToTarget } from '@/lib/outcomes/report';
import { OutcomeMetricsDisabled, type OutcomeMeasurement, type OutcomeDefinition } from '@/lib/outcomes/types';
import { hashDimensions } from '@/lib/outcomes/compute';

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

const TENANT = '00000000-0000-0000-0000-000000000001';
const T0 = new Date('2026-04-14T00:00:00Z');
const T7 = new Date('2026-04-21T00:00:00Z');

function makeRow(overrides: Partial<OutcomeMeasurement> = {}): OutcomeMeasurement {
  return {
    id: 'meas-1',
    outcomeKey: 'er.door_to_provider_minutes',
    tenantId: TENANT,
    periodStart: new Date('2026-04-18T00:00:00Z'),
    periodEnd:   new Date('2026-04-19T00:00:00Z'),
    periodGranularity: 'day',
    dimensions: {},
    dimensionsHash: hashDimensions({}),
    value: 24.5,
    sampleSize: 38,
    computedAt: new Date(),
    ...overrides,
  };
}

describe('getMeasurements()', () => {
  afterEach(() => { disableFlag(); });

  it('1. flag OFF → throws OutcomeMetricsDisabled', async () => {
    disableFlag();
    await expect(
      getMeasurements({ outcomeKey: 'x', tenantId: TENANT, range: { start: T0, end: T7 }, granularity: 'day' }),
    ).rejects.toThrow(OutcomeMetricsDisabled);
  });

  it('2. returns stored rows filtered by range', async () => {
    enableFlag();
    const rows = [makeRow(), makeRow({ id: 'meas-2', periodStart: new Date('2026-04-17T00:00:00Z') })];
    const fakePrisma = {
      outcomeMeasurement: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
    };
    const result = await getMeasurements(
      { outcomeKey: 'er.door_to_provider_minutes', tenantId: TENANT, range: { start: T0, end: T7 }, granularity: 'day' },
      fakePrisma,
    );
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(24.5);
    expect(fakePrisma.outcomeMeasurement.findMany).toHaveBeenCalledOnce();
  });

  it('7. dimensions filter applied via dimensionsHash', async () => {
    enableFlag();
    const dims = { hospitalId: 'h1' };
    const fakePrisma = {
      outcomeMeasurement: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await getMeasurements(
      { outcomeKey: 'er.door_to_provider_minutes', tenantId: TENANT, range: { start: T0, end: T7 }, granularity: 'day', dimensions: dims },
      fakePrisma,
    );
    const callArg = fakePrisma.outcomeMeasurement.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArg.where.dimensionsHash).toBe(hashDimensions(dims));
  });
});

describe('compareToTarget()', () => {
  const baseDef = (overrides: Partial<OutcomeDefinition> = {}): OutcomeDefinition => ({
    key: 'x',
    name: 'X',
    description: '',
    unit: 'minutes',
    direction: 'lower_is_better',
    target: 30,
    targetTolerance: 5,
    formula: { kind: 'count', eventName: 'e@v1' },
    tags: [],
    status: 'active',
    ...overrides,
  });

  it('3. lower_is_better — value below target → on_target', () => {
    const m = makeRow({ value: 25 });
    const result = compareToTarget(m, baseDef({ direction: 'lower_is_better', target: 30, targetTolerance: 5 }));
    expect(result.status).toBe('on_target');
    expect(result.delta).toBeCloseTo(-5);
    expect(result.percentDelta).toBeCloseTo(-16.67, 1);
  });

  it('4. higher_is_better — value below target → below', () => {
    const m = makeRow({ value: 80 });
    const result = compareToTarget(m, baseDef({ direction: 'higher_is_better', target: 95, targetTolerance: 2 }));
    expect(result.status).toBe('below');
    expect(result.delta).toBeCloseTo(-15);
  });

  it('5. direction=target — within tolerance → on_target', () => {
    const m = makeRow({ value: 32 });
    const result = compareToTarget(m, baseDef({ direction: 'target', target: 30, targetTolerance: 5 }));
    expect(result.status).toBe('on_target'); // |32-30| = 2 ≤ 5
  });

  it('6. no target defined → no_target', () => {
    const def = baseDef({ target: undefined, targetTolerance: undefined });
    const result = compareToTarget(makeRow(), def);
    expect(result.status).toBe('no_target');
    expect(result.delta).toBe(0);
    expect(result.percentDelta).toBe(0);
  });
});
