/**
 * Phase 8.4 — Saudi outcome registration barrel tests
 *
 * Cases:
 *   1. flag OFF → registerSaudiOutcomes() reports skippedFlagOff, registers nothing
 *   2. flag ON  → registerSaudiOutcomes() lands all 15 outcomes
 *   3. flag ON  → calling twice is idempotent — second call reports
 *                 alreadyRegistered=15 and registered=0 (no throw)
 *   4. flag ON  → emit-deferred report lists exactly the outcomes tagged emit-deferred
 *   5. flag ON  → listSaudiOutcomeDefinitions() returns 15 unique keys
 *   6. flag ON  → no two outcomes share the same key (sanity guard against
 *                 typos as we add more in Phase 8.5)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { _resetRegistryForTest, listOutcomes } from '@/lib/outcomes/registry';
import {
  registerSaudiOutcomes,
  listSaudiOutcomeDefinitions,
} from '@/lib/outcomes/examples/saudi';

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

describe('Saudi registration barrel', () => {
  beforeEach(() => { _resetRegistryForTest(); disableFlag(); });
  afterEach(()  => { _resetRegistryForTest(); disableFlag(); });

  it('1. flag OFF — reports skippedFlagOff and registers nothing', () => {
    const report = registerSaudiOutcomes();
    expect(report.skippedFlagOff).toBe(true);
    expect(report.registered).toBe(0);
    expect(report.alreadyRegistered).toBe(0);
    expect(report.emitDeferred).toEqual([]);
    expect(listOutcomes()).toEqual([]);
  });

  it('2. flag ON — lands all 15 outcomes', () => {
    enableFlag();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = registerSaudiOutcomes();
    expect(report.skippedFlagOff).toBe(false);
    expect(report.registered).toBe(15);
    expect(report.alreadyRegistered).toBe(0);
    expect(listOutcomes()).toHaveLength(15);
    consoleSpy.mockRestore();
  });

  it('3. flag ON — calling twice is idempotent (second call: registered=0, alreadyRegistered=15, no throw)', () => {
    enableFlag();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const first = registerSaudiOutcomes();
    expect(first.registered).toBe(15);
    expect(first.alreadyRegistered).toBe(0);

    const second = registerSaudiOutcomes();
    expect(second.registered).toBe(0);
    expect(second.alreadyRegistered).toBe(15);
    expect(listOutcomes()).toHaveLength(15);
    consoleSpy.mockRestore();
  });

  it('4. flag ON — emit-deferred report matches the emit-deferred-tagged outcomes', () => {
    enableFlag();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const report = registerSaudiOutcomes();
    const expectedDeferred = listSaudiOutcomeDefinitions()
      .filter(d => d.tags.includes('emit-deferred'))
      .map(d => d.key);
    expect(report.emitDeferred.sort()).toEqual([...expectedDeferred].sort());
    expect(report.emitDeferred.length).toBeGreaterThan(0);
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(String(consoleSpy.mock.calls[0][0])).toMatch(/registered 15 Saudi outcomes/);
    consoleSpy.mockRestore();
  });

  it('5. listSaudiOutcomeDefinitions() returns 15 distinct keys (deterministic dry-run report)', () => {
    const defs = listSaudiOutcomeDefinitions();
    expect(defs).toHaveLength(15);
    const keys = new Set(defs.map(d => d.key));
    expect(keys.size).toBe(15);
  });

  it('6. every key is namespaced under saudi.* and unique (typo guard)', () => {
    const defs = listSaudiOutcomeDefinitions();
    for (const d of defs) {
      expect(d.key).toMatch(/^saudi\./);
    }
    const keys = defs.map(d => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
