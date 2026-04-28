/**
 * Phase 4.3 — shadowEvaluate() tests
 *
 * vi.mock('@cedar-policy/cedar-wasm/nodejs') intercepts getCedar()'s dynamic
 * import so the real evaluate() runs through the mocked Cedar engine.
 * _resetCedarForTesting() before each test forces a fresh getCedar() call.
 *
 * Cases:
 *  1. Flag OFF → immediate no-op; isAuthorized never called
 *  2. Flag ON + Cedar matches legacy allow → logs outcome: 'match'
 *  3. Flag ON + Cedar deny ≠ legacy allow → logs outcome: 'disagreement'
 *  4. Cedar returns failure response → logs outcome: 'cedar_unavailable'
 *  5. Returns void — caller's decision unchanged regardless of Cedar result
 *  6. No throw propagates when isAuthorized() throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockIsAuthorized, mockLogger } = vi.hoisted(() => ({
  mockIsAuthorized: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@cedar-policy/cedar-wasm/nodejs', () => ({
  isAuthorized: mockIsAuthorized,
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_CEDAR_SHADOW_EVAL] = 'true';  }
function setFlagOff() { delete process.env[FLAGS.FF_CEDAR_SHADOW_EVAL];    }

function allowAnswer(reasons = ['p1']) {
  return {
    type: 'success' as const,
    response: { decision: 'allow' as const, diagnostics: { reason: reasons, errors: [] } },
    warnings: [],
  };
}
function denyAnswer(reasons = ['p1']) {
  return {
    type: 'success' as const,
    response: { decision: 'deny' as const, diagnostics: { reason: reasons, errors: [] } },
    warnings: [],
  };
}
function failureAnswer() {
  return { type: 'failure' as const, errors: [{ message: 'eval error' }], warnings: [] };
}

const BASE_ARGS = {
  action: 'Read',
  principal: { id: 'user-1', type: 'Thea::User', attrs: { tenantId: 'tenant-1', role: 'nurse', hospitalId: '' } },
  resource:  { id: 'res-1',  type: 'Thea::Resource', attrs: { tenantId: 'tenant-1' } },
} as const;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('shadowEvaluate()', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    // Reset cache so getCedar() re-runs (hits the mocked dynamic import)
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  // ── Case 1: Flag OFF → no-op ──────────────────────────────────────────────
  it('is a no-op when FF_CEDAR_SHADOW_EVAL is OFF', async () => {
    setFlagOff();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    await shadowEvaluate({ ...BASE_ARGS, legacyDecision: 'allow' });

    expect(mockIsAuthorized).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  // ── Case 2: Match ─────────────────────────────────────────────────────────
  it('logs outcome: match when Cedar and legacy agree (both allow)', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['p1']));
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    await shadowEvaluate({ ...BASE_ARGS, legacyDecision: 'allow' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cedar shadow evaluation',
      expect.objectContaining({
        category: 'policy',
        outcome: 'match',
        action: 'Read',
        'principal.id': 'user-1',
        'resource.type': 'Thea::Resource',
      }),
    );
  });

  // ── Case 3: Disagreement ──────────────────────────────────────────────────
  it('logs outcome: disagreement when Cedar denies but legacy allowed', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['p1']));
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    await shadowEvaluate({ ...BASE_ARGS, legacyDecision: 'allow' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement', legacyDecision: 'allow' }),
    );
  });

  // ── Case 4: Cedar unavailable (failure response) ──────────────────────────
  it('logs outcome: cedar_unavailable when Cedar returns a failure response', async () => {
    mockIsAuthorized.mockReturnValue(failureAnswer());
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    await shadowEvaluate({ ...BASE_ARGS, legacyDecision: 'allow' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'cedar_unavailable' }),
    );
  });

  // ── Case 5: Returns void (legacy decision unaffected) ─────────────────────
  it('returns void — legacy decision is unaffected by Cedar result', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer());
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    const returnValue = await shadowEvaluate({ ...BASE_ARGS, legacyDecision: 'allow' });

    expect(returnValue).toBeUndefined();
  });

  // ── Case 6: No throw propagates ───────────────────────────────────────────
  it('never throws even when isAuthorized() throws inside evaluate()', async () => {
    mockIsAuthorized.mockImplementation(() => { throw new Error('Cedar panic'); });
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    // Must resolve (not reject) — evaluate() catches the throw
    await expect(
      shadowEvaluate({ ...BASE_ARGS, legacyDecision: 'allow' }),
    ).resolves.toBeUndefined();

    // evaluate() returns cedar_unavailable → shadowEvaluate logs cedar_unavailable
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'cedar_unavailable' }),
    );
  });
});
