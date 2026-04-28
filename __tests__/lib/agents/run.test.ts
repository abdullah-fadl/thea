/**
 * Phase 6.2 — runAgent() tests
 *
 * Cases:
 *  1. Flag OFF → throws AgentsDisabled
 *  2. Input validation failure → throws AgentInputValidationError, no AgentRun row
 *  3. Unknown agent → throws AgentNotFound
 *  4. AgentRun row created with status='running' on entry
 *  5. Success path → AgentRun updated to status='success', RunResult returned
 *  6. Failure path → AgentRun updated to status='failed', errorMessage set
 *  7. actorUserId=null allowed (system-initiated run)
 *  8. Tenant isolation: tenantId on AgentRun matches input
 *  9. Cedar shadow-eval invoked for agent policyKey
 * 10. Completion event emitted (agent.run.completed or agent.run.failed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { FLAGS } from '@/lib/core/flags';
import { runAgent } from '@/lib/agents/framework/run';
import { registerAgent, _resetRegistryForTest } from '@/lib/agents/framework/registry';
import { _resetToolsForTest } from '@/lib/agents/framework/tools';
import {
  AgentsDisabled,
  AgentInputValidationError,
  AgentNotFound,
} from '@/lib/agents/framework/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunCreate = vi.fn().mockResolvedValue({ id: 'run-1234' });
const mockRunUpdate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentRun: {
      create: (...a: unknown[]) => mockRunCreate(...a),
      update: (...a: unknown[]) => mockRunUpdate(...a),
    },
    agentToolCall: { create: vi.fn().mockResolvedValue({ id: 'tc-1' }) },
  },
}));

const mockEmit = vi.fn().mockResolvedValue({ skipped: true });
vi.mock('@/lib/events/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }));

const mockShadow = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/policy/shadowEval', () => ({
  shadowEvaluate: (...a: unknown[]) => mockShadow(...a),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

const goodAgent = {
  key: 'run.test.v1',
  name: 'Run Test',
  description: 'test',
  version: 1,
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  policyKey: 'thea_health:read',
  handler: async ({ name }: { name: string }) => ({ greeting: `Hi ${name}` }),
};

const failingAgent = {
  ...goodAgent,
  key: 'run.failing.v1',
  handler: async () => { throw new Error('handler exploded'); },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runAgent()', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    disableFlag();
    vi.clearAllMocks();
  });
  afterEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    disableFlag();
  });

  it('1. flag OFF → throws AgentsDisabled', async () => {
    await expect(runAgent({ agentKey: 'x', input: {}, tenantId: 't1' }))
      .rejects.toThrow(AgentsDisabled);
  });

  it('2. invalid input → throws AgentInputValidationError, no DB write', async () => {
    enableFlag();
    registerAgent(goodAgent);
    await expect(runAgent({ agentKey: 'run.test.v1', input: { name: 123 }, tenantId: 't1' }))
      .rejects.toThrow(AgentInputValidationError);
    expect(mockRunCreate).not.toHaveBeenCalled();
  });

  it('3. unknown agent → throws AgentNotFound', async () => {
    enableFlag();
    await expect(runAgent({ agentKey: 'no.agent', input: {}, tenantId: 't1' }))
      .rejects.toThrow(AgentNotFound);
  });

  it('4. AgentRun row created with status=running', async () => {
    enableFlag();
    registerAgent(goodAgent);
    await runAgent({ agentKey: 'run.test.v1', input: { name: 'Thea' }, tenantId: 'ten-1' });
    expect(mockRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'running', tenantId: 'ten-1' }),
      }),
    );
  });

  it('5. success path → RunResult with status=success and output', async () => {
    enableFlag();
    registerAgent(goodAgent);
    const result = await runAgent({
      agentKey: 'run.test.v1',
      input: { name: 'Thea' },
      tenantId: 'ten-1',
      actorUserId: 'user-abc',
    });
    expect(result.status).toBe('success');
    expect(result.output).toEqual({ greeting: 'Hi Thea' });
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'success' }),
      }),
    );
  });

  it('6. failure path → RunResult status=failed, errorMessage set', async () => {
    enableFlag();
    registerAgent(failingAgent);
    const result = await runAgent({ agentKey: 'run.failing.v1', input: { name: 'x' }, tenantId: 't1' });
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('handler exploded');
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', errorMessage: 'handler exploded' }),
      }),
    );
  });

  it('7. actorUserId=null allowed (system run)', async () => {
    enableFlag();
    registerAgent(goodAgent);
    const result = await runAgent({
      agentKey: 'run.test.v1',
      input: { name: 'System' },
      tenantId: 'ten-2',
      actorUserId: null,
    });
    expect(result.status).toBe('success');
  });

  it('8. tenantId is passed to AgentRun row', async () => {
    enableFlag();
    registerAgent(goodAgent);
    await runAgent({ agentKey: 'run.test.v1', input: { name: 'x' }, tenantId: 'tenant-xyz' });
    expect(mockRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-xyz' }),
      }),
    );
  });

  it('9. Cedar shadow-eval invoked with agent policyKey', async () => {
    enableFlag();
    registerAgent(goodAgent);
    await runAgent({ agentKey: 'run.test.v1', input: { name: 'x' }, tenantId: 't1', actorUserId: 'u1' });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockShadow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'thea_health:read' }),
    );
  });

  it('10. completion event emitted — success emits agent.run.completed', async () => {
    enableFlag();
    registerAgent(goodAgent);
    await runAgent({ agentKey: 'run.test.v1', input: { name: 'x' }, tenantId: 't1' });
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'agent.run.completed', version: 1 }),
    );
  });
});
