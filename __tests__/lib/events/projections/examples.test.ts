/**
 * Phase 5.1 — Example projections tests
 *
 * Cases:
 *  1. tenantEventCount: initial state is { count: 0, lastEventName: null }
 *  2. tenantEventCount: counts handled events and tracks lastEventName
 *  3. templateEntityCreated: adds entity IDs on created events
 *  4. templateEntityCreated: removes entity IDs on deleted events
 *  5. templateEntityCreated: idempotent — replaying the same created event does not double-count
 */

import { describe, it, expect } from 'vitest';

import {
  _tenantEventCountProjection,
} from '@/lib/events/projections/examples/tenantEventCount';
import type { TenantEventCountState } from '@/lib/events/projections/examples/tenantEventCount';

import {
  _templateEntityCreatedProjection,
} from '@/lib/events/projections/examples/templateEntityCreated';
import type { TemplateEntityCreatedState } from '@/lib/events/projections/examples/templateEntityCreated';

import type { ProjectionEventEnvelope } from '@/lib/events/projections/framework';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ENTITY_1  = '550e8400-e29b-41d4-a716-446655440000';
const ENTITY_2  = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

function makeEnvelope(
  eventName: string,
  payload: Record<string, unknown> = {},
  seq = 1,
): ProjectionEventEnvelope {
  return {
    id: `evt-${seq}`,
    sequence: BigInt(seq),
    eventName,
    version: 1,
    tenantId: TENANT_ID,
    aggregate: 'template_entity',
    aggregateId: ENTITY_1,
    payload,
    metadata: null,
    emittedAt: new Date(),
  };
}

// ─── tenantEventCount tests ───────────────────────────────────────────────────

describe('tenantEventCount projection', () => {
  it('initialState is { count: 0, lastEventName: null }', () => {
    const state = _tenantEventCountProjection.initialState();
    expect(state).toEqual({ count: 0, lastEventName: null });
  });

  it('counts handled events and tracks lastEventName', () => {
    let state: TenantEventCountState = _tenantEventCountProjection.initialState();

    const handler = _tenantEventCountProjection.handlers['template.entity.created'];
    state = handler(state, makeEnvelope('template.entity.created', { id: ENTITY_1 }, 1));
    state = handler(state, makeEnvelope('template.entity.created', { id: ENTITY_2 }, 2));

    const updHandler = _tenantEventCountProjection.handlers['template.entity.updated'];
    state = updHandler(state, makeEnvelope('template.entity.updated', { id: ENTITY_1 }, 3));

    expect(state.count).toBe(3);
    expect(state.lastEventName).toBe('template.entity.updated');
  });
});

// ─── templateEntityCreated tests ─────────────────────────────────────────────

describe('templateEntityCreated projection', () => {
  it('adds entity IDs on created events', () => {
    let state: TemplateEntityCreatedState = _templateEntityCreatedProjection.initialState();

    const created = _templateEntityCreatedProjection.handlers['template.entity.created'];
    state = created(state, makeEnvelope('template.entity.created', { id: ENTITY_1, tenantId: TENANT_ID }, 1));
    state = created(state, makeEnvelope('template.entity.created', { id: ENTITY_2, tenantId: TENANT_ID }, 2));

    expect(state.entityIds).toContain(ENTITY_1);
    expect(state.entityIds).toContain(ENTITY_2);
    expect(state.createdCount).toBe(2);
  });

  it('removes entity IDs on deleted events', () => {
    let state: TemplateEntityCreatedState = _templateEntityCreatedProjection.initialState();

    const created = _templateEntityCreatedProjection.handlers['template.entity.created'];
    const deleted = _templateEntityCreatedProjection.handlers['template.entity.deleted'];

    state = created(state, makeEnvelope('template.entity.created', { id: ENTITY_1, tenantId: TENANT_ID }, 1));
    state = created(state, makeEnvelope('template.entity.created', { id: ENTITY_2, tenantId: TENANT_ID }, 2));
    state = deleted(state, makeEnvelope('template.entity.deleted', { id: ENTITY_1, tenantId: TENANT_ID }, 3));

    expect(state.entityIds).not.toContain(ENTITY_1);
    expect(state.entityIds).toContain(ENTITY_2);
    // createdCount tracks how many were created, not current length
    expect(state.createdCount).toBe(2);
  });

  it('is idempotent: replaying the same created event does not double-count', () => {
    let state: TemplateEntityCreatedState = _templateEntityCreatedProjection.initialState();

    const created = _templateEntityCreatedProjection.handlers['template.entity.created'];
    const sameEvent = makeEnvelope('template.entity.created', { id: ENTITY_1, tenantId: TENANT_ID }, 1);

    state = created(state, sameEvent);
    state = created(state, sameEvent); // replay of the same event
    state = created(state, sameEvent);

    expect(state.entityIds).toEqual([ENTITY_1]);
    expect(state.createdCount).toBe(1);
  });

  it('ignores created events with missing id payload', () => {
    const state = _templateEntityCreatedProjection.initialState();
    const created = _templateEntityCreatedProjection.handlers['template.entity.created'];
    const next = created(state, makeEnvelope('template.entity.created', {}, 1)); // no id
    expect(next).toEqual(state); // unchanged
  });
});
