/**
 * Phase 4.3 — evaluate() tests
 *
 * vi.mock('@cedar-policy/cedar-wasm/nodejs') intercepts the dynamic import
 * inside getCedar(). _resetCedarForTesting() clears the module-level cache
 * so each test triggers a fresh getCedar() call that hits the mock.
 *
 * Cases:
 *  1. Flag OFF → returns { skipped: true }, Cedar never loaded
 *  2. Cedar unavailable (simulated via _forceCedarUnavailableForTesting)
 *     → { decision: 'allow', reasons: ['cedar_unavailable'] }
 *  3. isAuthorized returns allow → { decision: 'allow', reasons: [...] }
 *  4. isAuthorized returns deny  → { decision: 'deny',  reasons: [...] }
 *  5. Missing principal → defaults applied, isAuthorized called with fallbacks
 *  6. Missing resource  → defaults applied, isAuthorized called with fallbacks
 *  7. Flag OFF no-op (re-confirmed after toggle)
 *  8. Panic-safety: isAuthorized() throws → caught, returns cedar_unavailable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.hoisted() runs before module imports, so mockIsAuthorized is available
// when vi.mock() factory is evaluated.

const { mockIsAuthorized, mockLogger } = vi.hoisted(() => ({
  mockIsAuthorized: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Intercept the dynamic import('@cedar-policy/cedar-wasm/nodejs') inside getCedar()
vi.mock('@cedar-policy/cedar-wasm/nodejs', () => ({
  isAuthorized: mockIsAuthorized,
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ─── Flag helpers ─────────────────────────────────────────────────────────────

function setFlagOn()  { process.env[FLAGS.FF_CEDAR_SHADOW_EVAL] = 'true';  }
function setFlagOff() { delete process.env[FLAGS.FF_CEDAR_SHADOW_EVAL];    }

// ─── Cedar response helpers ───────────────────────────────────────────────────

function makeAllow(reasons = ['policy1']) {
  return {
    type: 'success' as const,
    response: { decision: 'allow' as const, diagnostics: { reason: reasons, errors: [] } },
    warnings: [],
  };
}

function makeDeny(reasons = ['policy1']) {
  return {
    type: 'success' as const,
    response: { decision: 'deny' as const, diagnostics: { reason: reasons, errors: [] } },
    warnings: [],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('evaluate()', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    // Reset module-level cache so getCedar() re-runs the dynamic import (hits our mock)
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  // ── Case 1: Flag OFF → skipped ────────────────────────────────────────────
  it('returns { skipped: true } when FF_CEDAR_SHADOW_EVAL is OFF', async () => {
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOff(); // explicit (already off from beforeEach)

    const result = await evaluate({ action: 'Read' });

    expect(result).toEqual({ skipped: true });
    expect(mockIsAuthorized).not.toHaveBeenCalled();
  });

  // ── Case 2: Cedar unavailable (simulated load failure) ────────────────────
  it('returns cedar_unavailable when Cedar module is unavailable', async () => {
    const { evaluate, _forceCedarUnavailableForTesting } = await import('@/lib/policy/cedar');
    // Simulate a prior failed load: module is null but already-attempted
    _forceCedarUnavailableForTesting();
    setFlagOn();

    const result = await evaluate({ action: 'Read' });

    expect(result).toEqual({ decision: 'allow', reasons: ['cedar_unavailable'] });
    expect(mockIsAuthorized).not.toHaveBeenCalled();
  });

  // ── Case 3: Cedar allows ──────────────────────────────────────────────────
  it('returns { decision: allow } when Cedar permits the request', async () => {
    mockIsAuthorized.mockReturnValue(makeAllow(['core-read-policy']));
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOn();

    const result = await evaluate({
      principal: { id: 'user-1', type: 'Thea::User', attrs: { tenantId: 'tenant-a', role: 'nurse' } },
      action: 'Read',
      resource: { id: 'res-1', type: 'Thea::Resource', attrs: { tenantId: 'tenant-a' } },
    });

    expect(result).toEqual({ decision: 'allow', reasons: ['core-read-policy'] });
    expect(mockIsAuthorized).toHaveBeenCalledOnce();
  });

  // ── Case 4: Cedar denies ──────────────────────────────────────────────────
  it('returns { decision: deny } when Cedar forbids the request', async () => {
    mockIsAuthorized.mockReturnValue(makeDeny(['deny-policy']));
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOn();

    const result = await evaluate({
      principal: { id: 'user-2', type: 'Thea::User', attrs: { tenantId: 'b', role: 'guest' } },
      action: 'Write',
      resource: { id: 'res-2', type: 'Thea::Resource', attrs: { tenantId: 'c' } },
    });

    expect(result).toEqual({ decision: 'deny', reasons: ['deny-policy'] });
  });

  // ── Case 5: Missing principal → defaults ──────────────────────────────────
  it('applies default principal (type: Thea::User, id: unknown) when principal is omitted', async () => {
    mockIsAuthorized.mockReturnValue(makeAllow());
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOn();

    await evaluate({ action: 'Read' }); // no principal

    expect(mockIsAuthorized).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: { type: 'Thea::User', id: 'unknown' },
      }),
    );
  });

  // ── Case 6: Missing resource → defaults ───────────────────────────────────
  it('applies default resource (type: Thea::Resource, id: unknown) when resource is omitted', async () => {
    mockIsAuthorized.mockReturnValue(makeAllow());
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOn();

    await evaluate({ action: 'Delete' }); // no resource

    expect(mockIsAuthorized).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: { type: 'Thea::Resource', id: 'unknown' },
      }),
    );
  });

  // ── Case 7: Flag OFF after toggle ─────────────────────────────────────────
  it('is a no-op after flag is toggled back OFF', async () => {
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOn();
    setFlagOff(); // toggle back off

    const result = await evaluate({ action: 'Read' });

    expect(result).toEqual({ skipped: true });
    expect(mockIsAuthorized).not.toHaveBeenCalled();
  });

  // ── Case 8: Panic-safety — isAuthorized throws ────────────────────────────
  it('swallows a throw from isAuthorized() and returns cedar_unavailable', async () => {
    mockIsAuthorized.mockImplementation(() => { throw new Error('Cedar internal panic'); });
    const { evaluate } = await import('@/lib/policy/cedar');
    setFlagOn();

    const result = await evaluate({ action: 'Read', principal: { id: 'u1' } });

    expect(result).toEqual({ decision: 'allow', reasons: ['cedar_unavailable'] });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cedar evaluate() threw'),
      expect.objectContaining({ category: 'policy' }),
    );
  });
});
