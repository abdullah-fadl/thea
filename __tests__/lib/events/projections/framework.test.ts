/**
 * Phase 5.1 — Projection framework tests
 *
 * Cases:
 *  1.  Flag OFF → registerProjection() is a no-op (projection NOT stored)
 *  2.  Flag OFF → getProjectionState() throws ProjectionsDisabled
 *  3.  Flag OFF → rebuildProjection() throws ProjectionsDisabled
 *  4.  Flag OFF → listProjections() returns []
 *  5.  Flag ON  → register + handler dispatch: event applied, state updated
 *  6.  Flag ON  → rebuild from zero: state matches expected after replaying all events
 *  7.  Flag ON  → rebuild from snapshot: partial replay (only events after snapshot)
 *  8.  Flag ON  → shouldSnapshot triggers snapshot write during rebuild
 *  9.  Flag ON  → listProjections returns registered projection names
 * 10.  Flag ON  → getProjectionState with snapshot: uses snapshot state + replays tail
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Test UUIDs ──────────────────────────────────────────────────────────────

const TENANT_ID    = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const AGGREGATE_ID = '550e8400-e29b-41d4-a716-446655440000';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const {
  mockSnapshotFindFirst,
  mockSnapshotCreate,
  mockEventFindMany,
  mockStateUpsert,
} = vi.hoisted(() => ({
  mockSnapshotFindFirst: vi.fn(),
  mockSnapshotCreate: vi.fn(),
  mockEventFindMany: vi.fn(),
  mockStateUpsert: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    projectionSnapshot: {
      findFirst: mockSnapshotFindFirst,
      create: mockSnapshotCreate,
    },
    eventRecord: {
      findMany: mockEventFindMany,
    },
    projectionState: {
      upsert: mockStateUpsert,
    },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_EVENT_PROJECTIONS_ENABLED] = 'true'; }
function setFlagOff() { delete process.env[FLAGS.FF_EVENT_PROJECTIONS_ENABLED]; }

function makeEvent(
  seq: number,
  eventName = 'test.thing.happened',
  override: Record<string, unknown> = {},
) {
  return {
    id: `event-${seq}`,
    sequence: BigInt(seq),
    eventName,
    version: 1,
    tenantId: TENANT_ID,
    aggregate: 'thing',
    aggregateId: AGGREGATE_ID,
    payload: { value: seq },
    metadata: null,
    emittedAt: new Date(),
    ...override,
  };
}

interface CountState { count: number }

async function freshFramework() {
  vi.resetModules();
  const mod = await import('@/lib/events/projections/framework');
  return mod;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Projection framework', () => {
  beforeEach(() => {
    setFlagOff();
    mockSnapshotFindFirst.mockReset();
    mockSnapshotCreate.mockReset();
    mockEventFindMany.mockReset();
    mockStateUpsert.mockReset();
    mockSnapshotFindFirst.mockResolvedValue(null);
    mockSnapshotCreate.mockResolvedValue({});
    mockEventFindMany.mockResolvedValue([]);
    mockStateUpsert.mockResolvedValue({});
  });

  afterEach(() => {
    setFlagOff();
  });

  // ── Case 1 ─────────────────────────────────────────────────────────────────
  it('registerProjection is a no-op when flag is OFF', async () => {
    const { registerProjection, listProjections } = await freshFramework();
    registerProjection<CountState>({
      name: 'noop-proj',
      initialState: () => ({ count: 0 }),
      handlers: {},
    });
    // Even if flag is turned ON now, the projection was not stored
    setFlagOn();
    expect(listProjections()).not.toContain('noop-proj');
  });

  // ── Case 2 ─────────────────────────────────────────────────────────────────
  it('getProjectionState throws ProjectionsDisabled when flag is OFF', async () => {
    const { getProjectionState, ProjectionsDisabled } = await freshFramework();
    await expect(
      getProjectionState('any', TENANT_ID, AGGREGATE_ID),
    ).rejects.toBeInstanceOf(ProjectionsDisabled);
  });

  // ── Case 3 ─────────────────────────────────────────────────────────────────
  it('rebuildProjection throws ProjectionsDisabled when flag is OFF', async () => {
    const { rebuildProjection, ProjectionsDisabled } = await freshFramework();
    await expect(rebuildProjection('any')).rejects.toBeInstanceOf(ProjectionsDisabled);
  });

  // ── Case 4 ─────────────────────────────────────────────────────────────────
  it('listProjections returns [] when flag is OFF', async () => {
    const { listProjections } = await freshFramework();
    expect(listProjections()).toEqual([]);
  });

  // ── Case 5 ─────────────────────────────────────────────────────────────────
  it('register + handler dispatch: event applied, state updated', async () => {
    setFlagOn();
    const { registerProjection, getProjectionState } = await freshFramework();

    registerProjection<CountState>({
      name: 'counter',
      initialState: () => ({ count: 0 }),
      handlers: {
        'test.thing.happened': (s, _e) => ({ count: s.count + 1 }),
      },
    });

    mockEventFindMany.mockResolvedValueOnce([
      makeEvent(1),
      makeEvent(2),
      makeEvent(3),
    ]);

    const state = await getProjectionState<CountState>('counter', TENANT_ID, AGGREGATE_ID);
    expect(state.count).toBe(3);
  });

  // ── Case 6 ─────────────────────────────────────────────────────────────────
  it('rebuildProjection from zero: state matches expected', async () => {
    setFlagOn();
    const { registerProjection, rebuildProjection, _resetRegistry } = await freshFramework();
    _resetRegistry();

    registerProjection<CountState>({
      name: 'rebuild-counter',
      initialState: () => ({ count: 0 }),
      handlers: {
        'ev.inc': (s) => ({ count: s.count + 1 }),
      },
    });

    // First batch returns 3 events, second batch returns empty (signals end)
    mockEventFindMany
      .mockResolvedValueOnce([
        makeEvent(1, 'ev.inc'),
        makeEvent(2, 'ev.inc'),
        makeEvent(3, 'ev.inc'),
      ])
      .mockResolvedValueOnce([]);

    const report = await rebuildProjection('rebuild-counter');

    expect(report.eventsProcessed).toBe(3);
    expect(report.projectionName).toBe('rebuild-counter');
    expect(mockStateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  // ── Case 7 ─────────────────────────────────────────────────────────────────
  it('getProjectionState with snapshot: only replays events after snapshot sequence', async () => {
    setFlagOn();
    const { registerProjection, getProjectionState } = await freshFramework();

    registerProjection<CountState>({
      name: 'partial-replay',
      initialState: () => ({ count: 0 }),
      handlers: {
        'ev.inc': (s) => ({ count: s.count + 1 }),
      },
    });

    // Snapshot represents state after seq 5 — count was already 5
    mockSnapshotFindFirst.mockResolvedValueOnce({
      state: { count: 5 },
      eventSequence: BigInt(5),
    });

    // Only 2 new events after seq 5
    mockEventFindMany.mockResolvedValueOnce([
      makeEvent(6, 'ev.inc'),
      makeEvent(7, 'ev.inc'),
    ]);

    const state = await getProjectionState<CountState>('partial-replay', TENANT_ID, AGGREGATE_ID);
    expect(state.count).toBe(7); // 5 from snapshot + 2 replayed

    // Verify the DB query filtered correctly (gt: BigInt(5))
    expect(mockEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sequence: { gt: BigInt(5) },
        }),
      }),
    );
  });

  // ── Case 8 ─────────────────────────────────────────────────────────────────
  it('shouldSnapshot triggers snapshot write during rebuild', async () => {
    setFlagOn();
    const { registerProjection, rebuildProjection, _resetRegistry } = await freshFramework();
    _resetRegistry();

    // shouldSnapshot fires on every 2nd event
    registerProjection<CountState>({
      name: 'snapping',
      initialState: () => ({ count: 0 }),
      handlers: {
        'ev.inc': (s) => ({ count: s.count + 1 }),
      },
      shouldSnapshot: (_state, n) => n % 2 === 0,
    });

    mockEventFindMany
      .mockResolvedValueOnce([
        makeEvent(1, 'ev.inc'),
        makeEvent(2, 'ev.inc'),
        makeEvent(3, 'ev.inc'),
        makeEvent(4, 'ev.inc'),
      ])
      .mockResolvedValueOnce([]);

    await rebuildProjection('snapping');

    // Snapshots fired at event 2 and 4, plus no-remaining (0 leftover) → 2 mid-stream
    // The final snapshot is only written for aggregates with leftover events after the batch,
    // but since shouldSnapshot fired at 4, eventsSinceSnapshot resets to 0 → no final snapshot
    expect(mockSnapshotCreate).toHaveBeenCalledTimes(2);
  });

  // ── Case 9 ─────────────────────────────────────────────────────────────────
  it('listProjections returns registered projection names', async () => {
    setFlagOn();
    const { registerProjection, listProjections, _resetRegistry } = await freshFramework();
    _resetRegistry();

    registerProjection<CountState>({
      name: 'proj-alpha',
      initialState: () => ({ count: 0 }),
      handlers: {},
    });
    registerProjection<CountState>({
      name: 'proj-beta',
      initialState: () => ({ count: 0 }),
      handlers: {},
    });

    const names = listProjections();
    expect(names).toContain('proj-alpha');
    expect(names).toContain('proj-beta');
  });

  // ── Case 10 ────────────────────────────────────────────────────────────────
  it('getProjectionState with no snapshot: starts from initialState', async () => {
    setFlagOn();
    const { registerProjection, getProjectionState } = await freshFramework();

    registerProjection<CountState>({
      name: 'fresh-state',
      initialState: () => ({ count: 100 }), // non-zero initial to confirm it was used
      handlers: {
        'ev.inc': (s) => ({ count: s.count + 1 }),
      },
    });

    mockSnapshotFindFirst.mockResolvedValueOnce(null);
    mockEventFindMany.mockResolvedValueOnce([makeEvent(1, 'ev.inc')]);

    const state = await getProjectionState<CountState>('fresh-state', TENANT_ID, AGGREGATE_ID);
    expect(state.count).toBe(101);
  });
});
