/**
 * Phase 2.2 — Tenant-owner API tests
 *
 * Cases:
 *  1. Flag OFF  → every tenant-owner route returns 404
 *  2. Flag ON + non-tenant-owner caller → 403
 *  3. Flag ON + tenant-owner of tenant A targets hospital in tenant B → 403
 *  4. Flag ON + tenant-owner creates hospital in own tenant → 201, correct tenantId
 *  5. Flag ON + tenant-owner lists hospitals → sees only own tenant's hospitals
 *  6. Flag ON + tenant-owner updates entitlements → HospitalEntitlement upserted
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

const TENANT_A_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TENANT_B_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const HOSPITAL_A_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const HOSPITAL_B_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const GROUP_A_UUID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const USER_A_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    hospital: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    orgGroup: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    hospitalEntitlement: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// requireAuth returns a controlled auth context based on a module-level var
let mockAuthUser: { role: string; id: string } | null = null;
let mockAuthTenantId: string = TENANT_A_UUID;

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: vi.fn(async () => {
    if (!mockAuthUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return {
      user: { ...mockAuthUser, permissions: [] },
      tenantId: mockAuthTenantId,
      sessionId: 'sess-001',
    };
  }),
}));

// Silence bcryptjs in tests — password hashing is not what we're testing
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => '$2b$12$hashed') },
  hash: vi.fn(async () => '$2b$12$hashed'),
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks are set
// ---------------------------------------------------------------------------
import { GET as listHospitals, POST as createHospital } from
  '@/app/api/tenant-owner/hospitals/route';
import { PATCH as patchEntitlements } from
  '@/app/api/tenant-owner/hospitals/[hospitalId]/entitlements/route';
import { POST as createAdmin } from
  '@/app/api/tenant-owner/hospitals/[hospitalId]/admins/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeReq(url: string, method = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function asTenantOwner(tenantId = TENANT_A_UUID) {
  mockAuthUser = { role: 'tenant-owner', id: USER_A_UUID };
  mockAuthTenantId = tenantId;
}

function asRegularUser() {
  mockAuthUser = { role: 'admin', id: USER_A_UUID };
  mockAuthTenantId = TENANT_A_UUID;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Tenant-owner API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_TENANT_OWNER_ROLE];
    mockAuthUser = null;
    mockAuthTenantId = TENANT_A_UUID;
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_TENANT_OWNER_ROLE];
  });

  // ── Case 1: Flag OFF → 404 on all routes ──────────────────────────────────

  describe('1 — FF_TENANT_OWNER_ROLE=false → 404 on all routes', () => {
    it('POST /api/tenant-owner/hospitals → 404', async () => {
      asTenantOwner();
      const res = await createHospital(
        makeReq('http://localhost/api/tenant-owner/hospitals', 'POST', {
          name: 'Test', groupId: GROUP_A_UUID,
        }) as any,
      );
      expect(res.status).toBe(404);
    });

    it('GET /api/tenant-owner/hospitals → 404', async () => {
      asTenantOwner();
      const res = await listHospitals(
        makeReq('http://localhost/api/tenant-owner/hospitals') as any,
      );
      expect(res.status).toBe(404);
    });

    it('PATCH /api/tenant-owner/hospitals/[id]/entitlements → 404', async () => {
      asTenantOwner();
      const res = await patchEntitlements(
        makeReq(
          `http://localhost/api/tenant-owner/hospitals/${HOSPITAL_A_UUID}/entitlements`,
          'PATCH',
          { entitlementSam: true },
        ) as any,
        { params: { hospitalId: HOSPITAL_A_UUID } },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Case 2: Flag ON + non-tenant-owner → 403 ─────────────────────────────

  it('2 — non-tenant-owner caller gets 403', async () => {
    process.env[FLAGS.FF_TENANT_OWNER_ROLE] = 'true';
    asRegularUser();

    const res = await listHospitals(
      makeReq('http://localhost/api/tenant-owner/hospitals') as any,
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/tenant-owner/i);
  });

  // ── Case 3: Cross-tenant hospital access → 403 ───────────────────────────

  it('3 — tenant-owner of A targeting hospital in B gets 403', async () => {
    process.env[FLAGS.FF_TENANT_OWNER_ROLE] = 'true';
    asTenantOwner(TENANT_A_UUID); // caller owns tenant A

    // hospital B belongs to tenant B — not returned for tenant A query
    mockPrisma.hospital.findFirst.mockResolvedValue(null);

    const res = await patchEntitlements(
      makeReq(
        `http://localhost/api/tenant-owner/hospitals/${HOSPITAL_B_UUID}/entitlements`,
        'PATCH',
        { entitlementSam: true },
      ) as any,
      { params: { hospitalId: HOSPITAL_B_UUID } },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/not found in this tenant/i);
    // Upsert must NOT have been called
    expect(mockPrisma.hospitalEntitlement.upsert).not.toHaveBeenCalled();
  });

  // ── Case 4: tenant-owner creates hospital → 201 ──────────────────────────

  it('4 — tenant-owner creates hospital in own tenant → 201', async () => {
    process.env[FLAGS.FF_TENANT_OWNER_ROLE] = 'true';
    asTenantOwner(TENANT_A_UUID);

    mockPrisma.orgGroup.findFirst.mockResolvedValue({ id: GROUP_A_UUID });
    mockPrisma.hospital.create.mockResolvedValue({
      id: HOSPITAL_A_UUID,
      tenantId: TENANT_A_UUID,
      groupId: GROUP_A_UUID,
      name: 'Al-Noor Hospital',
      code: null,
    });

    const res = await createHospital(
      makeReq(
        'http://localhost/api/tenant-owner/hospitals',
        'POST',
        { name: 'Al-Noor Hospital', groupId: GROUP_A_UUID },
      ) as any,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tenantId).toBe(TENANT_A_UUID);
    expect(body.name).toBe('Al-Noor Hospital');

    // Verify prisma.hospital.create was called with the JWT tenantId
    expect(mockPrisma.hospital.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A_UUID }),
      }),
    );
    // And the group lookup was tenant-scoped
    expect(mockPrisma.orgGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A_UUID }),
      }),
    );
  });

  // ── Case 5: tenant-owner lists hospitals → only own tenant ───────────────

  it('5 — tenant-owner lists hospitals → sees only own tenant', async () => {
    process.env[FLAGS.FF_TENANT_OWNER_ROLE] = 'true';
    asTenantOwner(TENANT_A_UUID);

    mockPrisma.hospital.findMany.mockResolvedValue([
      { id: HOSPITAL_A_UUID, tenantId: TENANT_A_UUID, groupId: GROUP_A_UUID,
        name: 'Al-Noor', code: null, isActive: true, createdAt: new Date() },
    ]);

    const res = await listHospitals(
      makeReq('http://localhost/api/tenant-owner/hospitals') as any,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].tenantId).toBe(TENANT_A_UUID);

    // Verify DB was queried with the caller's tenantId
    expect(mockPrisma.hospital.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A_UUID }),
      }),
    );
  });

  // ── Case 6: tenant-owner updates entitlements ─────────────────────────────

  it('6 — tenant-owner updates entitlements → HospitalEntitlement upserted', async () => {
    process.env[FLAGS.FF_TENANT_OWNER_ROLE] = 'true';
    asTenantOwner(TENANT_A_UUID);

    // Hospital belongs to tenant A
    mockPrisma.hospital.findFirst.mockResolvedValue({ id: HOSPITAL_A_UUID });

    const now = new Date();
    mockPrisma.hospitalEntitlement.upsert.mockResolvedValue({
      hospitalId: HOSPITAL_A_UUID,
      entitlementSam: true,
      entitlementHealth: false,
      entitlementEdrac: null,
      entitlementCvision: null,
      entitlementImdad: null,
      updatedAt: now,
    });

    const res = await patchEntitlements(
      makeReq(
        `http://localhost/api/tenant-owner/hospitals/${HOSPITAL_A_UUID}/entitlements`,
        'PATCH',
        { entitlementSam: true, entitlementHealth: false },
      ) as any,
      { params: { hospitalId: HOSPITAL_A_UUID } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hospitalId).toBe(HOSPITAL_A_UUID);
    expect(body.entitlementSam).toBe(true);
    expect(body.entitlementHealth).toBe(false);

    // Upsert must have been called once with the correct hospitalId
    expect(mockPrisma.hospitalEntitlement.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.hospitalEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hospitalId: HOSPITAL_A_UUID },
        create: expect.objectContaining({
          hospitalId: HOSPITAL_A_UUID,
          tenantId: TENANT_A_UUID,
          entitlementSam: true,
          entitlementHealth: false,
        }),
        update: expect.objectContaining({
          entitlementSam: true,
          entitlementHealth: false,
        }),
      }),
    );
  });
});
