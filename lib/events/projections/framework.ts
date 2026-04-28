import { isEnabled } from '@/lib/core/flags';
import { prisma as defaultPrisma } from '@/lib/db/prisma';

// =============================================================================
// Phase 5.1 — CQRS Projection Framework
//
// Turns the append-only events table into a set of typed, rebuildable read
// models.  Everything here is gated by FF_EVENT_PROJECTIONS_ENABLED.
//
// Behaviour matrix:
//   FF_EVENT_PROJECTIONS_ENABLED OFF →
//     registerProjection()    : no-op (silently returns, projection NOT stored)
//     getProjectionState()    : throws ProjectionsDisabled
//     rebuildProjection()     : throws ProjectionsDisabled
//     listProjections()       : returns []
//
//   FF_EVENT_PROJECTIONS_ENABLED ON →
//     registerProjection()    : stores projection in in-memory registry
//     getProjectionState()    : snapshot lookup → partial replay → returns typed state
//     rebuildProjection()     : full scan, writes snapshots, updates ProjectionState row
//     listProjections()       : returns all registered projection names
//
// Design notes:
//   1. States are keyed per (projectionName, tenantId, aggregateId).  Projections
//      that want tenant-wide state should treat aggregateId as the tenantId itself.
//   2. Snapshots are written when shouldSnapshot() returns true.  The default
//      strategy (used when the field is omitted) fires every DEFAULT_SNAPSHOT_EVERY events.
//   3. Idempotent: rebuilding the same projection twice produces identical state
//      because events are immutable and handlers are pure functions.
//   4. rebuildProjection() sets status='rebuilding' at the start and 'active' on
//      success (or writes errorMessage + stays 'rebuilding' on failure).
// =============================================================================

export const DEFAULT_SNAPSHOT_EVERY = 1_000;

// ─── Public types ─────────────────────────────────────────────────────────────

/** Full event record as delivered to projection handlers during replay. */
export interface ProjectionEventEnvelope {
  id: string;
  sequence: bigint;
  eventName: string;
  version: number;
  tenantId: string;
  aggregate: string;
  aggregateId: string;
  payload: unknown;
  metadata: unknown;
  emittedAt: Date;
}

export interface Projection<TState> {
  name: string;
  initialState: () => TState;
  /** Map from eventName to a pure reducer function. */
  handlers: Record<string, (state: TState, event: ProjectionEventEnvelope) => TState>;
  /**
   * Return true to trigger a snapshot write.
   * If omitted, a snapshot is taken every DEFAULT_SNAPSHOT_EVERY events.
   */
  shouldSnapshot?: (state: TState, eventsSinceLastSnapshot: number) => boolean;
}

export interface RebuildReport {
  projectionName: string;
  eventsProcessed: number;
  snapshotsTaken: number;
  durationMs: number;
  fromSequence: bigint;
}

export class ProjectionsDisabled extends Error {
  constructor() {
    super(
      'FF_EVENT_PROJECTIONS_ENABLED is not enabled — set THEA_FF_EVENT_PROJECTIONS_ENABLED=true',
    );
    this.name = 'ProjectionsDisabled';
  }
}

// ─── In-memory registry ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _registry = new Map<string, Projection<any>>();

/** @internal — test isolation only */
export function _resetRegistry(): void {
  _registry.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a projection.  No-op when FF_EVENT_PROJECTIONS_ENABLED is OFF.
 * Safe to call at module-load time.
 */
export function registerProjection<T>(proj: Projection<T>): void {
  if (!isEnabled('FF_EVENT_PROJECTIONS_ENABLED')) return;
  _registry.set(proj.name, proj as Projection<unknown>);
}

/**
 * Get the current state of a projection for a specific (tenantId, aggregateId) pair.
 *
 * Lookup order:
 *   1. Find the most recent snapshot in projection_snapshots.
 *   2. Re-play all events with sequence > snapshot.eventSequence.
 *   3. Return the resulting state.
 */
export async function getProjectionState<T>(
  name: string,
  tenantId: string,
  aggregateId: string,
): Promise<T> {
  if (!isEnabled('FF_EVENT_PROJECTIONS_ENABLED')) throw new ProjectionsDisabled();

  const proj = _registry.get(name);
  if (!proj) throw new Error(`Projection not registered: ${name}`);

  // Step 1 — find latest snapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = await (defaultPrisma as any).projectionSnapshot.findFirst({
    where: { projectionName: name, tenantId, aggregateId },
    orderBy: { eventSequence: 'desc' },
  });

  let state: T = snapshot ? (snapshot.state as T) : proj.initialState();
  const fromSequence: bigint = snapshot ? (snapshot.eventSequence as bigint) : BigInt(0);

  // Step 2 — replay events after the snapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = await (defaultPrisma as any).eventRecord.findMany({
    where: {
      tenantId,
      aggregateId,
      sequence: { gt: fromSequence },
    },
    orderBy: { sequence: 'asc' },
  });

  // Step 3 — apply handlers
  for (const ev of events) {
    const handler = proj.handlers[ev.eventName];
    if (handler) {
      state = handler(state, _toEnvelope(ev)) as T;
    }
  }

  return state;
}

