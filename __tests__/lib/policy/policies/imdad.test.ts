/**
 * Phase 7.6 — Imdad Cedar policy tests
 *
 * Asserts allow + deny outcomes for View PO + Approve PO, including the
 * amount-tier forbid for clerks on >= 100,000 SAR purchase orders.
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

describe('imdad.cedar policy', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  it('View PO same tenant → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['imdad-view']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u1', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'procurement-clerk', hospitalId: '' } },
      resource:  { id: 'po-1', type: 'Thea::ImdadPurchaseOrder', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'DRAFT', amount: 5000 } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match', action: 'View', 'resource.type': 'Thea::ImdadPurchaseOrder' }));
  });

  it('View PO cross-tenant → Cedar deny → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['tenant-mismatch']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'View',
      principal: { id: 'u2', type: 'Thea::User', attrs: { tenantId: 'tB', role: 'procurement-clerk', hospitalId: '' } },
      resource:  { id: 'po-2', type: 'Thea::ImdadPurchaseOrder', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'DRAFT', amount: 5000 } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement', cedarDecision: 'deny' }));
  });

  it('Approve PO as procurement-manager (low amount) → Cedar allow → match', async () => {
    mockIsAuthorized.mockReturnValue(allowAnswer(['imdad-approve']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Approve',
      principal: { id: 'u3', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'procurement-manager', hospitalId: '' } },
      resource:  { id: 'po-3', type: 'Thea::ImdadPurchaseOrder', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'PENDING_APPROVAL', amount: 50000 } },
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'match', action: 'Approve' }));
  });

  it('Approve high-value PO as procurement-clerk (amount >= 100k) → Cedar deny (forbid tier) → disagreement', async () => {
    mockIsAuthorized.mockReturnValue(denyAnswer(['amount-tier-exceeded']));
    setFlagOn();
    const { shadowEvaluate } = await import('@/lib/policy/shadowEval');

    await shadowEvaluate({
      legacyDecision: 'allow',
      action: 'Approve',
      principal: { id: 'u4', type: 'Thea::User', attrs: { tenantId: 'tA', role: 'procurement-clerk', hospitalId: '' } },
      resource:  { id: 'po-4', type: 'Thea::ImdadPurchaseOrder', attrs: { tenantId: 'tA', organizationId: 'o1', status: 'PENDING_APPROVAL', amount: 250000 } },
    });

    const callArg = mockIsAuthorized.mock.calls[0][0] as any;
    expect((callArg.entities as any[]).some((e) =>
      e.uid?.type === 'Thea::ImdadPurchaseOrder' && (e.attrs?.amount === 250000 || e.attrs?.amount?.value === 250000)
    )).toBe(true);

    expect(mockLogger.info).toHaveBeenCalledWith('Cedar shadow evaluation',
      expect.objectContaining({ outcome: 'disagreement' }));
  });
});
