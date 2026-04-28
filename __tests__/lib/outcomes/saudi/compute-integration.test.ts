/**
 * Phase 8.4 — Saudi outcome compute-engine integration test
 *
 * Walks the lab-turnaround-time outcome end-to-end:
 *   - register the Saudi barrel
 *   - feed mock event rows into a fake prisma's eventRecord.findMany
 *   - call computeOutcome() with the registered Saudi key
 *   - assert the median minutes the framework returns matches the median
 *     of the synthetic durations
 *
 * Why lab TAT and not a deferred outcome:
 *   The deferred ones (claim.*, eligibility.*, etc.) cannot exercise the
 *   compute path with realistic events because their event schemas exist
 *   but their semantic meaning under tests is no different from any
 *   string-keyed mock. Lab TAT uses live Phase 7.4 events so the test
 *   doubles as proof that the formula contract resolves cleanly against
 *   the real event-name conventions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { computeOutcome } from '@/lib/outcomes/compute';
import { _resetRegistryForTest } from '@/lib/outcomes/registry';
import { registerSaudiOutcomes } from '@/lib/outcomes/examples/saudi';

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

const TENANT = '00000000-0000-0000-0000-000000000001';
const T0 = new Date('2026-04-18T00:00:00Z');
const T1 = new Date('2026-04-19T00:00:00Z');
const period = { start: T0, end: T1, granularity: 'day' as const };

describe('Saudi outcomes — compute integration', () => {
  beforeEach(() => { _resetRegistryForTest(); disableFlag(); });
  afterEach(()  => { _resetRegistryForTest(); disableFlag(); });

  it('lab TAT — median minutes from order.placed@v1 → lab.result.posted@v1 (live Phase 7.4 events)', async () => {
    enableFlag();
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    registerSaudiOutcomes();

    // Three lab orders in the period: TAT 30, 45, 90 min → median = 45
    const t = (offsetMin: number) => new Date(T0.getTime() + offsetMin * 60_000);

    const orderPlaced = [
      { aggregateId: 'lab1', emittedAt: t(0)  },
      { aggregateId: 'lab2', emittedAt: t(0)  },
      { aggregateId: 'lab3', emittedAt: t(0)  },
    ];
    const labPosted = [
      { aggregateId: 'lab1', emittedAt: t(30) },
      { aggregateId: 'lab2', emittedAt: t(45) },
      { aggregateId: 'lab3', emittedAt: t(90) },
    ];

    const db = {
      eventRecord: {
        findMany: vi.fn()
          .mockResolvedValueOnce(orderPlaced)  // startEvent: order.placed@v1
          .mockResolvedValueOnce(labPosted),   // endEvent:   lab.result.posted@v1
      },
      outcomeMeasurement: {
        upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ ...create, id: 'meas-saudi-lab', computedAt: new Date() }),
        ),
      },
    };

    const result = await computeOutcome(
      { outcomeKey: 'saudi.lab.turnaround_time_minutes', tenantId: TENANT, period },
      db,
    );

    expect(result.value).toBe(45);
    expect(result.sampleSize).toBe(3);
    expect(db.eventRecord.findMany).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
