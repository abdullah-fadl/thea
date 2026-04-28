import { isEnabled } from '@/lib/core/flags';
import { AgentsDisabled, AgentNotFound, type AgentDefinition } from './types';

// =============================================================================
// Agent Registry — in-memory, boot-time populated
// registerAgent() is a no-op when FF_AI_AGENTS_ENABLED=false.
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _registry = new Map<string, AgentDefinition<any, any>>();

/**
 * Register an agent at boot time. No-op when flag is OFF.
 * Throws if an agent with the same key is already registered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerAgent(def: AgentDefinition<any, any>): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;
  if (_registry.has(def.key)) {
    throw new Error(`Agent already registered: ${def.key}`);
  }
  _registry.set(def.key, def);
}

/**
 * Retrieve a registered agent by key.
 * Throws AgentsDisabled when flag is OFF.
 * Throws AgentNotFound when the key is unknown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAgent(key: string): AgentDefinition<any, any> {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) throw new AgentsDisabled();
  const def = _registry.get(key);
  if (!def) throw new AgentNotFound(key);
  return def;
}

/**
 * List all registered agents.
 * Returns [] when flag is OFF (no side effects).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listAgents(): AgentDefinition<any, any>[] {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return [];
  return Array.from(_registry.values());
}

/** For testing: drain the registry without touching the flag. */
export function _resetRegistryForTest(): void {
  _registry.clear();
}
