/**
 * Phase 8.3 — LabResultMonitorAgent ↔ event-bus subscription
 *
 * Wires the LabResultMonitorAgent into the Phase 4.2 event bus by
 * subscribing to `lab.result.posted@v1`. On each event the subscriber
 * loads the underlying event row by envelope.id, extracts the labResultId
 * from its payload, and runs the agent for that result.
 *
 * Behavior matrix:
 *   FF_AI_AGENTS_ENABLED OFF or FF_EVENT_BUS_ENABLED OFF
 *     → registerLabMonitorSubscriber() returns immediately;
 *       no subscribe() call is made; zero behavior change.
 *   Both ON
 *     → subscribe() is registered. When startEventBus() begins LISTEN'ing,
 *       every lab.result.posted@v1 event triggers
 *       runAgent('clinical.lab-monitor.v1').
 *
 * The Phase 4.2 envelope only carries id/eventName/version/tenantId so we
 * never trust clinical values from the bus — we re-read by id through
 * tenant-scoped Prisma both for the event row AND for the LabResult row
 * (the latter happens inside the agent handler).
 */

import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { subscribe } from '@/lib/events/subscribe';
import { runAgent } from '../framework/run';
import { LAB_MONITOR_AGENT_KEY } from '../agents/labMonitor';

let _registered = false;

/**
 * Idempotent subscriber registration.
 * Call once at app boot from the same site that registers other agents.
 */
export function registerLabMonitorSubscriber(): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;
  if (!isEnabled('FF_EVENT_BUS_ENABLED')) return;
  if (_registered) return;
  _registered = true;

  subscribe({
    eventName: 'lab.result.posted',
    version: 1,
    handler: async (envelope, { ack, nack }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (prisma as any).eventRecord.findUnique({
          where: { id: envelope.id },
          select: { tenantId: true, aggregateId: true, payload: true },
        });
        if (!row) {
          nack('event_record_not_found');
          return;
        }

        // Source-of-truth precedence: explicit payload.labResultId first,
        // then aggregateId (set to labResult.id by the save route).
        const payload = row.payload as { labResultId?: unknown } | null;
        const labResultId =
          (typeof payload?.labResultId === 'string' && payload.labResultId) ||
          (typeof row.aggregateId === 'string' && row.aggregateId) ||
          null;

        if (!labResultId) {
          nack('lab_result_id_missing');
          return;
        }

        await runAgent({
          agentKey: LAB_MONITOR_AGENT_KEY,
          input: { labResultId },
          tenantId: row.tenantId ?? envelope.tenantId,
          actorUserId: null,
        });
        ack();
      } catch (err) {
        nack(err instanceof Error ? err.message : String(err));
      }
    },
  });
}

/** @internal — test use only */
export function _resetLabMonitorSubscriberForTest(): void {
  _registered = false;
}
