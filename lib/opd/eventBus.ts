/**
 * OPD Event Bus — backward-compatible wrapper around the real-time Pub/Sub.
 *
 * Previously this was a pure in-memory EventEmitter that only worked within
 * a single server instance. It now delegates to `lib/realtime/pubsub.ts`
 * which uses Redis Pub/Sub when available, falling back to in-memory
 * EventEmitter when Redis is unavailable.
 *
 * Existing callers continue to use the same API:
 * ```ts
 * import { opdEventBus } from '@/lib/opd/eventBus';
 *
 * // Emit
 * opdEventBus.emit({ type: 'FLOW_STATE_CHANGE', encounterCoreId, tenantId, data: {...}, timestamp: '...' });
 *
 * // Subscribe
 * const unsub = opdEventBus.subscribe(tenantId, (event) => { ... });
 * ```
 */

import { publishEvent, subscribeToTenant, type RealtimeEvent } from '@/lib/realtime/pubsub';

// ---------------------------------------------------------------------------
// Legacy types (preserved for backward compatibility)
// ---------------------------------------------------------------------------

export interface OpdEvent {
  type: 'FLOW_STATE_CHANGE' | 'NEW_PATIENT' | 'VITALS_SAVED';
  encounterCoreId: string;
  tenantId: string;
  data: Record<string, any>;
  timestamp: string;
}

type Listener = (event: OpdEvent) => void;

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

class OpdEventBus {
  /**
   * Subscribe to OPD events for a tenant.
   * Returns an unsubscribe function.
   */
  subscribe(tenantId: string, listener: Listener): () => void {
    // The Pub/Sub layer uses RealtimeEvent; adapt to OpdEvent
    return subscribeToTenant(tenantId, (realtimeEvent: RealtimeEvent) => {
      try {
        const opdEvent: OpdEvent = {
          type: realtimeEvent.type as OpdEvent['type'],
          encounterCoreId: realtimeEvent.payload?.encounterCoreId || '',
          tenantId: realtimeEvent.tenantId,
          data: realtimeEvent.payload || {},
          timestamp: typeof realtimeEvent.timestamp === 'number'
            ? new Date(realtimeEvent.timestamp).toISOString()
            : String(realtimeEvent.timestamp),
        };
        listener(opdEvent);
      } catch {
        // Swallow listener errors to prevent cascading failures
      }
    });
  }

  /**
   * Emit an OPD event. Publishes through the Pub/Sub layer (Redis when
   * available, in-memory otherwise).
   */
  emit(event: OpdEvent): void {
    publishEvent({
      type: event.type,
      tenantId: event.tenantId,
      payload: {
        encounterCoreId: event.encounterCoreId,
        ...event.data,
      },
      timestamp: typeof event.timestamp === 'string'
        ? new Date(event.timestamp).getTime()
        : Date.now(),
    }).catch(() => {
      // Fire-and-forget — errors are logged inside publishEvent
    });
  }
}

// Singleton
export const opdEventBus = new OpdEventBus();
