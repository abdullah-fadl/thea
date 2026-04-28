import { z } from 'zod';

// =============================================================================
// Event Schema Registry
// Central source of truth for all versioned event types on the platform.
// Platforms call registerEventType() at module-load time to declare their events.
// =============================================================================

export interface EventSchema<T extends z.ZodTypeAny = z.ZodTypeAny> {
  eventName: string;
  version: number;
  /** Logical entity group, e.g. "department", "patient". Stored on every event row. */
  aggregate: string;
  /** Zod schema that validates the event payload at emit-time. */
  payloadSchema: T;
  description: string;
}

export class EventNotRegistered extends Error {
  constructor(
    public readonly eventName: string,
    public readonly version: number,
  ) {
    super(`EventType not registered: ${eventName}@v${version}`);
    this.name = 'EventNotRegistered';
  }
}

const _registry = new Map<string, EventSchema>();

function registryKey(eventName: string, version: number): string {
  return `${eventName}@v${version}`;
}

/**
 * Register an event type. Throws if the same (eventName, version) key is
 * already registered — prevents silent overwrites of prod schemas.
 */
export function registerEventType<T extends z.ZodTypeAny>(schema: EventSchema<T>): void {
  const k = registryKey(schema.eventName, schema.version);
  if (_registry.has(k)) {
    throw new Error(`EventType already registered: ${k}`);
  }
  _registry.set(k, schema as EventSchema);
}

/**
 * Retrieve a registered schema. Throws EventNotRegistered if not found.
 * Called by emit() before payload validation.
 */
export function getSchema(eventName: string, version: number): EventSchema {
  const schema = _registry.get(registryKey(eventName, version));
  if (!schema) throw new EventNotRegistered(eventName, version);
  return schema;
}

/** Returns all registered event types. Useful for introspection / admin tooling. */
export function listRegisteredEvents(): EventSchema[] {
  return Array.from(_registry.values());
}

// =============================================================================
// Boot-time registry — Template platform events
// These are used only by the Phase 4.1 _template platform scaffold.
// Real platform events are registered by their own platform modules.
// =============================================================================

registerEventType({
  eventName: 'template.entity.created',
  version: 1,
  aggregate: 'template_entity',
  description: 'Fired when a TemplatePlatform entity is created.',
  payloadSchema: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    createdBy: z.string().uuid().optional(),
  }),
});

registerEventType({
  eventName: 'template.entity.updated',
  version: 1,
  aggregate: 'template_entity',
  description: 'Fired when a TemplatePlatform entity field is changed.',
  payloadSchema: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    updatedBy: z.string().uuid().optional(),
    changedFields: z.array(z.string()).optional(),
  }),
});

registerEventType({
  eventName: 'template.entity.deleted',
  version: 1,
  aggregate: 'template_entity',
  description: 'Fired when a TemplatePlatform entity is soft- or hard-deleted.',
  payloadSchema: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    deletedBy: z.string().uuid().optional(),
  }),
});

// =============================================================================
// Phase 6.2 — AI Agents Framework events
// =============================================================================

registerEventType({
  eventName: 'agent.run.completed',
  version: 1,
  aggregate: 'agent_run',
  description: 'Fired when an agent run completes successfully.',
  payloadSchema: z.object({
    runId: z.string().uuid(),
    agentKey: z.string(),
    status: z.literal('success'),
    durationMs: z.number().int().nonnegative(),
    errorMessage: z.string().optional(),
  }),
});

registerEventType({
  eventName: 'agent.run.failed',
  version: 1,
  aggregate: 'agent_run',
  description: 'Fired when an agent run fails.',
  payloadSchema: z.object({
    runId: z.string().uuid(),
    agentKey: z.string(),
    status: z.literal('failed'),
    durationMs: z.number().int().nonnegative(),
    errorMessage: z.string().optional(),
  }),
});

registerEventType({
  eventName: 'tool.invoked',
  version: 1,
  aggregate: 'agent_tool',
  description: 'Fired when a tool is invoked during an agent run.',
  payloadSchema: z.object({
    agentRunId: z.string().uuid(),
    agentKey: z.string(),
    toolKey: z.string(),
    status: z.enum(['success', 'failed']),
    durationMs: z.number().int().nonnegative(),
    errorMessage: z.string().optional(),
  }),
});
