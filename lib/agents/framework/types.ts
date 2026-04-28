import { z } from 'zod';

// =============================================================================
// Core types for the AI Agents Framework — Phase 6.2
// =============================================================================

/** Immutable execution context passed to every agent + tool handler. */
export interface RunContext {
  tenantId: string;
  actorUserId: string | null;
  agentKey: string;
  agentRunId: string;
}

/** Input/output contract for a registered agent. */
export interface AgentDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  key: string;
  name: string;
  description: string;
  version: number;
  inputSchema: TInput;
  outputSchema: TOutput;
  /** Cedar policy key used for shadow-eval on every run. */
  policyKey: string;
  /** The agent's execution logic. May call invokeTool(). */
  handler: (input: z.infer<TInput>, ctx: RunContext) => Promise<z.infer<TOutput>>;
}

/** Input/output contract for a registered tool. */
export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  key: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  /** Optional Cedar policy key; when set, Cedar shadow-eval runs before the handler. */
  policyKey?: string;
  handler: (input: z.infer<TInput>, ctx: RunContext) => Promise<z.infer<TOutput>>;
}

/** Result returned by runAgent(). */
export interface RunResult {
  id: string;
  status: 'success' | 'failed' | 'cancelled';
  output?: unknown;
  errorMessage?: string;
}

// ─── Error classes ────────────────────────────────────────────────────────────

export class AgentsDisabled extends Error {
  constructor() {
    super('AI Agents are disabled (FF_AI_AGENTS_ENABLED is OFF)');
    this.name = 'AgentsDisabled';
  }
}

export class AgentNotFound extends Error {
  constructor(public readonly key: string) {
    super(`Agent not found: ${key}`);
    this.name = 'AgentNotFound';
  }
}

export class ToolNotFound extends Error {
  constructor(public readonly key: string) {
    super(`Tool not found: ${key}`);
    this.name = 'ToolNotFound';
  }
}

export class AgentInputValidationError extends Error {
  constructor(
    public readonly agentKey: string,
    public readonly cause: unknown,
  ) {
    super(`Input validation failed for agent '${agentKey}'`);
    this.name = 'AgentInputValidationError';
  }
}
