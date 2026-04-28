/**
 * SSE Connection Manager for Thea EHR
 *
 * Creates ReadableStreams suitable for Server-Sent Events (SSE) responses.
 * Each stream subscribes to the Redis-backed Pub/Sub for its tenant and
 * automatically cleans up on disconnect.
 *
 * Features:
 * - Heartbeat every 30 seconds to keep connections alive through proxies
 * - Optional event-type filtering (e.g. only FLOW_STATE_CHANGE events)
 * - Automatic cleanup via AbortSignal
 * - Tracks active connections per tenant for monitoring
 *
 * Usage (in an API route):
 * ```ts
 * import { createSSEStream } from '@/lib/realtime/sseManager';
 *
 * const stream = createSSEStream({
 *   tenantId,
 *   userId,
 *   signal: req.signal,
 *   eventTypes: ['FLOW_STATE_CHANGE', 'VITALS_SAVED'],
 * });
 *
 * return new Response(stream, {
 *   headers: {
 *     'Content-Type': 'text/event-stream',
 *     'Cache-Control': 'no-cache, no-transform',
 *     'Connection': 'keep-alive',
 *     'X-Accel-Buffering': 'no',
 *   },
 * });
 * ```
 */

import { subscribeToTenant, publishEvent, type RealtimeEvent } from './pubsub';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Connection tracking
// ---------------------------------------------------------------------------

interface SSEConnection {
  tenantId: string;
  userId: string;
  connectedAt: number;
}

/** Active SSE connections — keyed by a unique connection ID. */
const activeConnections = new Map<string, SSEConnection>();
let connectionCounter = 0;

/**
 * Get the count of active SSE connections for a given tenant.
 * Useful for monitoring dashboards.
 */
export function getActiveConnectionCount(tenantId?: string): number {
  if (!tenantId) return activeConnections.size;
  let count = 0;
  for (const conn of activeConnections.values()) {
    if (conn.tenantId === tenantId) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// SSE Stream Factory
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 30_000;

export interface CreateSSEStreamOptions {
  /** Tenant to subscribe to */
  tenantId: string;
  /** Authenticated user ID (for tracking) */
  userId: string;
  /** AbortSignal from the incoming request — triggers cleanup on disconnect */
  signal: AbortSignal;
  /** Optional filter: only forward events whose `type` is in this list */
  eventTypes?: string[];
}

/**
 * Create a ReadableStream that emits Server-Sent Events for the given tenant.
 *
 * The stream:
 * 1. Sends a CONNECTED event immediately
 * 2. Forwards all (optionally filtered) events from the Pub/Sub layer
 * 3. Sends a HEARTBEAT every 30 seconds
 * 4. Cleans up (unsubscribes, removes from tracking) when the client disconnects
 */
export function createSSEStream(opts: CreateSSEStreamOptions): ReadableStream {
  const { tenantId, userId, signal, eventTypes } = opts;
  const encoder = new TextEncoder();
  const connId = `sse_${++connectionCounter}_${Date.now()}`;

  // Build an event type filter set for O(1) lookups
  const typeFilter = eventTypes && eventTypes.length > 0
    ? new Set(eventTypes.map((t) => t.toUpperCase()))
    : null;

  return new ReadableStream({
    start(controller) {
      // Track connection
      activeConnections.set(connId, { tenantId, userId, connectedAt: Date.now() });
      logger.debug('SSE connection opened', { category: 'system', tenantId, userId, connId });

      // -- Helper: safely enqueue data --
      function enqueue(data: string): boolean {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          return true;
        } catch {
          // Stream closed
          return false;
        }
      }

      // -- Initial CONNECTED event --
      enqueue(JSON.stringify({ type: 'CONNECTED', tenantId, connId }));

      // -- Subscribe to tenant events --
      const unsubscribe = subscribeToTenant(tenantId, (event: RealtimeEvent) => {
        // Apply type filter
        if (typeFilter && !typeFilter.has(event.type.toUpperCase())) return;

        enqueue(JSON.stringify(event));
      });

      // -- Heartbeat --
      const heartbeat = setInterval(() => {
        const ok = enqueue(JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() }));
        if (!ok) {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // -- Cleanup on abort (client disconnect) --
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        activeConnections.delete(connId);
        logger.debug('SSE connection closed', { category: 'system', tenantId, userId, connId });
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      if (signal.aborted) {
        cleanup();
      } else {
        signal.addEventListener('abort', cleanup, { once: true });
      }
    },

    cancel() {
      // Called if the consumer cancels the stream
      activeConnections.delete(connId);
    },
  });
}

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

/**
 * Broadcast a real-time event to all SSE clients connected for a tenant.
 *
 * This is a convenience wrapper around `publishEvent` — it ensures the
 * event has a timestamp and publishes it through the Pub/Sub layer so all
 * server instances (and their SSE streams) receive it.
 */
export async function broadcastToTenant(
  tenantId: string,
  event: Omit<RealtimeEvent, 'tenantId' | 'timestamp'> & { timestamp?: number },
): Promise<void> {
  await publishEvent({
    ...event,
    tenantId,
    timestamp: event.timestamp ?? Date.now(),
  });
}
