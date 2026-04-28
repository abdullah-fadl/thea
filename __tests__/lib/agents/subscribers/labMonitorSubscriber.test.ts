/**
 * Phase 8.3 — labMonitorSubscriber tests (3 cases)
 *
 *  1. Both flags OFF → registerLabMonitorSubscriber() does NOT call subscribe()
 *  2. Both flags ON → registerLabMonitorSubscriber() registers a handler
 *     for lab.result.posted@v1
 *  3. Both flags ON → on event the handler reads the event row by id,
 *     extracts labResultId from the payload, and calls runAgent() with
 *     the matching tenantId
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted mocks (must precede module imports) ─────────────────────────────

const mockSubscribe = vi.fn();
vi.mock('@/lib/events/subscribe', () => ({
  subscribe: (...a: unknown[]) => mockSubscribe(...a),
}));

const mockRunAgent = vi.fn().mockResolvedValue({ id: 'r-1', status: 'success' });
vi.mock('@/lib/agents/framework/run', () => ({
  runAgent: (...a: unknown[]) => mockRunAgent(...a),
}));

const mockEventRecordFindUnique = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    eventRecord: { findUnique: (...a: unknown[]) => mockEventRecordFindUnique(...a) },
  },
}));

import {
  registerLabMonitorSubscriber,
  _resetLabMonitorSubscriberForTest,
} from '@/lib/agents/subscribers/labMonitorSubscriber';

function enableAgents()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED]   = 'true'; }
function disableAgents() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }
function enableBus()     { process.env[FLAGS.FF_EVENT_BUS_ENABLED]   = 'true'; }
function disableBus()    { delete process.env[FLAGS.FF_EVENT_BUS_ENABLED]; }

const TENANT = '11111111-2222-4333-8444-555555555555';
const LAB_RESULT_ID = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440099';

describe('labMonitorSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLabMonitorSubscriberForTest();
    disableAgents();
    disableBus();
  });

  afterEach(() => {
    _resetLabMonitorSubscriberForTest();
    disableAgents();
    disableBus();
  });

  it('1. both flags OFF — registerLabMonitorSubscriber() does NOT call subscribe()', () => {
    registerLabMonitorSubscriber();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('1b. agents ON, bus OFF — still does NOT call subscribe() (both required)', () => {
    enableAgents();
    registerLabMonitorSubscriber();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('2. both flags ON — subscribe() registered for lab.result.posted@v1', () => {
    enableAgents();
    enableBus();
    registerLabMonitorSubscriber();
    expect(mockSubscribe).toHaveBeenCalledOnce();
    const [spec] = mockSubscribe.mock.calls[0] as [
      { eventName: string; version: number; handler: unknown },
    ];
    expect(spec.eventName).toBe('lab.result.posted');
    expect(spec.version).toBe(1);
    expect(typeof spec.handler).toBe('function');
  });

  it('3. on event — handler resolves payload.labResultId and runs the agent', async () => {
    enableAgents();
    enableBus();
    registerLabMonitorSubscriber();
    const [spec] = mockSubscribe.mock.calls[0] as [
      {
        handler: (
          envelope: { id: string; tenantId: string; eventName: string; version: number },
          callbacks: { ack: () => void; nack: (r?: string) => void },
        ) => Promise<void>;
      },
    ];

    mockEventRecordFindUnique.mockResolvedValueOnce({
      tenantId: TENANT,
      aggregateId: LAB_RESULT_ID,
      payload: { labResultId: LAB_RESULT_ID },
    });

    const ack = vi.fn();
    const nack = vi.fn();
    await spec.handler(
      {
        id: EVENT_ID,
        eventName: 'lab.result.posted',
        version: 1,
        tenantId: TENANT,
      },
      { ack, nack },
    );

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentKey: 'clinical.lab-monitor.v1',
        input: { labResultId: LAB_RESULT_ID },
        tenantId: TENANT,
      }),
    );
    expect(ack).toHaveBeenCalledOnce();
    expect(nack).not.toHaveBeenCalled();
  });
});
