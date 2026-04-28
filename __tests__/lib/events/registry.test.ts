/**
 * Phase 4.2 — Event schema registry tests
 *
 * Cases:
 *  1. registerEventType stores a schema retrievable by getSchema
 *  2. getSchema returns the exact schema that was registered
 *  3. duplicate registration (same eventName+version) throws
 *  4. getSchema for unregistered event throws EventNotRegistered
 *  5. EventNotRegistered has correct name, eventName, and version fields
 *  6. Different versions of the same eventName can coexist
 *  7. listRegisteredEvents returns all registered schemas (including boot entries)
 *  8. registerEventType with version 2 coexists with version 1 of the same event
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Isolate the registry module per test so boot-time registrations
//     don't bleed between test cases. We re-import after clearing the cache.
// We test against a fresh module for mutation tests and against the real
// module (with boot entries) for listing tests.

describe('Event schema registry', () => {
  // Re-import the registry with a cleared module cache for isolation
  async function freshRegistry() {
    vi.resetModules();
    const mod = await import('@/lib/events/registry');
    return mod;
  }

  it('registers and retrieves a schema', async () => {
    const { registerEventType, getSchema } = await freshRegistry();
    const { z } = await import('zod');

    registerEventType({
      eventName: 'test.thing.happened',
      version: 1,
      aggregate: 'thing',
      description: 'A thing happened',
      payloadSchema: z.object({ id: z.string() }),
    });

    const schema = getSchema('test.thing.happened', 1);
    expect(schema.eventName).toBe('test.thing.happened');
    expect(schema.version).toBe(1);
    expect(schema.aggregate).toBe('thing');
  });

  it('getSchema returns the exact payloadSchema that was registered', async () => {
    const { registerEventType, getSchema } = await freshRegistry();
    const { z } = await import('zod');

    const payloadSchema = z.object({ foo: z.string(), bar: z.number() });
    registerEventType({
      eventName: 'test.payload.check',
      version: 1,
      aggregate: 'payload',
      description: 'Payload shape test',
      payloadSchema,
    });

    const schema = getSchema('test.payload.check', 1);
    expect(schema.payloadSchema).toBe(payloadSchema);
  });

  it('duplicate registration throws', async () => {
    const { registerEventType } = await freshRegistry();
    const { z } = await import('zod');

    const spec = {
      eventName: 'test.dupe',
      version: 1,
      aggregate: 'dupe',
      description: 'Duplicate test',
      payloadSchema: z.object({ x: z.string() }),
    };
    registerEventType(spec);
    expect(() => registerEventType(spec)).toThrow('EventType already registered: test.dupe@v1');
  });

  it('getSchema throws EventNotRegistered for unknown event', async () => {
    const { getSchema, EventNotRegistered } = await freshRegistry();
    expect(() => getSchema('no.such.event', 1)).toThrow(EventNotRegistered);
  });

  it('EventNotRegistered carries eventName and version', async () => {
    const { getSchema, EventNotRegistered } = await freshRegistry();
    try {
      getSchema('missing.event', 99);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EventNotRegistered);
      expect((err as InstanceType<typeof EventNotRegistered>).eventName).toBe('missing.event');
      expect((err as InstanceType<typeof EventNotRegistered>).version).toBe(99);
      expect((err as InstanceType<typeof EventNotRegistered>).name).toBe('EventNotRegistered');
    }
  });

  it('different versions of the same eventName coexist', async () => {
    const { registerEventType, getSchema } = await freshRegistry();
    const { z } = await import('zod');

    registerEventType({
      eventName: 'test.versioned',
      version: 1,
      aggregate: 'versioned',
      description: 'v1',
      payloadSchema: z.object({ legacy: z.string() }),
    });
    registerEventType({
      eventName: 'test.versioned',
      version: 2,
      aggregate: 'versioned',
      description: 'v2',
      payloadSchema: z.object({ legacy: z.string(), newField: z.number() }),
    });

    const v1 = getSchema('test.versioned', 1);
    const v2 = getSchema('test.versioned', 2);
    expect(v1.description).toBe('v1');
    expect(v2.description).toBe('v2');
  });

  it('listRegisteredEvents includes boot-time template events', async () => {
    // Use the real registry (not fresh) — boot entries are registered at import time
    const { listRegisteredEvents } = await import('@/lib/events/registry');
    const events = listRegisteredEvents();
    const names = events.map((e) => e.eventName);
    expect(names).toContain('template.entity.created');
    expect(names).toContain('template.entity.updated');
    expect(names).toContain('template.entity.deleted');
  });

  it('registerEventType version 2 coexists with version 1 boot entry', async () => {
    const { registerEventType, getSchema } = await freshRegistry();
    const { z } = await import('zod');

    // Boot entry registers v1 of template.entity.created (from module-load).
    // Register a v2 to confirm coexistence without conflict.
    registerEventType({
      eventName: 'template.entity.created',
      version: 2,
      aggregate: 'template_entity',
      description: 'v2 with extra field',
      payloadSchema: z.object({
        id: z.string(),
        tenantId: z.string(),
        extraField: z.string().optional(),
      }),
    });

    const v1 = getSchema('template.entity.created', 1);
    const v2 = getSchema('template.entity.created', 2);
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });
});
