import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';

// =============================================================================
// Subscribe API — in-memory subscriber registry + LISTEN/NOTIFY loop
//
// Design decisions (documented here for audit purposes):
//
// 1. Subscribers are registered in _subscriptions at call time, regardless of
//    whether FF_EVENT_BUS_ENABLED is ON or OFF.  This lets platforms declare
//    their handlers at module-load time without worrying about flag state.
//
// 2. startEventBus() opens a dedicated pg.Client for LISTEN.  Prisma's
//    connection pool cannot hold LISTEN state (pgbouncer drops it on
//    connection hand-back).  The dedicated client is created once and lives
//    for the process lifetime.
//
// 3. startEventBus() MUST be called explicitly from a background worker
//    process, NOT from the Next.js web request path.  See NOTES.md §Deployment
//    for the recommended integration point.
//
// 4. ack/nack write-back: in this sub-phase ack() and nack() log to the
//    structured logger (category 'events.ack' / 'events.nack').  A
//    consumer-state side table (event_consumer_state) is deferred to Phase 4.3
//    once we have real platform subscribers that need durable delivery tracking.
//
// 5. If ack() is not called within ACK_TIMEOUT_MS (default 30 s), a warning
//    is emitted.  The event is NOT lost — it remains in the events table.
// =============================================================================

const ACK_TIMEOUT_MS = parseInt(
  process.env.THEA_EVENT_ACK_TIMEOUT_MS ?? '30000',
  10,
);

export interface EventEnvelope {
  id: string;
  eventName: string;
  version: number;
  tenantId: string;
}

export interface AckNack {
  ack: () => void;
  nack: (reason?: string) => void;
}

export type EventHandler = (
  event: EventEnvelope,
  callbacks: AckNack,
) => Promise<void>;

export interface SubscribeSpec {
  eventName: string;
  version: number;
  handler: EventHandler;
}

// keyed by `${eventName}@v${version}`
const _subscriptions = new Map<string, EventHandler[]>();

/**
 * Register a handler for a versioned event type.
 * Safe to call at module-load time; works whether or not the flag is ON.
 * Calling subscribe() does NOT start the LISTEN loop — call startEventBus() for that.
 */
export function subscribe(spec: SubscribeSpec): void {
  const k = `${spec.eventName}@v${spec.version}`;
  const handlers = _subscriptions.get(k) ?? [];
  handlers.push(spec.handler);
  _subscriptions.set(k, handlers);
}

/** Returns handlers registered for a given event type. Used in tests. */
export function _getHandlers(eventName: string, version: number): EventHandler[] {
  return _subscriptions.get(`${eventName}@v${version}`) ?? [];
}

/** Clears all subscriptions. Only for tests — do NOT call in production. */
export function _resetSubscriptions(): void {
  _subscriptions.clear();
}

// ─── LISTEN loop ─────────────────────────────────────────────────────────────

// Minimal pg.Client interface — avoids requiring @types/pg as a direct dep.
// The underlying implementation is provided by `pg` (transitive via @prisma/adapter-pg).
interface PgNotification {
  channel: string;
  payload?: string;
}

interface PgClientLike {
  connect(): Promise<void>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
  on(event: 'notification', handler: (msg: PgNotification) => void): this;
  on(event: 'error', handler: (err: Error) => void): this;
}

let _busClient: PgClientLike | null = null;
let _busStarted = false;

// Injectable factory used by tests to avoid a real pg.Client connection.
// Production code never calls _injectPgClientFactory — it uses the default require('pg').
let _clientFactory: ((connString: string) => PgClientLike) | null = null;

/** @internal — test use only */
export function _injectPgClientFactory(
  factory: (connString: string) => PgClientLike,
): void {
  _clientFactory = factory;
}

/** @internal — test use only */
export function _resetPgClientFactory(): void {
  _clientFactory = null;
}

/**
 * Start the LISTEN/NOTIFY event bus.
 *
 * Call this ONCE from a long-running background worker process, NOT from
 * the Next.js request path.  It is safe to call multiple times — subsequent
 * calls are no-ops.
 *
 * When FF_EVENT_BUS_ENABLED is OFF, this function returns immediately without
 * opening any DB connection or registering any LISTEN channel.
 */
export async function startEventBus(): Promise<void> {
  if (!isEnabled('FF_EVENT_BUS_ENABLED')) {
    logger.info('startEventBus: FF_EVENT_BUS_ENABLED is OFF — skipping LISTEN loop', {
      category: 'events.bus',
    });
    return;
  }

  if (_busStarted) return;
  _busStarted = true;

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('[events] startEventBus: DATABASE_URL / DIRECT_URL is not set');
  }

  let client: PgClientLike;
  if (_clientFactory) {
    client = _clientFactory(connectionString);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => PgClientLike };
    client = new Client({ connectionString });
  }
  _busClient = client;

  client.on('error', (err) => {
    logger.error('LISTEN client error', { category: 'events.bus', error: err.message });
  });

  await client.connect();
  await client.query("LISTEN thea_events");

  logger.info('Event bus started — LISTEN thea_events', { category: 'events.bus' });

  client.on('notification', (msg) => {
    if (msg.channel !== 'thea_events' || !msg.payload) return;
    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(msg.payload) as EventEnvelope;
    } catch {
      logger.warn('Event bus: malformed NOTIFY payload', {
        category: 'events.bus',
        raw: msg.payload,
      });
      return;
    }
    void _dispatch(envelope);
  });
}

/**
 * Stop the LISTEN loop (used in tests and graceful shutdown).
 * Production code should handle SIGTERM and call this before exiting.
 */
export async function stopEventBus(): Promise<void> {
  if (_busClient) {
    await _busClient.end().catch(() => {});
    _busClient = null;
  }
  _busStarted = false;
}

async function _dispatch(envelope: EventEnvelope): Promise<void> {
  const k = `${envelope.eventName}@v${envelope.version}`;
  const handlers = _subscriptions.get(k);
  if (!handlers || handlers.length === 0) return;

  for (const handler of handlers) {
    let ackCalled = false;

    const ackTimeout = setTimeout(() => {
      if (!ackCalled) {
        logger.warn('Event handler did not call ack() within timeout', {
          category: 'events.ack',
          eventId: envelope.id,
          eventName: envelope.eventName,
          version: envelope.version,
          timeoutMs: ACK_TIMEOUT_MS,
        });
      }
    }, ACK_TIMEOUT_MS);

    const ack = (): void => {
      ackCalled = true;
      clearTimeout(ackTimeout);
      logger.info('Event handler ack', {
        category: 'events.ack',
        eventId: envelope.id,
        eventName: envelope.eventName,
        version: envelope.version,
      });
    };

    const nack = (reason?: string): void => {
      ackCalled = true;
      clearTimeout(ackTimeout);
      logger.warn('Event handler nack', {
        category: 'events.nack',
        eventId: envelope.id,
        eventName: envelope.eventName,
        version: envelope.version,
        reason,
      });
    };

    try {
      await handler(envelope, { ack, nack });
    } catch (err) {
      clearTimeout(ackTimeout);
      logger.error('Event handler threw unhandled error', {
        category: 'events.bus',
        eventId: envelope.id,
        eventName: envelope.eventName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
