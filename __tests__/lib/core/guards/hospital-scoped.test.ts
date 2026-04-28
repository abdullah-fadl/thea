/**
 * Phase 2.3 — withAuthTenant hospitalScoped option tests
 *
 * Cases:
 *  1. Flag OFF + hospitalScoped=true  → passes through; hospitalId=undefined in context
 *  2. Flag ON  + hospitalScoped=true  + user.hospitalId set  → passes; hospitalId injected
 *  3. Flag ON  + hospitalScoped=true  + user.hospitalId null → 403, reason="no_hospital_scope"
 *  4. Flag ON  + hospitalScoped=false (default)              → passes; hospitalId=undefined
 *  5. Flag ON  + hospitalScoped=true  + cross-hospital attempt (query param) → uses user's hospitalId
 *
 * Pilot tests (IPD beds route):
 *  6. Flag OFF → Prisma called WITHOUT hospitalId filter
 *  7. Flag ON  + user has hospitalId → Prisma called WITH hospitalId filter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const TENANT_UUID = '11111111-1111-1111-1111-111111111111';
const HOSPITAL_ID  = 'hosp-aaaa-1111';
const USER_ID      = 'user-bbbb-2222';

const { mockRequireAuth, mockPrisma, mockRateLimit, mockCsrf } = vi.hoisted(() => {
  const mockUser = (hospitalId: string | null | undefined = HOSPITAL_ID) => ({
    id: USER_ID,
    email: 'nurse@hospital.sa',
    role: 'nurse',
    hospitalId,
    permissions: ['ipd.admin.view'],
    isActive: true,
    firstName: 'Test',
    lastName: 'Nurse',
    groupId: 'g-1',
    password: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    mockRequireAuth: vi.fn(),
    mockPrisma: {
      tenant: { findFirst: vi.fn().mockResolvedValue(null) },
      ipdBed: { findMany: vi.fn(), create: vi.fn() },
      ipdAdmission: { findMany: vi.fn().mockResolvedValue([]) },
    },
    mockRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    mockCsrf: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('@/lib/auth/requireAuth', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/security/rateLimit', () => ({
  checkRateLimitRedis: mockRateLimit,
  getRequestIp: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('@/lib/security/csrf', () => ({ requireCSRF: mockCsrf }));
vi.mock('@/lib/security/sanitize', () => ({
  sanitizeRequestBody: (b: unknown) => b,
}));
vi.mock('@/lib/access/tenantUser', () => ({
  requireAreaAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/core/subscription/engine', () => ({
  isPlatformEnabled: vi.fn().mockResolvedValue(true),
  checkSubscription: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/permissions', () => ({
  expandGroupedPermissions: (p: string[]) => p,
  getDefaultPermissionsForRole: () => ['ipd.admin.view'],
}));
// Bypass env validation that runs at module load time
vi.mock('@/lib/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://test',
    NODE_ENV: 'test',
  },
}));
vi.mock('@/lib/security/config', () => ({
  RATE_LIMIT_CONFIG: {
    API: { MAX_REQUESTS: 120, WINDOW_MS: 60000 },
    LOGIN: { MAX_ATTEMPTS: 5, WINDOW_MS: 900000 },
  },
  SESSION_CONFIG: {
    ABSOLUTE_MAX_AGE_MS: 86400000,
    IDLE_TIMEOUT_MS: 1800000,
    COOKIE_NAME: 'auth-token',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthResult(hospitalId: string | null | undefined = HOSPITAL_ID) {
  return {
    user: {
      id: USER_ID,
      email: 'nurse@hospital.sa',
      role: 'nurse',
      hospitalId,
      permissions: ['ipd.admin.view'],
      isActive: true,
      firstName: 'Test',
      lastName: 'Nurse',
      groupId: 'g-1',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    tenantId: TENANT_UUID,
    sessionId: 'sess-1',
    permissions: ['ipd.admin.view'],
  };
}

function makeReq(url = `http://localhost/api/ipd/beds`): NextRequest {
  return new NextRequest(url, { headers: { 'x-api-key': 'test-bypass-csrf' } });
}

// ---------------------------------------------------------------------------
// withAuthTenant guard tests (unit — no real route import needed)
// ---------------------------------------------------------------------------

describe('withAuthTenant — hospitalScoped option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD];
    mockRateLimit.mockResolvedValue({ allowed: true });
    mockCsrf.mockResolvedValue(null);
    mockPrisma.tenant.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD];
  });

  // ── Case 1: flag OFF + hospitalScoped=true → passes through ───────────────

  it('1 — flag OFF + hospitalScoped=true: passes through; hospitalId absent in context', async () => {
    const { withAuthTenant } = await import('@/lib/core/guards/withAuthTenant');

    mockRequireAuth.mockResolvedValue(makeAuthResult(HOSPITAL_ID));
    // Flag is OFF (env var not set)

    let capturedHospitalId: string | null | undefined = 'SENTINEL';
    const handler = withAuthTenant(
      async (_req, ctx) => {
        capturedHospitalId = ctx.hospitalId;
        return NextResponse.json({ ok: true });
      },
      { hospitalScoped: true },
    );

    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(capturedHospitalId).toBeUndefined();
  });

  // ── Case 2: flag ON + hospitalScoped=true + user has hospitalId → injects ──

  it('2 — flag ON + hospitalScoped=true + user has hospitalId: injects hospitalId', async () => {
    process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD] = 'true';
    const { withAuthTenant } = await import('@/lib/core/guards/withAuthTenant');

    mockRequireAuth.mockResolvedValue(makeAuthResult(HOSPITAL_ID));

    let capturedHospitalId: string | null | undefined;
    const handler = withAuthTenant(
      async (_req, ctx) => {
        capturedHospitalId = ctx.hospitalId;
        return NextResponse.json({ ok: true });
      },
      { hospitalScoped: true },
    );

    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(capturedHospitalId).toBe(HOSPITAL_ID);
  });

  // ── Case 3: flag ON + hospitalScoped=true + no hospitalId → 403 ──────────

  it('3 — flag ON + hospitalScoped=true + user.hospitalId=null: 403 reason=no_hospital_scope', async () => {
    process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD] = 'true';
    const { withAuthTenant } = await import('@/lib/core/guards/withAuthTenant');

    mockRequireAuth.mockResolvedValue(makeAuthResult(null));

    const handler = withAuthTenant(
      async () => NextResponse.json({ ok: true }),
      { hospitalScoped: true },
    );

    const res = await handler(makeReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('no_hospital_scope');
  });

  // ── Case 4: flag ON + hospitalScoped=false (default) → passes ────────────

  it('4 — flag ON + hospitalScoped=false (default): passes; hospitalId=undefined', async () => {
    process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD] = 'true';
    const { withAuthTenant } = await import('@/lib/core/guards/withAuthTenant');

    mockRequireAuth.mockResolvedValue(makeAuthResult(null)); // no hospitalId, but unscoped

    let capturedHospitalId: string | null | undefined = 'SENTINEL';
    const handler = withAuthTenant(
      async (_req, ctx) => {
        capturedHospitalId = ctx.hospitalId;
        return NextResponse.json({ ok: true });
      },
      // hospitalScoped not set → defaults to false
    );

    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(capturedHospitalId).toBeUndefined();
  });

  // ── Case 5: flag ON + hospitalScoped=true + cross-hospital attempt ────────

  it('5 — flag ON + hospitalScoped=true: context uses user hospitalId, ignores query param', async () => {
    process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD] = 'true';
    const { withAuthTenant } = await import('@/lib/core/guards/withAuthTenant');

    mockRequireAuth.mockResolvedValue(makeAuthResult('hosp-MINE'));

    let capturedHospitalId: string | null | undefined;
    const handler = withAuthTenant(
      async (_req, ctx) => {
        capturedHospitalId = ctx.hospitalId;
        return NextResponse.json({ ok: true });
      },
      { hospitalScoped: true },
    );

    // Attacker tries to inject a different hospitalId via query string
    const res = await handler(makeReq(`http://localhost/api/ipd/beds?hospitalId=hosp-OTHER`));
    expect(res.status).toBe(200);
    // Must be the user's hospitalId from the token, not the query param
    expect(capturedHospitalId).toBe('hosp-MINE');
    expect(capturedHospitalId).not.toBe('hosp-OTHER');
  });
});

// ---------------------------------------------------------------------------
// Pilot route tests — /api/ipd/beds GET
// ---------------------------------------------------------------------------

describe('Pilot: /api/ipd/beds — hospital isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD];
    mockRateLimit.mockResolvedValue({ allowed: true });
    mockCsrf.mockResolvedValue(null);
    mockPrisma.tenant.findFirst.mockResolvedValue(null);
    mockPrisma.ipdBed.findMany.mockResolvedValue([]);
    mockPrisma.ipdAdmission.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD];
  });

  // ── Case 6: flag OFF → all tenant beds (no hospitalId in WHERE) ───────────

  it('6 — flag OFF: Prisma findMany called without hospitalId filter', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthResult(HOSPITAL_ID));
    // Flag is OFF

    const { GET } = await import('@/app/api/ipd/beds/route');
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(mockPrisma.ipdBed.findMany).toHaveBeenCalledOnce();
    const callArgs = mockPrisma.ipdBed.findMany.mock.calls[0][0];
    // hospitalId must NOT appear in the where clause when flag is off
    expect(callArgs.where).not.toHaveProperty('hospitalId');
    expect(callArgs.where.tenantId).toBe(TENANT_UUID);
  });

  // ── Case 7: flag ON + user has hospitalId → only that hospital's beds ──────

  it('7 — flag ON + user.hospitalId set: Prisma findMany called with hospitalId filter', async () => {
    process.env[FLAGS.FF_HOSPITAL_SCOPED_GUARD] = 'true';
    mockRequireAuth.mockResolvedValue(makeAuthResult(HOSPITAL_ID));

    const { GET } = await import('@/app/api/ipd/beds/route');
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(mockPrisma.ipdBed.findMany).toHaveBeenCalledOnce();
    const callArgs = mockPrisma.ipdBed.findMany.mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe(TENANT_UUID);
    expect(callArgs.where.hospitalId).toBe(HOSPITAL_ID);
  });
});
