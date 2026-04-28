import { isEnabled } from '@/lib/core/flags';
import { emit } from '@/lib/events/emit';
import { shadowEvaluate } from '@/lib/policy/shadowEval';
import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { getAgent } from './registry';
import {
  AgentsDisabled,
  AgentInputValidationError,
  type RunContext,
  type RunResult,
} from './types';

// =============================================================================
// runAgent() — Core execution engine
//
// Flow:
//   1. Flag check
//   2. getAgent() → AgentDefinition
//   3. Input validation (Zod)
//   4. Create AgentRun row (status='running')
//   5. Cedar shadow-eval (non-blocking)
//   6. Execute agent handler (which may call invokeTool())
//   7. Update AgentRun row (status='success'|'failed', durationMs, outputJson)
//   8. Emit agent.run.completed@v1 or agent.run.failed@v1
//   9. Return RunResult
// =============================================================================

export interface RunAgentArgs {
  agentKey: string;
  input: unknown;
  tenantId: string;
  actorUserId?: string | null;
  /** Pass a Prisma transaction client to make the run atomic with a business write. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaTx?: any;
}

export async function runAgent(args: RunAgentArgs): Promise<RunResult> {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) throw new AgentsDisabled();

  const { agentKey, tenantId, actorUserId = null } = args;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (args.prismaTx ?? defaultPrisma) as any;

  // 1. Resolve agent definition (throws AgentNotFound if unknown)
  const def = getAgent(agentKey);

  // 2. Validate input
  let parsedInput: unknown;
  try {
    parsedInput = def.inputSchema.parse(args.input);
  } catch (err) {
    throw new AgentInputValidationError(agentKey, err);
  }

  // 3. Create AgentRun row
  const runRow = await db.agentRun.create({
    data: {
      tenantId,
      agentKey,
      actorUserId: actorUserId ?? undefined,
      inputJson: parsedInput as object,
      status: 'running',
      startedAt: new Date(),
    },
    select: { id: true },
  });
  const runId: string = runRow.id;

  const ctx: RunContext = {
    tenantId,
    actorUserId,
    agentKey,
    agentRunId: runId,
  };

  // 4. Cedar shadow-eval for agent-level policy (non-blocking)
  let cedarDecision: 'allow' | 'deny' | 'unevaluated' = 'unevaluated';
  let cedarReasons: string[] = [];
  void shadowEvaluate({
    action: def.policyKey,
    principal: actorUserId ? { type: 'User', id: actorUserId } : undefined,
    resource: { type: 'Agent', id: agentKey },
    context: { tenantId },
    legacyDecision: 'allow',
  })
    .then(() => {
      cedarDecision = 'allow';
    })
    .catch(() => {
      cedarDecision = 'unevaluated';
    });

  // 5. Execute agent handler
  const startedAt = Date.now();
  let status: 'success' | 'failed' = 'success';
  let output: unknown;
  let errorMessage: string | undefined;
  let eventsEmittedCount = 0;

  try {
    output = await def.handler(parsedInput, ctx);
    output = def.outputSchema.parse(output);
    status = 'success';
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startedAt;

  // 6. Update AgentRun row
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status,
      outputJson: output !== undefined ? (output as object) : undefined,
      errorMessage,
      completedAt: new Date(),
      durationMs,
      eventsEmittedCount,
      cedarDecision,
      cedarReasons,
    },
  });

  // 7. Emit completion event (best-effort)
  const eventName = status === 'success' ? 'agent.run.completed' : 'agent.run.failed';
  await emit({
    eventName,
    version: 1,
    tenantId,
    aggregate: 'agent_run',
    aggregateId: runId,
    payload: {
      runId,
      agentKey,
      status,
      durationMs,
      errorMessage,
    },
  }).catch(() => {});

  return {
    id: runId,
    status,
    output: status === 'success' ? output : undefined,
    errorMessage,
  };
}
