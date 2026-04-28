/**
 * Phase 4.2 — subscribe() + startEventBus() tests
 *
 * Cases:
 *  1.  subscribe() registers handler even when FF_EVENT_BUS_ENABLED is OFF
 *  2.  subscribe() for the same event accumulates multiple handlers
 *  3.  startEventBus() is a no-op (returns without connecting) when flag is OFF
 *  4.  startEventBus() opens pg LISTEN when flag is ON
 *  5.  handler is dispatched when NOTIFY arrives and flag is ON
 *  6.  ack() clears the timeout and logs info (no warn emitted)
 *  7.  nack() clears the timeout and logs warn with reason
 *  8.  handler that throws does not crash the bus (error is logged, not rethrown)
 *  9.  stopEventBus() disconnects the client and resets started state
 * 10.  startEventBus() with missing DATABASE_URL throws descriptively
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted mock logger ──────────────────────────────────────────────────────

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_EVENT_BUS_ENABLED] = 'true';  }
function setFlagOff() { delete process.env[FLAGS.FF_EVENT_BUS_ENABLED];    }

// Valid RFC-4122 UUIDs (version 4, variant 10xx)
const TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const EVENT_ID  = '550e8400-e29b-41d4-a716-446655440001';

function makeNotifyPayload(overrides?: Partial<{
  id: string; eventName: string; version: number; tenantId: string
}>): string {
  return JSON.stringify({
    id: EVENT_ID,
    eventName: 'template.entity.created',
    version: 1,
    tenantId: TENANT_ID,
    ...overrides,
  });
}

// ─── Mock pg client factory helpers ──────────────────────────────────────────

function makeMockPgClient() {
  const notificationListeners: Array<(msg: { channel: string; payload?: string }) => void> = [];
  const errorListeners: Array<(err: Error) => void> = [];

  const client = {
    connect:  vi.fn().mockResolvedValue(undefined),
    query:    vi.fn().mockResolvedValue(undefined),
    end:      vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'notification') notificationListeners.push(handler as (msg: { channel: string; payload?: string }) => void);
      if (event === 'error') errorListeners.push(handler as (err: Error) => void);
      return client;
    }),
    _emit: (msg: { channel: string; payload?: string }) => {
      for (const l of notificationListeners) l(msg);
    },
  };
  return client;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('subscribe() + startEventBus()', () => {
  let mockClient: ReturnType<typeof makeMockPgClient>;

  beforeEach(async () => {
    setFlagOff();
    Object.values(mockLogger).forEach((m) => (m as ReturnType<typeof vi.fn>).mockClear());
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';

    // Reset module state between tests without resetting the whole module cache
    const mod = await import('@/lib/events/subscribe');
    await mod.stopEventBus().catch(() => {});
    mod._resetSubscriptions();
    mod._resetPgClientFactory();

    mockClient = makeMockPgClient();
    mod._injectPgClientFactory(() => mockClient);
  });

  afterEach(async () => {
    setFlagOff();
    const mod = await import('@/lib/events/subscribe');
    await mod.stopEventBus().catch(() => {});
    mod._resetPgClientFactory();
    delete process.env.DATABASE_URL;
  });

  it('subscribe() registers handler even when flag is OFF', async () => {
    const { subscribe, _getHandlers } = await import('@/lib/events/subscribe');
    const handler = vi.fn();
    subscribe({ eventName: 'template.entity.created', version: 1, handler });
    expect(_getHandlers('template.entity.created', 1)).toHaveLength(1);
  });

  it('subscribe() accumulates multiple handlers for the same event', async () => {
    const { subscribe, _getHandlers } = await import('@/lib/events/subscribe');
    subscribe({ eventName: 'template.entity.created', version: 1, handler: vi.fn() });
    subscribe({ eventName: 'template.entity.created', version: 1, handler: vi.fn() });
    expect(_getHandlers('template.entity.created', 1)).toHaveLength(2);
  });

  it('startEventBus() is a no-op when flag is OFF', async () => {
    const { startEventBus } = await import('@/lib/events/subscribe');
    await startEventBus();
    expect(mockClient.connect).not.toHaveBeenCalled();
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('startEventBus() connects and LISTENs when flag is ON', async () => {
    setFlagOn();
    const { startEventBus } = await import('@/lib/events/subscribe');
    await startEventBus();
    expect(mockClient.connect).toHaveBeenCalledOnce();
    expect(mockClient.query).toHaveBeenCalledWith('LISTEN thea_events');
  });

  it('dispatches handler when NOTIFY arrives on the correct channel', async () => {
    setFlagOn();
    const { subscribe, startEventBus } = await import('@/lib/events/subscribe');
    const handler = vi.fn().mockImplementation(async (_event: unknown, { ack }: { ack: () => void }) => { ack(); });
    subscribe({ eventName: 'template.entity.created', version: 1, handler });

    await startEventBus();
    mockClient._emit({ channel: 'thea_events', payload: makeNotifyPayload() });

    await new Promise((r) => setTimeout(r, 20));
    expect(handler).toHaveBeenCalledOnce();
    const [envelope] = (handler.mock.calls[0] as [{ eventName: string; tenantId: string }]);
    expect(envelope.eventName).toBe('template.entity.created');
    expect(envelope.tenantId).toBe(TENANT_ID);
  });

  it('ack() logs info and clears the timeout warning', async () => {
    setFlagOn();
    const { subscribe, startEventBus } = await import('@/lib/events/subscribe');
    subscribe({
      eventName: 'template.entity.created',
      version: 1,
      handler: async (_event, { ack }) => { ack(); },
    });

    await startEventBus();
    mockClient._emit({ channel: 'thea_events', payload: makeNotifyPayload() });
    await new Promise((r) => setTimeout(r, 20));

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Event handler ack',
      expect.objectContaining({ category: 'events.ack', eventId: EVENT_ID }),
    );
    const warnCalls = (mockLogger.warn.mock.calls as unknown[][]);
    const timeoutWarn = warnCalls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('ack()'),
    );
    expect(timeoutWarn).toBeUndefined();
  });

  it('nack() logs warn with reason', async () => {
    setFlagOn();
    const { subscribe, startEventBus } = await import('@/lib/events/subscribe');
    subscribe({
      eventName: 'template.entity.created',
      version: 1,
      handler: async (_event, { nack }) => { nack('idempotency check failed'); },
    });

    await startEventBus();
    mockClient._emit({ channel: 'thea_events', payload: makeNotifyPayload() });
    await new Promise((r) => setTimeout(r, 20));

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Event handler nack',
      expect.objectContaining({ reason: 'idempotency check failed' }),
    );
  });

  it('handler that throws does not crash the bus — error is logged', async () => {
    setFlagOn();
    const { subscribe, startEventBus } = await import('@/lib/events/subscribe');
    subscribe({
      eventName: 'template.entity.created',
      version: 1,
      handler: async () => { throw new Error('handler exploded'); },
    });

    await startEventBus();
    mockClient._emit({ channel: 'thea_events', payload: makeNotifyPayload() });
    await new Promise((r) => setTimeout(r, 20));

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Event handler threw unhandled error',
      expect.objectContaining({ error: 'handler exploded' }),
    );
  });

  it('stopEventBus() disconnects the client and allows restart', async () => {
    setFlagOn();
    const { startEventBus, stopEventBus } = await import('@/lib/events/subscribe');
    await startEventBus();
    expect(mockClient.connect).toHaveBeenCalledOnce();

    await stopEventBus();
    expect(mockClient.end).toHaveBeenCalledOnce();

    // After stop, a new start should connect again
    const mockClient2 = makeMockPgClient();
    const mod = await import('@/lib/events/subscribe');
    mod._injectPgClientFactory(() => mockClient2);
    await startEventBus();
    expect(mockClient2.connect).toHaveBeenCalledOnce();
  });

  it('startEventBus() throws when DATABASE_URL is not set', async () => {
    setFlagOn();
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    const { startEventBus } = await import('@/lib/events/subscribe');
    await expect(startEventBus()).rejects.toThrow('DATABASE_URL');
  });
});
