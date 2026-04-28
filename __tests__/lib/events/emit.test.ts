/**
 * Phase 4.2 — emit() tests
 *
 * Cases:
 *  1.  Flag OFF  → returns { skipped: true }, zero DB calls, zero NOTIFY
 *  2.  Flag ON  + unregistered eventName → throws EventNotRegistered, no DB call
 *  3.  Flag ON  + registered + valid payload → inserts row, returns { id, sequence }
 *  4.  Flag ON  + registered + invalid payload (schema mismatch) → throws ZodError, no row written
 *  5.  Flag ON  + NOTIFY failure → does NOT propagate the error (emit still succeeds)
 *  6.  Flag ON  + caller-provided prisma client is used instead of default
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { FLAGS } from '@/lib/core/flags';
import { EventNotRegistered } from '@/lib/events/registry';

// ─── Test UUIDs ──────────────────────────────────────────────────────────────

// Valid RFC-4122 UUIDs (version 4, variant 10xx) — required by Zod v4's uuid() validator
const TENANT_ID     = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const AGGREGATE_ID  = '550e8400-e29b-41d4-a716-446655440000';
const RECORD_ID     = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const SEQUENCE      = BigInt(42);

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockCreate, mockExecuteRaw } = vi.hoisted(() => ({
  mockCreate:      vi.fn(),
  mockExecuteRaw:  vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    eventRecord: {
      create: mockCreate,
    },
    $executeRaw: mockExecuteRaw,
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_EVENT_BUS_ENABLED] = 'true';  }
function setFlagOff() { delete process.env[FLAGS.FF_EVENT_BUS_ENABLED];    }

const VALID_PAYLOAD = {
  id: AGGREGATE_ID,
  tenantId: TENANT_ID,
  createdBy: undefined,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('emit()', () => {
  beforeEach(() => {
    setFlagOff();
    mockCreate.mockReset();
    mockExecuteRaw.mockReset();
    mockCreate.mockResolvedValue({ id: RECORD_ID, sequence: SEQUENCE });
    mockExecuteRaw.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setFlagOff();
  });

  it('returns { skipped: true } when flag is OFF', async () => {
    const { emit } = await import('@/lib/events/emit');
    const result = await emit({
      eventName: 'template.entity.created',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'template_entity',
      aggregateId: AGGREGATE_ID,
      payload: VALID_PAYLOAD,
    });
    expect(result).toEqual({ skipped: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('throws EventNotRegistered for unknown event when flag is ON', async () => {
    setFlagOn();
    const { emit } = await import('@/lib/events/emit');
    await expect(
      emit({
        eventName: 'no.such.event',
        version: 1,
        tenantId: TENANT_ID,
        aggregate: 'unknown',
        aggregateId: AGGREGATE_ID,
        payload: {},
      }),
    ).rejects.toThrow(EventNotRegistered);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('inserts row and returns { id, sequence } for valid payload when flag is ON', async () => {
    setFlagOn();
    const { emit } = await import('@/lib/events/emit');
    const result = await emit({
      eventName: 'template.entity.created',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'template_entity',
      aggregateId: AGGREGATE_ID,
      payload: VALID_PAYLOAD,
    });
    expect(result).toEqual({ id: RECORD_ID, sequence: SEQUENCE });
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.data.tenantId).toBe(TENANT_ID);
    expect(callArgs.data.eventName).toBe('template.entity.created');
    expect(callArgs.data.version).toBe(1);
    expect(callArgs.data.aggregate).toBe('template_entity');
    expect(callArgs.data.aggregateId).toBe(AGGREGATE_ID);
  });

  it('throws ZodError for invalid payload and writes NO row', async () => {
    setFlagOn();
    const { emit } = await import('@/lib/events/emit');
    await expect(
      emit({
        eventName: 'template.entity.created',
        version: 1,
        tenantId: TENANT_ID,
        aggregate: 'template_entity',
        aggregateId: AGGREGATE_ID,
        payload: { id: 'not-a-uuid', tenantId: 'also-not-a-uuid' }, // invalid UUIDs
      }),
    ).rejects.toThrow();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not propagate NOTIFY failure — emit still returns success', async () => {
    setFlagOn();
    mockExecuteRaw.mockRejectedValue(new Error('pg_notify boom'));
    const { emit } = await import('@/lib/events/emit');
    const result = await emit({
      eventName: 'template.entity.created',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'template_entity',
      aggregateId: AGGREGATE_ID,
      payload: VALID_PAYLOAD,
    });
    expect(result).toEqual({ id: RECORD_ID, sequence: SEQUENCE });
  });

  it('uses caller-provided prisma client instead of default', async () => {
    setFlagOn();
    const mockCallerCreate     = vi.fn().mockResolvedValue({ id: RECORD_ID, sequence: SEQUENCE });
    const mockCallerExecuteRaw = vi.fn().mockResolvedValue(undefined);
    const callerPrisma = {
      eventRecord: { create: mockCallerCreate },
      $executeRaw: mockCallerExecuteRaw,
    } as unknown as typeof import('@/lib/db/prisma').prisma;

    const { emit } = await import('@/lib/events/emit');
    await emit({
      eventName: 'template.entity.created',
      version: 1,
      tenantId: TENANT_ID,
      aggregate: 'template_entity',
      aggregateId: AGGREGATE_ID,
      payload: VALID_PAYLOAD,
      prisma: callerPrisma,
    });
    expect(mockCallerCreate).toHaveBeenCalledOnce();
    // The module-level mock must NOT have been touched
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
