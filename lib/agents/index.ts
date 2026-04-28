// =============================================================================
// AI Agents Framework — public barrel (Phase 6.2)
// =============================================================================

// Framework
export { registerAgent, getAgent, listAgents } from './framework/registry';
export { registerTool, getTool, invokeTool } from './framework/tools';
export { runAgent, type RunAgentArgs } from './framework/run';

// Types
export type { AgentDefinition, ToolDefinition, RunContext, RunResult } from './framework/types';
export {
  AgentsDisabled,
  AgentNotFound,
  ToolNotFound,
  AgentInputValidationError,
} from './framework/types';

// LLM wrapper
export {
  getAnthropicClient,
  chat,
  DEFAULT_AGENT_MODEL,
  AgentLLMConfigurationError,
  AgentLLMRateLimit,
  AgentLLMServerError,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
} from './llm/anthropic';

// Built-in agents
export { registerDemoAgent, DEMO_AGENT_KEY } from './agents/demo';

// Phase 8.3 — business agents
export {
  registerTriageAgent,
  TRIAGE_AGENT_KEY,
  TOOL_ANALYZE_KEY as TRIAGE_TOOL_ANALYZE_KEY,
  TOOL_LOOKUP_ICD10_KEY as TRIAGE_TOOL_LOOKUP_ICD10_KEY,
} from './agents/triage';
export type { TriageInput, TriageOutput } from './agents/triage';

export {
  registerLabMonitorAgent,
  LAB_MONITOR_AGENT_KEY,
  CRITICAL_RULES,
  evaluateLabResult,
} from './agents/labMonitor';
export type {
  LabMonitorInput,
  LabMonitorOutput,
  CriticalRule,
} from './agents/labMonitor';

export { registerLabMonitorSubscriber } from './subscribers/labMonitorSubscriber';

import { isEnabled } from '@/lib/core/flags';
import { registerDemoAgent } from './agents/demo';
import { registerTriageAgent } from './agents/triage';
import { registerLabMonitorAgent } from './agents/labMonitor';
import { registerLabMonitorSubscriber } from './subscribers/labMonitorSubscriber';

/**
 * Register every built-in Thea agent + its event-bus wiring in one call.
 * Idempotent and flag-gated — safe to call from app boot regardless of
 * whether FF_AI_AGENTS_ENABLED / FF_EVENT_BUS_ENABLED are on.
 *
 * Order:
 *   1. DemoAgent           (Phase 6.2 — kept for tests/docs)
 *   2. TriageAgent         (Phase 8.3 — LLM-backed triage)
 *   3. LabMonitorAgent     (Phase 8.3 — pure rule eval)
 *   4. lab-monitor sub     (Phase 8.3 — wires monitor to lab.result.posted@v1)
 */
export function registerTheaAllAgents(): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;
  registerDemoAgent();
  registerTriageAgent();
  registerLabMonitorAgent();
  registerLabMonitorSubscriber();
}
