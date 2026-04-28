/**
 * Phase 7.6 — CVision Cedar policy tests
 *
 * Asserts allow + deny outcomes for View employee + Approve payroll, against
 * the cvision.cedar policy intent (tenant-scoped View; HR-role-gated Approve).
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
const denyAnswer = (r = ['no-role']) => ({
  type: 'success' as const,
  response: { decision: 'deny' as const, diagnostics: { reason: r, errors: [] } },
  warnings: [],
});

describe('cvision.cedar policy', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  it('View employee in same tenant → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['cvision-view']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u1', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'hr-clerk', hospitalId: '' } },
      resource:  { id: 'emp-1', type: 'Thea::CvisionEmployee', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'ACTIVE' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match', action: 'View', 'resource.type': 'Thea::CvisionEmployee' }));
  });

  it('View employee across tenant → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['tenant-mismatch']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u2', type: 'Thea::User', attrs: { tenantId: 'tB', role: 'hr-clerk', hospitalId: '' } },
      resource:  { id: 'emp-2', type: 'Thea::CvisionEmployee', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'ACTIVE' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement', cedarDecision: 'deny' }));
  });

  it('Approve payroll as hr-manager → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['cvision-payroll-approve']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Approve',
      principal: { id: 'u3', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'hr-manager', hospitalId: '' } },
      resource:  { id: 'run-1', type: 'Thea::CvisionEmployee', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'DRY_RUN' } },
    });

    const callArg = mockIsAuthorized.mock.calls[0][0] as any;
    expect(callArg.action).toEqual({ type: 'Thea::Action', id: 'Approve' });
    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match' }));
  });

  it('Approve payroll as hr-clerk (no role) → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['no-approver-role']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Approve',
      principal: { id: 'u4', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'hr-clerk', hospitalId: '' } },
      resource:  { id: 'run-2', type: 'Thea::CvisionEmployee', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'DRY_RUN' } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement' }));
  });
});
