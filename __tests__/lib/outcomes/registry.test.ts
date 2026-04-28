/**
 * Phase 6.3 — Outcome registry tests
 *
 * Cases:
 *  1. Flag OFF → registerOutcome() is a no-op (no throw)
 *  2. Flag OFF → listOutcomes() returns []
 *  3. Flag OFF → getOutcome() throws OutcomeMetricsDisabled
 *  4. Flag ON  → register + getOutcome() round-trip succeeds
 *  5. Flag ON  → duplicate registration throws OutcomeDuplicateKey
 *  6. Flag ON  → listOutcomes() returns all registered definitions
 *  7. Flag ON  → getOutcome() throws OutcomeNotFound for unknown key
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import {
  registerOutcome,
  getOutcome,
  listOutcomes,
  _resetRegistryForTest,
} from '@/lib/outcomes/registry';
import {
  OutcomeMetricsDisabled,
  OutcomeNotFound,
  OutcomeDuplicateKey,
  type OutcomeDefinition,
} from '@/lib/outcomes/types';

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

const fakeDef = (key = 'test.metric.v1'): OutcomeDefinition => ({
  key,
  name: 'Test Metric',
  description: 'A test metric',
  unit: 'count',
  direction: 'lower_is_better',
  target: 10,
  targetTolerance: 2,
  formula: { kind: 'count', eventName: 'test.event@v1' },
  tags: ['test'],
  status: 'active',
});

describe('outcome registry', () => {
  beforeEach(() => { _resetRegistryForTest(); disableFlag(); });
  afterEach(()  => { _resetRegistryForTest(); disableFlag(); });

  it('1. flag OFF — registerOutcome() is a no-op, no throw', () => {
    expect(() => registerOutcome(fakeDef())).not.toThrow();
  });

  it('2. flag OFF — listOutcomes() returns []', () => {
    expect(listOutcomes()).toEqual([]);
  });

  it('3. flag OFF — getOutcome() throws OutcomeMetricsDisabled', () => {
    expect(() => getOutcome('test.metric.v1')).toThrow(OutcomeMetricsDisabled);
  });

  it('4. flag ON — register + getOutcome() round-trip succeeds', () => {
    enableFlag();
    registerOutcome(fakeDef());
    const def = getOutcome('test.metric.v1');
    expect(def.key).toBe('test.metric.v1');
    expect(def.unit).toBe('count');
    expect(def.direction).toBe('lower_is_better');
  });

  it('5. flag ON — duplicate registration throws OutcomeDuplicateKey', () => {
    enableFlag();
    registerOutcome(fakeDef());
    expect(() => registerOutcome(fakeDef())).toThrow(OutcomeDuplicateKey);
  });

  it('6. flag ON — listOutcomes() returns all registered definitions', () => {
    enableFlag();
    registerOutcome(fakeDef('metric.a'));
    registerOutcome(fakeDef('metric.b'));
    const list = listOutcomes();
    expect(list).toHaveLength(2);
    expect(list.map(d => d.key)).toContain('metric.a');
    expect(list.map(d => d.key)).toContain('metric.b');
  });

  it('7. flag ON — getOutcome() throws OutcomeNotFound for unknown key', () => {
    enableFlag();
    expect(() => getOutcome('no.such.metric')).toThrow(OutcomeNotFound);
  });
});
