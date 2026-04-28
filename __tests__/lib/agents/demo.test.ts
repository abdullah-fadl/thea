/**
 * Phase 6.2 — DemoAgent end-to-end tests
 *
 * Cases:
 *  1. Flag ON → registerDemoAgent() registers both echo tool and demo agent
 *  2. Flag ON → runAgent('demo.triage.v1', { greeting: 'hi' }) succeeds, reply returned
 *  3. Flag ON → tool.invoked event emitted during demo run
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { registerDemoAgent, DEMO_AGENT_KEY } from '@/lib/agents/agents/demo';
import { runAgent } from '@/lib/agents/framework/run';
import { listAgents, _resetRegistryForTest } from '@/lib/agents/framework/registry';
import { _resetToolsForTest } from '@/lib/agents/framework/tools';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunCreate = vi.fn().mockResolvedValue({ id: 'demo-run-uuid' });
const mockRunUpdate = vi.fn().mockResolvedValue({});
const mockToolCreate = vi.fn().mockResolvedValue({ id: 'tc-demo' });

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentRun: {
      create: (...a: unknown[]) => mockRunCreate(...a),
      update: (...a: unknown[]) => mockRunUpdate(...a),
    },
    agentToolCall: { create: (...a: unknown[]) => mockToolCreate(...a) },
  },
}));

const mockEmit = vi.fn().mockResolvedValue({ skipped: true });
vi.mock('@/lib/events/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }));

vi.mock('@/lib/policy/shadowEval', () => ({ shadowEvaluate: vi.fn().mockResolvedValue(undefined) }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DemoAgent', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    enableFlag();
    vi.clearAllMocks();
    registerDemoAgent();
  });
  afterEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    disableFlag();
  });

  it('1. registerDemoAgent() populates the registry with demo.triage.v1', () => {
    const agents = listAgents();
    expect(agents.some((a) => a.key === DEMO_AGENT_KEY)).toBe(true);
  });

  it('2. runAgent demo succeeds and returns reply string', async () => {
    const result = await runAgent({
      agentKey: DEMO_AGENT_KEY,
      input: { greeting: 'Hello Thea!' },
      tenantId: 'tenant-demo',
      actorUserId: 'user-demo',
    });
    expect(result.status).toBe('success');
    expect((result.output as { reply: string }).reply).toContain('Hello Thea!');
  });

  it('3. tool.invoked event emitted during demo run', async () => {
    await runAgent({
      agentKey: DEMO_AGENT_KEY,
      input: { greeting: 'test' },
      tenantId: 'tenant-demo',
      actorUserId: null,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'tool.invoked', version: 1 }),
    );
  });
});
