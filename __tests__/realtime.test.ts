/**
 * 15 Real-time SSE + Pub/Sub Tests
 *
 * Structural validation of the real-time event infrastructure via source
 * file inspection. Verifies the Redis Pub/Sub layer, SSE connection
 * manager, OPD event bus adapter, and SSE API route wiring.
 *
 * Categories:
 *   RT-01..RT-04  Pub/Sub (exports, RealtimeEvent, channel naming, Redis fallback)
 *   RT-05..RT-08  SSE Manager (exports, heartbeat, CONNECTED, type filter, connection tracking)
 *   RT-09..RT-11  OPD Event Bus (wraps pubsub, event types, singleton)
 *   RT-12..RT-13  Global SSE endpoint (?types= param, withAuthTenant)
 *   RT-14..RT-15  OPD SSE endpoint (OPD-specific types, permission keys)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Pub/Sub Layer (RT-01..RT-04)
// ─────────────────────────────────────────────────────────────────────────────
describe('Realtime — Pub/Sub Layer', () => {
  const pubsubSrc = readSource('lib/realtime/pubsub.ts');

  // RT-01: pubsub exports publishEvent, subscribeToTenant, unsubscribeAll
  it('RT-01: pubsub.ts exports publishEvent, subscribeToTenant, and unsubscribeAll', () => {
    expect(pubsubSrc).toContain('export async function publishEvent(event: RealtimeEvent)');
    expect(pubsubSrc).toContain('export function subscribeToTenant(');
    expect(pubsubSrc).toContain('export function unsubscribeAll()');
  });

  // RT-02: RealtimeEvent interface has type, tenantId, payload, timestamp
  it('RT-02: RealtimeEvent interface has type, tenantId, payload, and timestamp fields', () => {
    expect(pubsubSrc).toContain('export interface RealtimeEvent');
    expect(pubsubSrc).toContain('type: string');
    expect(pubsubSrc).toContain('tenantId: string');
    expect(pubsubSrc).toContain("payload: Record<string, any>");
    expect(pubsubSrc).toContain('timestamp: number');
  });

  // RT-03: Channel naming follows thea:events:${tenantId} pattern
  it('RT-03: channel naming uses thea:events:${tenantId} pattern', () => {
    expect(pubsubSrc).toContain("const CHANNEL_PREFIX = 'thea:events:'");
    expect(pubsubSrc).toContain('`${CHANNEL_PREFIX}${tenantId}`');
  });

  // RT-04: Redis fallback — uses in-memory EventEmitter when Redis unavailable
  it('RT-04: pubsub falls back to in-memory EventEmitter when Redis is unavailable', () => {
    expect(pubsubSrc).toContain("import { EventEmitter } from 'events'");
    expect(pubsubSrc).toContain('const localEmitter = new EventEmitter()');
    expect(pubsubSrc).toContain('localEmitter.setMaxListeners(500)');
    // Redis publish fallback
    expect(pubsubSrc).toContain('Redis publish failed, falling back to local emit');
    expect(pubsubSrc).toContain('localEmitter.emit(channel, event)');
    // Reference counting for Redis subscriptions
    expect(pubsubSrc).toContain('const channelRefCount = new Map<string, number>()');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: SSE Manager (RT-05..RT-08)
// ─────────────────────────────────────────────────────────────────────────────
describe('Realtime — SSE Manager', () => {
  const sseSrc = readSource('lib/realtime/sseManager.ts');

  // RT-05: SSE manager exports createSSEStream, broadcastToTenant, getActiveConnectionCount
  it('RT-05: sseManager exports createSSEStream, broadcastToTenant, and getActiveConnectionCount', () => {
    expect(sseSrc).toContain('export function createSSEStream(opts: CreateSSEStreamOptions)');
    expect(sseSrc).toContain('export async function broadcastToTenant(');
    expect(sseSrc).toContain('export function getActiveConnectionCount(');
  });

  // RT-06: SSE heartbeat interval is 30 seconds
  it('RT-06: SSE heartbeat interval is 30 seconds (30_000 ms)', () => {
    expect(sseSrc).toContain('const HEARTBEAT_INTERVAL_MS = 30_000');
    expect(sseSrc).toContain("JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() })");
    expect(sseSrc).toContain('setInterval(');
    expect(sseSrc).toContain('HEARTBEAT_INTERVAL_MS');
  });

  // RT-07: SSE sends CONNECTED event on connection and uses type filter with Set
  it('RT-07: SSE sends CONNECTED event on new connections and uses Set for type filtering', () => {
    // CONNECTED event
    expect(sseSrc).toContain("JSON.stringify({ type: 'CONNECTED', tenantId, connId })");
    // Type filter using Set for O(1) lookups
    expect(sseSrc).toContain('new Set(eventTypes.map((t) => t.toUpperCase())');
    expect(sseSrc).toContain('typeFilter && !typeFilter.has(event.type.toUpperCase())');
  });

  // RT-08: Connection tracking with Map and cleanup on abort
  it('RT-08: SSE tracks active connections with Map and cleans up on AbortSignal', () => {
    expect(sseSrc).toContain("const activeConnections = new Map<string, SSEConnection>()");
    expect(sseSrc).toContain('activeConnections.set(connId,');
    expect(sseSrc).toContain('activeConnections.delete(connId)');
    // AbortSignal cleanup
    expect(sseSrc).toContain("signal.addEventListener('abort', cleanup, { once: true })");
    expect(sseSrc).toContain('if (signal.aborted)');
    // Cleanup unsubscribes from pubsub
    expect(sseSrc).toContain('unsubscribe()');
    expect(sseSrc).toContain('clearInterval(heartbeat)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: OPD Event Bus (RT-09..RT-11)
// ─────────────────────────────────────────────────────────────────────────────
describe('Realtime — OPD Event Bus', () => {
  const eventBusSrc = readSource('lib/opd/eventBus.ts');

  // RT-09: OPD event bus wraps pubsub publishEvent
  it('RT-09: OPD event bus imports and wraps publishEvent from realtime/pubsub', () => {
    expect(eventBusSrc).toContain("import { publishEvent, subscribeToTenant, type RealtimeEvent } from '@/lib/realtime/pubsub'");
    expect(eventBusSrc).toContain('publishEvent({');
    expect(eventBusSrc).toContain('subscribeToTenant(tenantId,');
  });

  // RT-10: OPD event types include FLOW_STATE_CHANGE, NEW_PATIENT, VITALS_SAVED
  it('RT-10: OpdEvent type union includes FLOW_STATE_CHANGE, NEW_PATIENT, VITALS_SAVED', () => {
    expect(eventBusSrc).toContain("'FLOW_STATE_CHANGE' | 'NEW_PATIENT' | 'VITALS_SAVED'");
    expect(eventBusSrc).toContain('export interface OpdEvent');
    expect(eventBusSrc).toContain('encounterCoreId: string');
    expect(eventBusSrc).toContain('tenantId: string');
  });

  // RT-11: OPD event bus exports singleton instance
  it('RT-11: OPD event bus exports a singleton opdEventBus instance', () => {
    expect(eventBusSrc).toContain('class OpdEventBus');
    expect(eventBusSrc).toContain('export const opdEventBus = new OpdEventBus()');
    // Has subscribe and emit methods
    expect(eventBusSrc).toContain('subscribe(tenantId: string, listener: Listener)');
    expect(eventBusSrc).toContain('emit(event: OpdEvent)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Global SSE Endpoint (RT-12..RT-13)
// ─────────────────────────────────────────────────────────────────────────────
describe('Realtime — Global SSE Endpoint', () => {
  const routeSrc = readSource('app/api/events/stream/route.ts');

  // RT-12: Global SSE endpoint supports ?types= query param for filtering
  it('RT-12: global SSE endpoint parses ?types= query param to filter event types', () => {
    expect(routeSrc).toContain("req.nextUrl.searchParams.get('types')");
    expect(routeSrc).toContain("typesParam.split(',')");
    expect(routeSrc).toContain('eventTypes');
    expect(routeSrc).toContain('createSSEStream');
  });

  // RT-13: Global SSE endpoint uses withAuthTenant and proper SSE headers
  it('RT-13: global SSE endpoint uses withAuthTenant and returns SSE response headers', () => {
    expect(routeSrc).toContain("import { withAuthTenant } from '@/lib/core/guards/withAuthTenant'");
    expect(routeSrc).toContain('export const GET = withAuthTenant(');
    expect(routeSrc).toContain("'Content-Type': 'text/event-stream'");
    expect(routeSrc).toContain("'Cache-Control': 'no-cache, no-transform'");
    expect(routeSrc).toContain("'X-Accel-Buffering': 'no'");
    expect(routeSrc).toContain("export const dynamic = 'force-dynamic'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: OPD SSE Endpoint (RT-14..RT-15)
// ─────────────────────────────────────────────────────────────────────────────
describe('Realtime — OPD SSE Endpoint', () => {
  const routeSrc = readSource('app/api/opd/events/stream/route.ts');

  // RT-14: OPD SSE endpoint filters to OPD-specific event types
  it('RT-14: OPD SSE endpoint hardcodes FLOW_STATE_CHANGE, NEW_PATIENT, VITALS_SAVED event types', () => {
    expect(routeSrc).toContain("'FLOW_STATE_CHANGE'");
    expect(routeSrc).toContain("'NEW_PATIENT'");
    expect(routeSrc).toContain("'VITALS_SAVED'");
    expect(routeSrc).toContain('createSSEStream');
    expect(routeSrc).toContain('eventTypes:');
  });

  // RT-15: OPD SSE endpoint requires OPD-specific permissions
  it('RT-15: OPD SSE endpoint requires OPD permission keys', () => {
    expect(routeSrc).toContain('withAuthTenant');
    expect(routeSrc).toContain("'text/event-stream'");
    expect(routeSrc).toContain("platformKey: 'thea_health'");
    // OPD-specific permission keys
    expect(routeSrc).toContain("'opd.queue.view'");
  });
});
