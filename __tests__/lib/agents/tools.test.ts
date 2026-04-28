/**
 * Phase 6.2 — Tool registry + invocation tests
 *
 * Cases:
 *  1. Flag OFF → registerTool() is a no-op
 *  2. Flag OFF → invokeTool() throws AgentsDisabled
 *  3. Flag ON  → happy path: tool registered, invoked, result returned
 *  4. Flag ON  → Cedar shadow-eval called (event spy)
 *  5. Flag ON  → event emitted via emit()
 *  6. Flag ON  → AgentToolCall row created via prisma
 *  7. Flag ON  → tool failure: status='failed' recorded, error re-thrown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { FLAGS } from '@/lib/core/flags';
import {
  registerTool,
  invokeTool,
  _resetToolsForTest,
} from '@/lib/agents/framework/tools';
import { AgentsDisabled, ToolNotFound, type RunContext } from '@/lib/agents/framework/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn().mockResolvedValue({ id: 'tc-uuid' });
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentToolCall: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

const mockEmit = vi.fn().mockResolvedValue({ skipped: true });
vi.mock('@/lib/events/emit', () => ({ emit: (...args: unknown[]) => mockEmit(...args) }));

const mockShadow = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/policy/shadowEval', () => ({ shadowEvaluate: (...args: unknown[]) => mockShadow(...args) }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

const ctx: RunContext = {
  tenantId: 'tenant-uuid',
  actorUserId: 'user-uuid',
  agentKey: 'test.agent.v1',
  agentRunId: 'run-uuid',
};

const echoTool = {
  key: 'test.echo',
  description: 'echo',
  inputSchema: z.object({ msg: z.string() }),
  outputSchema: z.object({ out: z.string() }),
  policyKey: 'thea_health:read',
  handler: async ({ msg }: { msg: string }) => ({ out: msg }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('tool registry', () => {
  beforeEach(() => { _resetToolsForTest(); disableFlag(); vi.clearAllMocks(); });
  afterEach(()  => { _resetToolsForTest(); disableFlag(); });

  it('1. flag OFF → registerTool() is a no-op', () => {
    expect(() => registerTool(echoTool)).not.toThrow();
  });

  it('2. flag OFF → invokeTool() throws AgentsDisabled', async () => {
    await expect(invokeTool('test.echo', {}, ctx)).rejects.toThrow(AgentsDisabled);
  });

  it('3. flag ON → happy path returns tool output', async () => {
    enableFlag();
    registerTool(echoTool);
    const result = await invokeTool('test.echo', { msg: 'hello' }, ctx);
    expect(result).toEqual({ out: 'hello' });
  });

  it('4. flag ON → Cedar shadow-eval called when tool has policyKey', async () => {
    enableFlag();
    registerTool(echoTool);
    await invokeTool('test.echo', { msg: 'x' }, ctx);
    // Shadow eval is async fire-and-forget; allow it to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(mockShadow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'thea_health:read' }),
    );
  });

  it('5. flag ON → tool.invoked@v1 event emitted', async () => {
    enableFlag();
    registerTool(echoTool);
    await invokeTool('test.echo', { msg: 'x' }, ctx);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'tool.invoked', version: 1 }),
    );
  });

  it('6. flag ON → AgentToolCall row created', async () => {
    enableFlag();
    registerTool(echoTool);
    await invokeTool('test.echo', { msg: 'x' }, ctx);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toolKey: 'test.echo', status: 'success' }),
      }),
    );
  });

  it('7. flag ON → tool failure: error rethrown, AgentToolCall status=failed', async () => {
    enableFlag();
    registerTool({
      ...echoTool,
      key: 'test.failing',
      handler: async () => { throw new Error('boom'); },
    });
    await expect(invokeTool('test.failing', { msg: 'x' }, ctx)).rejects.toThrow('boom');
    await new Promise((r) => setTimeout(r, 10));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('8. flag ON → invokeTool with unknown key throws ToolNotFound', async () => {
    enableFlag();
    await expect(invokeTool('no.such.tool', {}, ctx)).rejects.toThrow(ToolNotFound);
  });
});
