import { isEnabled } from '@/lib/core/flags';
import {
  OutcomeMetricsDisabled,
  OutcomeNotFound,
  OutcomeDuplicateKey,
  type OutcomeDefinition,
} from './types';

// =============================================================================
// Outcome Registry — in-memory, boot-time populated (Phase 6.3)
//
// Behaviour matrix:
//   FF_OUTCOME_METRICS_ENABLED OFF →
//     registerOutcome() : no-op (silently returns, definition NOT stored)
//     getOutcome()      : throws OutcomeMetricsDisabled
//     listOutcomes()    : returns []
//
//   FF_OUTCOME_METRICS_ENABLED ON →
//     registerOutcome() : stores in registry; throws OutcomeDuplicateKey on collision
//     getOutcome()      : returns definition or throws OutcomeNotFound
//     listOutcomes()    : returns all registered definitions
// =============================================================================

const _registry = new Map<string, OutcomeDefinition>();

/**
 * Register an outcome at boot time. No-op when flag is OFF.
 * Throws OutcomeDuplicateKey if the key was already registered.
 */
export function registerOutcome(def: OutcomeDefinition): void {
  if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) return;
  if (_registry.has(def.key)) throw new OutcomeDuplicateKey(def.key);
  _registry.set(def.key, def);
}

/**
 * Retrieve a registered outcome by key.
 * Throws OutcomeMetricsDisabled when flag is OFF.
 * Throws OutcomeNotFound when the key is unknown.
 */
export function getOutcome(key: string): OutcomeDefinition {
  if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) throw new OutcomeMetricsDisabled();
  const def = _registry.get(key);
  if (!def) throw new OutcomeNotFound(key);
  return def;
}

/**
 * List all registered outcomes.
 * Returns [] when flag is OFF (no side effects, no throw).
 */
export function listOutcomes(): OutcomeDefinition[] {
  if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) return [];
  return Array.from(_registry.values());
}

/** For testing: drain the registry without touching the flag. */
export function _resetRegistryForTest(): void {
  _registry.clear();
}
