import { registerProjection } from '../framework';
import type { Projection, ProjectionEventEnvelope } from '../framework';

// =============================================================================
// Example projection: templateEntityCreated
//
// Tracks a list of entity IDs that have been created via the
// `template.entity.created@v1` event (registered by Phase 4.1's template scaffold).
//
// State shape: { entityIds: string[]; createdCount: number }
//
// The aggregateId passed to getProjectionState() should be the tenantId so that
// you get the full per-tenant list of created entities in one call.
//
// This is a documentation/test projection.
// =============================================================================

export interface TemplateEntityCreatedState {
  entityIds: string[];
  createdCount: number;
}

const _templateEntityCreatedProjection: Projection<TemplateEntityCreatedState> = {
  name: 'templateEntityCreated',

  initialState: () => ({ entityIds: [], createdCount: 0 }),

  handlers: {
    'template.entity.created': handleCreated,
    'template.entity.deleted': handleDeleted,
  },
};

function handleCreated(
  state: TemplateEntityCreatedState,
  event: ProjectionEventEnvelope,
): TemplateEntityCreatedState {
  const payload = event.payload as { id?: string };
  if (!payload?.id) return state;
  // Idempotency guard: don't double-count if replayed
  if (state.entityIds.includes(payload.id)) return state;
  return {
    entityIds: [...state.entityIds, payload.id],
    createdCount: state.createdCount + 1,
  };
}

function handleDeleted(
  state: TemplateEntityCreatedState,
  event: ProjectionEventEnvelope,
): TemplateEntityCreatedState {
  const payload = event.payload as { id?: string };
  if (!payload?.id) return state;
  return {
    entityIds: state.entityIds.filter((id) => id !== payload.id),
    createdCount: state.createdCount,
  };
}

/**
 * Register the templateEntityCreated projection at boot time.
 * Called by the projections barrel (lib/events/projections/index.ts) when the flag is ON.
 */
export function registerTemplateEntityCreated(): void {
  registerProjection(_templateEntityCreatedProjection);
}

export { _templateEntityCreatedProjection };
