/**
 * Phase 2.1 — Hospital-level entitlements tests
 *
 * Cases:
 *  1. Flag OFF → tenant-level wins (existing behavior unchanged)
 *  2. Flag ON + hospital row enabled → allowed
 *  3. Flag ON + hospital row explicitly disabled → blocked (even if tenant enabled)
 *  4. Flag ON + no hospital row + tenant enabled → allowed (fallback)
 *  5. Flag ON + no hospital row + tenant disabled → blocked (fallback)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports so vi.hoisted runs first
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tenant: {
      findFirst: vi.fn(),
    },
    subscriptionContract: {
      findFirst: vi.fn(),
    },
    hospitalEntitlement: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/db/tenantLookup', () => ({
  tenantWhere: (key: string) => ({ tenantId: key }),
}));

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { isPlatformEnabled } from '@/lib/core/subscription/engine';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TENANT_UUID = 'aaaaaaaa-0000-0000-0000-000000000001';
const HOSPITAL_UUID = 'bbbbbbbb-0000-0000-0000-000000000002';

function mockActiveTenant(entitlementCvision: boolean) {
  mockPrisma.tenant.findFirst.mockResolvedValue({ id: TENANT_UUID, tenantId: 'hmg-test' });
  mockPrisma.subscriptionContract.findFirst.mockResolvedValue({
    id: 'contract-1',
    status: 'active',
    planType: 'enterprise',
    enabledSam: true,
    enabledTheaHealth: true,
    enabledEdrac: false,
    enabledCvision: entitlementCvision,
    enabledImdad: false,
    maxUsers: 100,
    currentUsers: 5,
    enabledFeatures: {},
    storageLimit: BigInt(1_000_000_000),
    aiQuota: null,
    branchLimits: null,
    subscriptionStartsAt: new Date('2026-01-01'),
    subscriptionEndsAt: null,
    gracePeriodEndsAt: null,
    gracePeriodEnabled: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isPlatformEnabled — hospital entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT];
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT];
  });

  // ── Case 1: Flag OFF → tenant-level only ────────────────────────────────

  it('1 — flag OFF: uses tenant-level entitlement (true)', async () => {
    mockActiveTenant(true);
    // hospitalEntitlement.findUnique must NOT be called when flag is off
    mockPrisma.hospitalEntitlement.findUnique.mockResolvedValue(null);

    const result = await isPlatformEnabled('hmg-test', 'cvision', HOSPITAL_UUID);

    expect(result).toBe(true);
    expect(mockPrisma.hospitalEntitlement.findUnique).not.toHaveBeenCalled();
  });

  it('1b — flag OFF: uses tenant-level entitlement (false)', async () => {
    mockActiveTenant(false);
    mockPrisma.hospitalEntitlement.findUnique.mockResolvedValue(null);

    const result = await isPlatformEnabled('hmg-test', 'cvision', HOSPITAL_UUID);

    expect(result).toBe(false);
    expect(mockPrisma.hospitalEntitlement.findUnique).not.toHaveBeenCalled();
  });

  // ── Case 2: Flag ON + hospital row enabled → allowed ────────────────────

  it('2 — flag ON: hospital row explicitly enabled → allowed', async () => {
    process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT] = 'true';
    mockActiveTenant(true); // tenant also enabled
    mockPrisma.hospitalEntitlement.findUnique.mockResolvedValue({
      entitlementCvision: true,
    });

    const result = await isPlatformEnabled('hmg-test', 'cvision', HOSPITAL_UUID);

    expect(result).toBe(true);
    expect(mockPrisma.hospitalEntitlement.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hospitalId: HOSPITAL_UUID } }),
    );
  });

  // ── Case 3: Flag ON + hospital row disabled → blocked ───────────────────

  it('3 — flag ON: hospital row explicitly disabled → blocked (even if tenant enabled)', async () => {
    process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT] = 'true';
    mockActiveTenant(true); // tenant has cvision enabled
    mockPrisma.hospitalEntitlement.findUnique.mockResolvedValue({
      entitlementCvision: false, // hospital is explicitly off
    });

    const result = await isPlatformEnabled('hmg-test', 'cvision', HOSPITAL_UUID);

    expect(result).toBe(false);
  });

  // ── Case 4: Flag ON + no hospital row + tenant enabled → fallback OK ────

  it('4 — flag ON: no hospital row + tenant enabled → allowed (fallback)', async () => {
    process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT] = 'true';
    mockActiveTenant(true);
    mockPrisma.hospitalEntitlement.findUnique.mockResolvedValue(null); // no row

    const result = await isPlatformEnabled('hmg-test', 'cvision', HOSPITAL_UUID);

    expect(result).toBe(true);
  });

  // ── Case 5: Flag ON + no hospital row + tenant disabled → blocked ────────

  it('5 — flag ON: no hospital row + tenant disabled → blocked (fallback)', async () => {
    process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT] = 'true';
    mockActiveTenant(false); // tenant has cvision disabled
    mockPrisma.hospitalEntitlement.findUnique.mockResolvedValue(null); // no row

    const result = await isPlatformEnabled('hmg-test', 'cvision', HOSPITAL_UUID);

    expect(result).toBe(false);
  });

  // ── Bonus: Flag ON but no hospitalId provided → tenant-level only ────────

  it('bonus — flag ON but no hospitalId: falls through to tenant-level', async () => {
    process.env[FLAGS.FF_HOSPITAL_ENTITLEMENT] = 'true';
    mockActiveTenant(true);

    const result = await isPlatformEnabled('hmg-test', 'cvision'); // no hospitalId

    expect(result).toBe(true);
    expect(mockPrisma.hospitalEntitlement.findUnique).not.toHaveBeenCalled();
  });
});
