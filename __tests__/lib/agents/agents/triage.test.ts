/**
 * Phase 8.3 — TriageAgent tests (6 cases)
 *
 *  1. Flag OFF → registerTriageAgent() is a no-op (registry empty)
 *  2. Valid English input + mocked Claude → ESI score, ICD-10, workup,
 *     and output marks suggestion: true
 *  3. Arabic complaint triggers Phase 6.1 matchMedicalPhrases() and
 *     the matches are passed into the LLM tool input
 *  4. Output ALWAYS includes suggestion: true
 *  5. Cedar shadow-eval invoked for the agent's policyKey
 *  6. Error from Claude (chat throws) surfaces as a failed RunResult
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Mocks (must come before importing modules under test) ───────────────────

const mockRunCreate = vi.fn().mockResolvedValue({ id: 'triage-run-1' });
const mockRunUpdate = vi.fn().mockResolvedValue({});
const mockToolCreate = vi.fn().mockResolvedValue({ id: 'tc-triage' });

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentRun: {
      create: (...a: unknown[]) => mockRunCreate(...a),
      update: (...a: unknown[]) => mockRunUpdate(...a),
    },
    agentToolCall: { create: (...a: unknown[]) => mockToolCreate(...a) },
    ontologyCodeSystem: { findUnique: vi.fn().mockResolvedValue(null) },
    ontologyConcept: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

const mockEmit = vi.fn().mockResolvedValue({ skipped: true });
vi.mock('@/lib/events/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }));

const mockShadow = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/policy/shadowEval', () => ({
  shadowEvaluate: (...a: unknown[]) => mockShadow(...a),
}));

// Stub the un-installed @anthropic-ai/sdk so Vite's import-analysis can
// resolve the dynamic import inside lib/agents/llm/anthropic.ts. The wrapper
// itself is also fully mocked below — this stub is only for the resolver.
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: vi.fn() }; } }));

const mockChat = vi.fn();
vi.mock('@/lib/agents/llm/anthropic', () => ({
  chat: (...a: unknown[]) => mockChat(...a),
  DEFAULT_AGENT_MODEL: 'claude-sonnet-4-6',
}));

const mockMatchMedicalPhrases = vi.fn();
vi.mock('@/lib/nlp/arabic/matcher', () => ({
  matchMedicalPhrases: (...a: unknown[]) => mockMatchMedicalPhrases(...a),
}));

// ─── Imports under test ──────────────────────────────────────────────────────
import { runAgent } from '@/lib/agents/framework/run';
import { listAgents, _resetRegistryForTest } from '@/lib/agents/framework/registry';
import { _resetToolsForTest } from '@/lib/agents/framework/tools';
import {
  registerTriageAgent,
  TRIAGE_AGENT_KEY,
} from '@/lib/agents/agents/triage';

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

const goodModelJson = JSON.stringify({
  esiScore: 2,
  esiReasoning: 'Acute chest pain with abnormal vitals — high-risk presentation.',
  candidateIcd10Codes: [
    { code: 'R07.9', display: 'Chest pain, unspecified', confidence: 0.85 },
    { code: 'I20.9', display: 'Angina pectoris, unspecified', confidence: 0.6 },
  ],
  suggestedWorkup: ['12-lead ECG', 'Troponin I', 'Chest X-ray'],
});

describe('TriageAgent', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    vi.clearAllMocks();
    mockMatchMedicalPhrases.mockReturnValue([]);
  });

  afterEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    disableFlag();
  });

  it('1. flag OFF — registerTriageAgent() is a no-op (registry empty)', () => {
    disableFlag();
    registerTriageAgent();
    // listAgents() also returns [] when flag off — verify the agent key is absent
    enableFlag();
    expect(listAgents().some((a) => a.key === TRIAGE_AGENT_KEY)).toBe(false);
  });

  it('2. valid English input + mocked Claude → ESI + ICD-10 + workup', async () => {
    enableFlag();
    registerTriageAgent();
    mockChat.mockResolvedValueOnce({
      text: goodModelJson,
      usage: { inputTokens: 100, outputTokens: 80 },
    });

    const result = await runAgent({
      agentKey: TRIAGE_AGENT_KEY,
      input: {
        chiefComplaint: 'Crushing chest pain radiating to left arm',
        patientAgeYears: 58,
        patientSex: 'male',
        vitals: { hr: 110, bp: '160/95', spo2: 94 },
      },
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
    });

    expect(result.status).toBe('success');
    const out = result.output as {
      esiScore: number;
      candidateIcd10Codes: Array<{ code: string }>;
      suggestedWorkup: string[];
    };
    expect(out.esiScore).toBe(2);
    expect(out.candidateIcd10Codes.map((c) => c.code)).toContain('R07.9');
    expect(out.suggestedWorkup).toContain('12-lead ECG');
    expect(mockChat).toHaveBeenCalledOnce();
  });

  it('3. Arabic complaint triggers matchMedicalPhrases() and matches reach the LLM', async () => {
    enableFlag();
    registerTriageAgent();
    mockMatchMedicalPhrases.mockReturnValue([
      {
        phrase: 'ألم صدر',
        canonical: 'chest pain',
        concept_code_system: 'SNOMED',
        concept_code: '29857009',
        span: [0, 7] as [number, number],
        score: 1.0,
      },
    ]);
    mockChat.mockResolvedValueOnce({
      text: goodModelJson,
      usage: { inputTokens: 100, outputTokens: 80 },
    });

    await runAgent({
      agentKey: TRIAGE_AGENT_KEY,
      input: { chiefComplaint: 'ألم صدر شديد منذ ساعتين' },
      tenantId: 'tenant-2',
      actorUserId: null,
    });

    expect(mockMatchMedicalPhrases).toHaveBeenCalledWith('ألم صدر شديد منذ ساعتين');
    // The user message handed to chat() should mention the canonical phrase
    const [messages] = mockChat.mock.calls[0] as [
      Array<{ role: string; content: string }>,
      unknown,
    ];
    expect(messages[0].content).toContain('chest pain');
    expect(messages[0].content).toContain('SNOMED');
  });

  it('4. output always includes suggestion: true', async () => {
    enableFlag();
    registerTriageAgent();
    mockChat.mockResolvedValueOnce({
      text: goodModelJson,
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await runAgent({
      agentKey: TRIAGE_AGENT_KEY,
      input: { chiefComplaint: 'fever and cough' },
      tenantId: 'tenant-3',
    });

    const out = result.output as { suggestion: boolean; recognizedPhrases: unknown[] };
    expect(out.suggestion).toBe(true);
    expect(Array.isArray(out.recognizedPhrases)).toBe(true);
  });

  it('5. Cedar shadow-eval invoked for the agent policy key', async () => {
    enableFlag();
    registerTriageAgent();
    mockChat.mockResolvedValueOnce({
      text: goodModelJson,
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await runAgent({
      agentKey: TRIAGE_AGENT_KEY,
      input: { chiefComplaint: 'headache' },
      tenantId: 'tenant-4',
      actorUserId: 'doc-1',
    });

    // The agent-level shadow-eval call uses resource type 'Agent'
    const agentLevelCall = mockShadow.mock.calls.find((c) => {
      const [arg] = c as [{ resource?: { type?: string } }];
      return arg?.resource?.type === 'Agent';
    });
    expect(agentLevelCall).toBeDefined();
  });

  it('6. error from Claude surfaces as a failed RunResult', async () => {
    enableFlag();
    registerTriageAgent();
    mockChat.mockRejectedValueOnce(new Error('upstream LLM unavailable'));

    const result = await runAgent({
      agentKey: TRIAGE_AGENT_KEY,
      input: { chiefComplaint: 'abdominal pain' },
      tenantId: 'tenant-5',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('upstream LLM unavailable');
  });
});