/**
 * Rebuild a projection by scanning the entire events table (or a filtered subset).
 *
 * - Marks the projection as 'rebuilding' in projection_states at the start.
 * - Scans events in ascending sequence order, batching in REBUILD_BATCH_SIZE chunks.
 * - Writes snapshots per the projection's shouldSnapshot() strategy.
 * - Marks the projection as 'active' on success.
 * - Idempotent: re-running overwrites existing snapshot rows.
 */
export async function rebuildProjection(
  name: string,
  opts?: { tenantId?: string; fromSequence?: bigint },
  // Injectable prisma for tests — production always uses defaultPrisma
  _prisma?: typeof defaultPrisma,
): Promise<RebuildReport> {
  if (!isEnabled('FF_EVENT_PROJECTIONS_ENABLED')) throw new ProjectionsDisabled();

  const proj = _registry.get(name);
  if (!proj) throw new Error(`Projection not registered: ${name}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (_prisma ?? defaultPrisma) as any;

  const startTime = Date.now();
  const fromSequence = opts?.fromSequence ?? BigInt(0);

  // Mark as rebuilding
  await db.projectionState.upsert({
    where: { name },
    create: { name, status: 'rebuilding', lastEventSequence: fromSequence },
    update: { status: 'rebuilding', errorMessage: null },
  });

  let eventsProcessed = 0;
  let snapshotsTaken = 0;
  let maxSequence = fromSequence;
  let maxEventTime: Date | null = null;

  // Per-(tenantId, aggregateId) working state
  const stateMap = new Map<string, { state: unknown; eventsSinceSnapshot: number }>();

  try {
    const where: Record<string, unknown> = { sequence: { gt: fromSequence } };
    if (opts?.tenantId) where.tenantId = opts.tenantId;

    const BATCH = 500;
    let cursor: bigint | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchWhere: Record<string, unknown> = { ...where };
      if (cursor !== null) batchWhere.sequence = { gt: cursor };

      const batch = await db.eventRecord.findMany({
        where: batchWhere,
        orderBy: { sequence: 'asc' },
        take: BATCH,
      });

      if (batch.length === 0) break;

      for (const ev of batch) {
        const key = `${ev.tenantId}::${ev.aggregateId}`;
        if (!stateMap.has(key)) {
          stateMap.set(key, { state: proj.initialState(), eventsSinceSnapshot: 0 });
        }
        const entry = stateMap.get(key)!;

        const handler = proj.handlers[ev.eventName];
        if (handler) {
          entry.state = handler(entry.state as never, _toEnvelope(ev));
        }
        entry.eventsSinceSnapshot++;
        eventsProcessed++;

        if (ev.sequence > maxSequence) maxSequence = ev.sequence as bigint;
        if (!maxEventTime || ev.emittedAt > maxEventTime) maxEventTime = ev.emittedAt as Date;

        const snap =
          proj.shouldSnapshot != null
            ? proj.shouldSnapshot(entry.state as never, entry.eventsSinceSnapshot)
            : entry.eventsSinceSnapshot >= DEFAULT_SNAPSHOT_EVERY;

        if (snap) {
          await db.projectionSnapshot.create({
            data: {
              projectionName: name,
              tenantId: ev.tenantId,
              aggregateId: ev.aggregateId,
              state: entry.state,
              eventSequence: ev.sequence,
            },
          });
          entry.eventsSinceSnapshot = 0;
          snapshotsTaken++;
        }
      }

      cursor = batch[batch.length - 1].sequence as bigint;
      if (batch.length < BATCH) break;
    }

    // Write final snapshots for any aggregate that didn't hit the threshold
    for (const [key, entry] of stateMap.entries()) {
      if (entry.eventsSinceSnapshot > 0) {
        const [tenantId, aggregateId] = key.split('::');
        await db.projectionSnapshot.create({
          data: {
            projectionName: name,
            tenantId,
            aggregateId,
            state: entry.state,
            eventSequence: maxSequence,
          },
        });
        snapshotsTaken++;
      }
    }

    // Mark active and update high-water mark
    await db.projectionState.upsert({
      where: { name },
      create: {
        name,
        status: 'active',
        lastEventSequence: maxSequence,
        lastEventTime: maxEventTime,
      },
      update: {
        status: 'active',
        lastEventSequence: maxSequence,
        lastEventTime: maxEventTime,
        errorMessage: null,
      },
    });
  } catch (err) {
    await db.projectionState.upsert({
      where: { name },
      create: { name, status: 'rebuilding', errorMessage: String(err) },
      update: { errorMessage: String(err) },
    });
    throw err;
  }

  return {
    projectionName: name,
    eventsProcessed,
    snapshotsTaken,
    durationMs: Date.now() - startTime,
    fromSequence,
  };
}

/**
 * List all registered projection names.
 * Returns [] when FF_EVENT_PROJECTIONS_ENABLED is OFF.
 */
export function listProjections(): string[] {
  if (!isEnabled('FF_EVENT_PROJECTIONS_ENABLED')) return [];
  return Array.from(_registry.keys());
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _toEnvelope(record: Record<string, unknown>): ProjectionEventEnvelope {
  return {
    id: record.id as string,
    sequence: record.sequence as bigint,
    eventName: record.eventName as string,
    version: record.version as number,
    tenantId: record.tenantId as string,
    aggregate: record.aggregate as string,
    aggregateId: record.aggregateId as string,
    payload: record.payload,
    metadata: record.metadata,
    emittedAt: record.emittedAt as Date,
  };
}
