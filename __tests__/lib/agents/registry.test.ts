/**
 * Phase 6.2 — Agent registry tests
 *
 * Cases:
 *  1. Flag OFF → registerAgent() is a no-op (no throw)
 *  2. Flag OFF → listAgents() returns []
 *  3. Flag OFF → getAgent() throws AgentsDisabled
 *  4. Flag ON  → registerAgent() + getAgent() round-trip succeeds
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { FLAGS } from '@/lib/core/flags';
import { registerAgent, getAgent, listAgents, _resetRegistryForTest } from '@/lib/agents/framework/registry';
import { AgentsDisabled, AgentNotFound } from '@/lib/agents/framework/types';

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

const fakeDef = () => ({
  key: 'test.agent.v1',
  name: 'Test Agent',
  description: 'test',
  version: 1,
  inputSchema: z.object({ x: z.string() }),
  outputSchema: z.object({ y: z.string() }),
  policyKey: 'thea_health:read',
  handler: async (input: { x: string }) => ({ y: input.x }),
});

describe('agent registry', () => {
  beforeEach(() => { _resetRegistryForTest(); disableFlag(); });
  afterEach(()  => { _resetRegistryForTest(); disableFlag(); });

  it('1. flag OFF — registerAgent() is a no-op, no throw', () => {
    expect(() => registerAgent(fakeDef())).not.toThrow();
  });

  it('2. flag OFF — listAgents() returns []', () => {
    expect(listAgents()).toEqual([]);
  });

  it('3. flag OFF — getAgent() throws AgentsDisabled', () => {
    expect(() => getAgent('test.agent.v1')).toThrow(AgentsDisabled);
  });

  it('4. flag ON — register + get round-trip', () => {
    enableFlag();
    const def = fakeDef();
    registerAgent(def);
    const retrieved = getAgent('test.agent.v1');
    expect(retrieved.key).toBe('test.agent.v1');
    expect(retrieved.name).toBe('Test Agent');
    expect(listAgents()).toHaveLength(1);
  });

  it('5. flag ON — getAgent() throws AgentNotFound for unknown key', () => {
    enableFlag();
    expect(() => getAgent('no.such.agent')).toThrow(AgentNotFound);
  });

  it('6. flag ON — registering duplicate key throws', () => {
    enableFlag();
    registerAgent(fakeDef());
    expect(() => registerAgent(fakeDef())).toThrow('already registered');
  });
});
