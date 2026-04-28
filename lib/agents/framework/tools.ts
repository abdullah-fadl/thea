import { isEnabled } from '@/lib/core/flags';
import { emit } from '@/lib/events/emit';
import { shadowEvaluate } from '@/lib/policy/shadowEval';
import { prisma } from '@/lib/db/prisma';
import {
  AgentsDisabled,
  ToolNotFound,
  type ToolDefinition,
  type RunContext,
} from './types';

// =============================================================================
// Tool Registry — in-memory, boot-time populated
// Every tool invocation goes through:
//   1. Cedar shadow-eval (if tool has a policyKey)
//   2. Handler execution
//   3. AgentToolCall row persisted
//   4. tool.invoked@v1 event emitted
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _tools = new Map<string, ToolDefinition<any, any>>();

/**
 * Register a tool. No-op when flag is OFF.
 * Throws if the key is already registered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerTool(def: ToolDefinition<any, any>): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;
  if (_tools.has(def.key)) {
    throw new Error(`Tool already registered: ${def.key}`);
  }
  _tools.set(def.key, def);
}

/**
 * Retrieve a registered tool.
 * Throws AgentsDisabled / ToolNotFound.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTool(key: string): ToolDefinition<any, any> {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) throw new AgentsDisabled();
  const def = _tools.get(key);
  if (!def) throw new ToolNotFound(key);
  return def;
}

/**
 * Invoke a tool by key.
 *  - Cedar shadow-eval (non-blocking, never blocks execution)
 *  - Runs handler
 *  - Writes AgentToolCall row
 *  - Emits tool.invoked@v1 event
 */
export async function invokeTool(
  toolKey: string,
  args: unknown,
  ctx: RunContext,
): Promise<unknown> {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) throw new AgentsDisabled();

  const tool = getTool(toolKey);
  const parsedInput = tool.inputSchema.parse(args);

  // Cedar shadow-eval for tool-level policy (non-blocking, never throws)
  let policyDecision: 'allow' | 'deny' = 'allow';
  if (tool.policyKey) {
    void shadowEvaluate({
      action: tool.policyKey,
      principal: ctx.actorUserId ? { type: 'User', id: ctx.actorUserId } : undefined,
      resource: { type: 'AgentTool', id: toolKey },
      context: { tenantId: ctx.tenantId },
      legacyDecision: 'allow',
    }).catch(() => {});
  }

  const startMs = Date.now();
  let output: unknown;
  let status: 'success' | 'failed' = 'success';
  let errorMessage: string | undefined;

  try {
    output = await tool.handler(parsedInput, ctx);
    // Validate output against schema
    output = tool.outputSchema.parse(output);
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const durationMs = Date.now() - startMs;

    // Persist AgentToolCall row (best-effort, never rethrows)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).agentToolCall.create({
      data: {
        agentRunId: ctx.agentRunId,
        toolKey,
        inputJson: parsedInput as object,
        outputJson: output !== undefined ? (output as object) : undefined,
        status,
        durationMs,
        policyDecision,
      },
    }).catch(() => {});

    // Emit tool.invoked@v1 event (best-effort)
    await emit({
      eventName: 'tool.invoked',
      version: 1,
      tenantId: ctx.tenantId,
      aggregate: 'agent_tool',
      aggregateId: ctx.agentRunId,
      payload: {
        agentRunId: ctx.agentRunId,
        agentKey: ctx.agentKey,
        toolKey,
        status,
        durationMs,
        errorMessage,
      },
    }).catch(() => {});
  }

  return output;
}

/** For testing: drain the tool registry without touching the flag. */
export function _resetToolsForTest(): void {
  _tools.clear();
}
