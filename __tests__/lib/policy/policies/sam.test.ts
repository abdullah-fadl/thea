/**
 * Phase 7.6 — SAM Cedar policy tests
 *
 * Asserts allow + deny outcomes for View policy + Approve (publish) policy,
 * gated on compliance / sam-owner role.
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
const denyAnswer = (r = ['denied']) => ({
  type: 'success' as const,
  response: { decision: 'deny' as const, diagnostics: { reason: r, errors: [] } },
  warnings: [],
});

describe('sam.cedar policy', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  it('View policy in same tenant → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['sam-view']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u1', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'staff', hospitalId: '' } },
      resource:  { id: 'pol-1', type: 'Thea::SamPolicy', attrs: { tenantId: 'tA', status: 'published', scope: 'enterprise' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match', action: 'View', 'resource.type': 'Thea::SamPolicy' }));
  });

  it('View policy across tenant → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['tenant-mismatch']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u2', type: 'Thea::User', attrs: { tenantId: 'tB', role: 'staff', hospitalId: '' } },
      resource:  { id: 'pol-2', type: 'Thea::SamPolicy', attrs: { tenantId: 'tA', status: 'published', scope: 'enterprise' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement', cedarDecision: 'deny' }));
  });

  it('Approve (publish) as compliance-officer → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['sam-publish']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Approve',
      principal: { id: 'u3', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'compliance-officer', hospitalId: '' } },
      resource:  { id: 'pol-3', type: 'Thea::SamPolicy', attrs: { tenantId: 'tA', status: 'draft', scope: 'enterprise' } },
    });

    const callArg = mockIsAuthorized.mock.calls[0][0] as any;
    expect(callArg.action).toEqual({ type: 'Thea::Action', id: 'Approve' });
    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match' }));
  });

  it('Approve (publish) as plain staff (no compliance role) → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['no-publish-role']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Approve',
      principal: { id: 'u4', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'staff', hospitalId: '' } },
      resource:  { id: 'pol-4', type: 'Thea::SamPolicy', attrs: { tenantId: 'tA', status: 'draft', scope: 'enterprise' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement' }));
  });
});
