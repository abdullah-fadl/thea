// =============================================================================
// Outcome Metrics Framework — barrel (Phase 6.3)
//
// Boot registration: when FF_OUTCOME_METRICS_ENABLED=true, importing this
// barrel registers all built-in example outcomes.  Application entry points
// (Next.js instrumentation.ts or scripts/compute-outcomes.ts) should import
// this barrel to ensure registration happens before any computeOutcome() call.
// =============================================================================

export * from './types';
export * from './registry';
export { computeOutcome, hashDimensions } from './compute';
export { getMeasurements, compareToTarget } from './report';

// ─── Boot-time example registrations ─────────────────────────────────────────
// Each registerXxx() is a no-op when the flag is OFF, so this import is safe
// to include unconditionally in entry points.
import { registerErDoorToProvider } from './examples/er-door-to-provider';
import { registerSaudiOutcomes } from './examples/saudi';

registerErDoorToProvider();
registerSaudiOutcomes();
