/**
 * Phase 7.6 — Cedar policy loader tests
 *
 * The loader (getPolicyText() in cedar.ts) is exercised indirectly via evaluate().
 * We assert that calling evaluate() with FF_CEDAR_SHADOW_EVAL=true reads ALL of
 * the *.cedar files in lib/policy/policies/, not just core.cedar — by snooping
 * the `policies.staticPolicies` argument that getPolicyText() forwards into
 * cedar-wasm's isAuthorized().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { readdirSync } from 'fs';
import { join } from 'path';

// Hoisted mocks
const { mockIsAuthorized, mockLogger } = vi.hoisted(() => ({
  mockIsAuthorized: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@cedar-policy/cedar-wasm/nodejs', () => ({
  isAuthorized: mockIsAuthorized,
}));
vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

function setFlagOn()  { process.env[FLAGS.FF_CEDAR_SHADOW_EVAL] = 'true';  }
function setFlagOff() { delete process.env[FLAGS.FF_CEDAR_SHADOW_EVAL];    }

function makeAllow() {
  return {
    type: 'success' as const,
    response: { decision: 'allow' as const, diagnostics: { reason: ['ok'], errors: [] } },
    warnings: [],
  };
}

describe('cedar policy loader (Phase 7.6)', () => {
  beforeEach(async () => {
    setFlagOff();
    vi.clearAllMocks();
    const { _resetCedarForTesting } = await import('@/lib/policy/cedar');
    _resetCedarForTesting();
  });

  it('loads all *.cedar files from lib/policy/policies/ (sees core + 4 platform files)', async () => {
    mockIsAuthorized.mockReturnValue(makeAllow());
    setFlagOn();

    const { evaluate } = await import('@/lib/policy/cedar');
    await evaluate({ action: 'View' });

    expect(mockIsAuthorized).toHaveBeenCalledOnce();
    const call = mockIsAuthorized.mock.calls[0][0] as { policies: { staticPolicies: string } };
    const text = call.policies.staticPolicies;

    // The loader concatenates files alphabetically and prefixes each with the
    // file marker we emit. Confirm core + 4 new platform policy files are in the text.
    expect(text).toContain('// ── core.cedar ──');
    expect(text).toContain('// ── cvision.cedar ──');
    expect(text).toContain('// ── imdad.cedar ──');
    expect(text).toContain('// ── sam.cedar ──');
    expect(text).toContain('// ── thea-health.cedar ──');
  });

  it('directory enumeration matches what the loader concatenates (no missing files)', async () => {
    const dir = join(process.cwd(), 'lib/policy/policies');
    const onDisk = readdirSync(dir).filter(n => n.endsWith('.cedar')).sort();

    mockIsAuthorized.mockReturnValue(makeAllow());
    setFlagOn();
    const { evaluate } = await import('@/lib/policy/cedar');
    await evaluate({ action: 'View' });

    const call = mockIsAuthorized.mock.calls[0][0] as { policies: { staticPolicies: string } };
    const text = call.policies.staticPolicies;
    for (const file of onDisk) {
      expect(text).toContain(`// ── ${file} ──`);
    }
    expect(onDisk.length).toBeGreaterThanOrEqual(5); // core + 4 platforms
  });
});
