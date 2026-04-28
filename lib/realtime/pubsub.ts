/**
 * Redis Pub/Sub — Real-time Event Infrastructure for Thea EHR
 *
 * Provides a publish/subscribe layer that works across multiple server
 * instances when Redis is available, and falls back to an in-memory
 * EventEmitter when it is not.
 *
 * Channel naming:  `thea:events:${tenantId}`
 *
 * Usage (publish — from any API route):
 * ```ts
 * import { publishEvent } from '@/lib/realtime/pubsub';
 *
 * await publishEvent({
 *   type: 'FLOW_STATE_CHANGE',
 *   tenantId,
 *   payload: { encounterCoreId, previousState, newState },
 *   timestamp: Date.now(),
 * });
 * ```
 *
 * Usage (subscribe — from SSE manager):
 * ```ts
 * import { subscribeToTenant } from '@/lib/realtime/pubsub';
 *
 * const unsub = subscribeToTenant(tenantId, (event) => {
 *   // push to SSE stream
 * });
 * // later: unsub();
 * ```
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { getRedis } from '@/lib/security/redis';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealtimeEvent {
  /** Event type — e.g. FLOW_STATE_CHANGE, NEW_PATIENT, VITALS_SAVED, ORDER_PLACED */
  type: string;
  /** Tenant scope */
  tenantId: string;
  /** Arbitrary payload (must be JSON-serialisable) */
  payload: Record<string, any>;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

export type RealtimeEventCallback = (event: RealtimeEvent) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_PREFIX = 'thea:events:';

function channelFor(tenantId: string): string {
  return `${CHANNEL_PREFIX}${tenantId}`;
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const localEmitter = new EventEmitter();
localEmitter.setMaxListeners(500); // Allow many SSE connections in single-instance mode

// ---------------------------------------------------------------------------
// Redis subscriber management
// ---------------------------------------------------------------------------

/**
 * Dedicated Redis subscriber connection.
 *
 * ioredis requires a separate connection for subscriptions because a client
 * in "subscriber mode" cannot issue regular commands. We create this lazily
 * and reuse it for all tenant subscriptions.
 */
let _subscriber: Redis | null = null;
let _subscriberFailed = false;
let _subscriberInitialising = false;

/** Track per-channel listener count so we can UNSUBSCRIBE when it hits 0. */
const channelRefCount = new Map<string, number>();

function getSubscriber(): Redis | null {
  if (_subscriberFailed) return null;
  if (_subscriber) return _subscriber;
  if (_subscriberInitialising) return null;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  _subscriberInitialising = true;

  try {
    _subscriber = new Redis(url, {
      maxRetriesPerRequest: null, // subscriber must not time out
      enableReadyCheck: false,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 5) {
          _subscriberFailed = true;
          logger.warn('PubSub subscriber: max retries exceeded, falling back to in-memory', { category: 'system' });
          return null;
        }
        return Math.min(times * 500, 3000);
      },
      lazyConnect: false,
    });

    _subscriber.on('error', (err) => {
      logger.error('PubSub subscriber connection error', { category: 'system', error: err });
    });

    _subscriber.on('close', () => {
      _subscriber = null;
      _subscriberInitialising = false;
    });

    // Forward received messages to local EventEmitter so SSE handlers pick them up
    _subscriber.on('message', (channel: string, message: string) => {
      try {
        const event: RealtimeEvent = JSON.parse(message);
        localEmitter.emit(channel, event);
      } catch (err) {
        logger.warn('PubSub: failed to parse message', { category: 'system', channel, error: err });
      }
    });

    _subscriberInitialising = false;
    logger.info('PubSub subscriber connected', { category: 'system' });
    return _subscriber;
  } catch {
    _subscriberFailed = true;
    _subscriberInitialising = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Publish a real-time event to all subscribers for the given tenant.
 *
 * - If Redis is available → publishes via Redis Pub/Sub (cross-instance).
 * - Otherwise → emits on the local EventEmitter (single-instance only).
 */
export async function publishEvent(event: RealtimeEvent): Promise<void> {
  const channel = channelFor(event.tenantId);
  const serialised = JSON.stringify(event);

  // Try Redis first
  const publisher = getRedis();
  if (publisher) {
    try {
      await publisher.publish(channel, serialised);
      return;
    } catch (err) {
      logger.warn('PubSub: Redis publish failed, falling back to local emit', { category: 'system', error: err });
    }
  }

  // Fallback: local-only
  localEmitter.emit(channel, event);
}

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

/**
 * Subscribe to all events for a specific tenant.
 *
 * Returns an unsubscribe function. The caller MUST invoke it when the SSE
 * connection closes to avoid memory leaks.
 *
 * Under the hood:
 * 1. Registers a listener on the local EventEmitter (always).
 * 2. If Redis is available, subscribes the shared subscriber to the tenant
 *    channel (only on the first subscription for that channel).
 *
 * When the last listener for a channel unsubscribes, we UNSUBSCRIBE from
 * Redis to keep things tidy.
 */
export function subscribeToTenant(
  tenantId: string,
  callback: RealtimeEventCallback,
): () => void {
  const channel = channelFor(tenantId);

  // Always listen locally — Redis messages are forwarded here
  localEmitter.on(channel, callback);

  // Redis subscribe (ref-counted)
  const sub = getSubscriber();
  const currentCount = channelRefCount.get(channel) || 0;
  channelRefCount.set(channel, currentCount + 1);

  if (sub && currentCount === 0) {
    sub.subscribe(channel).catch((err) => {
      logger.warn('PubSub: Redis subscribe failed', { category: 'system', channel, error: err });
    });
  }

  // Return unsubscribe function
  return () => {
    localEmitter.removeListener(channel, callback);

    const count = (channelRefCount.get(channel) || 1) - 1;
    if (count <= 0) {
      channelRefCount.delete(channel);
      const s = getSubscriber();
      if (s) {
        s.unsubscribe(channel).catch(() => {});
      }
    } else {
      channelRefCount.set(channel, count);
    }
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Unsubscribe from ALL channels and close the subscriber connection.
 * Called during graceful shutdown.
 */
export function unsubscribeAll(): void {
  // Remove all local listeners for our channels
  for (const channel of channelRefCount.keys()) {
    localEmitter.removeAllListeners(channel);
  }
  channelRefCount.clear();

  // Close Redis subscriber
  if (_subscriber) {
    try {
      _subscriber.disconnect();
    } catch {}
    _subscriber = null;
  }
}
