import { registerProjection } from '../framework';
import type { Projection, ProjectionEventEnvelope } from '../framework';

// =============================================================================
// Example projection: tenantEventCount
//
// Counts the total number of events emitted for each tenant.
// The "aggregateId" for this projection is the tenantId itself (tenant-scoped).
//
// State shape: { count: number; lastEventName: string | null }
//
// This is a documentation/test projection — it exercises the framework without
// modelling any real clinical entity.
// =============================================================================

export interface TenantEventCountState {
  count: number;
  lastEventName: string | null;
}

const _tenantEventCountProjection: Projection<TenantEventCountState> = {
  name: 'tenantEventCount',

  initialState: () => ({ count: 0, lastEventName: null }),

  // Handles every event regardless of name by catching '*' via a wildcard handler.
  // We register the same handler for each known event type that should be counted.
  // For a truly universal counter we expose a helper the examples.test uses directly.
  handlers: {
    'template.entity.created': countHandler,
    'template.entity.updated': countHandler,
    'template.entity.deleted': countHandler,
  },
};

function countHandler(
  state: TenantEventCountState,
  event: ProjectionEventEnvelope,
): TenantEventCountState {
  return { count: state.count + 1, lastEventName: event.eventName };
}

/**
 * Register the tenantEventCount projection at boot time.
 * Called by the projections barrel (lib/events/projections/index.ts) when the flag is ON.
 */
export function registerTenantEventCount(): void {
  registerProjection(_tenantEventCountProjection);
}

export { _tenantEventCountProjection };
