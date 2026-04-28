// =============================================================================
// Phase 5.1 — Projection framework barrel export
//
// Importing this module at boot time (when FF_EVENT_PROJECTIONS_ENABLED=true)
// also registers the two example projections.  When the flag is OFF,
// registerProjection() is a no-op so the import has zero side-effects.
// =============================================================================

export {
  registerProjection,
  getProjectionState,
  rebuildProjection,
  listProjections,
  ProjectionsDisabled,
  DEFAULT_SNAPSHOT_EVERY,
} from './framework';

export type {
  Projection,
  ProjectionEventEnvelope,
  RebuildReport,
} from './framework';

// Register example projections at module-load time (no-op when flag is OFF)
import { registerTenantEventCount } from './examples/tenantEventCount';
import { registerTemplateEntityCreated } from './examples/templateEntityCreated';

registerTenantEventCount();
registerTemplateEntityCreated();

export { registerTenantEventCount } from './examples/tenantEventCount';
export type { TenantEventCountState } from './examples/tenantEventCount';

export { registerTemplateEntityCreated } from './examples/templateEntityCreated';
export type { TemplateEntityCreatedState } from './examples/templateEntityCreated';
