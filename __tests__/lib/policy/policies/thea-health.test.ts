/**
 * Phase 7.6 — Thea Health Cedar policy tests
 *
 * Mocks @cedar-policy/cedar-wasm/nodejs. Asserts that:
 *   - The shadow-eval call uses Thea::ClinicalEncounter resource type and
 *     the View / Update actions defined in thea-health.cedar.
 *   - Allow + deny outcomes flow through to `match` / `disagreement` log lines.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

const { mockIsAuthorized, mockLogger } = vi.hoisted(() => ({
  mockIsAuthorized: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@cedar-policy/cedar-wasm/nodejs', () => ({ isAuthorized: mockIsAuthorized }));
vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

function setFlagOn()  { process.env[FLAGS.FF_CEDAR_SHADOW_EVAL] = 'true'; }
function setFlagOff() { delete process.env[FLAGS.FF_CEDAR_SHADOW_EVAL];   }

const allowAnswer = (r = ['ok']) => ({
  type: 'success' as const,
  response: { decision: 'allow' as const, diagnostics: { reason: r, errors: [] } },
  warnings: [],
});
const denyAnswer = (r = ['hosp-mismatch']) => ({
  type: 'success' as const,
  response: { decision: 'deny' as const, diagnostics: { reason: r, errors: [] } },
  warnings: [],
});

describe('thea-health.cedar policy', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  it('View: same tenant + same hospital → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['thea-health-view']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u1', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'doctor', hospitalId: 'h1' } },
      resource:  { id: 'enc-1', type: 'Thea::ClinicalEncounter', attrs: { tenantId: 'tA', hospitalId: 'h1', status: 'OPEN', patientId: 'p1' } },
    });

    expect(mockIsAuthorized).toHaveBeenCalledOnce();
    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match', action: 'View', 'resource.type': 'Thea::ClinicalEncounter' }));
  });

  it('View: cross-hospital read → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['hosp-mismatch']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u2', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'nurse', hospitalId: 'h1' } },
      resource:  { id: 'enc-2', type: 'Thea::ClinicalEncounter', attrs: { tenantId: 'tA', hospitalId: 'h2', status: 'OPEN', patientId: 'p2' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement', cedarDecision: 'deny', legacyDecision: 'allow' }));
  });

  it('Update on OPEN encounter → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['thea-health-update-open']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Update',
      principal: { id: 'u3', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'doctor', hospitalId: 'h1' } },
      resource:  { id: 'enc-3', type: 'Thea::ClinicalEncounter', attrs: { tenantId: 'tA', hospitalId: 'h1', status: 'OPEN', patientId: 'p3' } },
    });

    const callArg = mockIsAuthorized.mock.calls[0][0] as any;
    expect(callArg.action).toEqual({ type: 'Thea::Action', id: 'Update' });
    expect(callArg.resource).toEqual({ type: 'Thea::ClinicalEncounter', id: 'enc-3' });
    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match' }));
  });

  it('Update on CLOSED encounter → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['encounter-not-open']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Update',
      principal: { id: 'u4', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'doctor', hospitalId: 'h1' } },
      resource:  { id: 'enc-4', type: 'Thea::ClinicalEncounter', attrs: { tenantId: 'tA', hospitalId: 'h1', status: 'CLOSED', patientId: 'p4' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement' }));
  });
});
