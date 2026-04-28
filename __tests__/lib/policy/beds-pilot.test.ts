/**
 * Phase 4.3 — GET /api/ipd/beds shadow-eval pilot tests
 *
 *  1. Legacy allow + Cedar allow → logs 'match'; returns void
 *  2. Legacy allow + Cedar deny  → logs 'disagreement'; caller still gets allow (void)
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

const PILOT_ARGS = {
  legacyDecision: 'allow' as const,
  action: 'Read',
  principal: { id: 'user-pilot', type: 'Thea::User', attrs: { tenantId: 'tenant-1', role: 'nurse', hospitalId: 'hosp-1' } },
  resource:  { id: 'tenant-1',   type: 'Thea::HospitalResource', attrs: { tenantId: 'tenant-1', hospitalId: 'hosp-1' } },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/ipd/beds shadow-eval (pilot)', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  // ── Case 1: Legacy allow + Cedar allow → match ────────────────────────────
  it('logs match when Cedar agrees with legacy allow', async () => {
    mockIsAuthorized.mockReturnValue({
      type: 'success' as const,
      response: { decision: 'allow' as const, diagnostics: { reason: ['p1'], errors: [] } },
      warnings: [],
    });
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    await shadowEvaluate(PILOT_ARGS);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match', legacyDecision: 'allow' }),
    );
  });

  // ── Case 2: Legacy allow + Cedar deny → disagreement; caller allow unchanged ─
  it('logs disagreement when Cedar denies; returns void (legacy allow unaffected)', async () => {
    mockIsAuthorized.mockReturnValue({
      type: 'success' as const,
      response: { decision: 'deny' as const, diagnostics: { reason: ['hospital-mismatch'], errors: [] } },
      warnings: [],
    });
    setFlagOn();

    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');
    const result = await shadowEvaluate(PILOT_ARGS);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement', legacyDecision: 'allow' }),
    );
    expect(result).toBeUndefined();
  });
});
