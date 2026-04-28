/**
 * Phase 6.3 — GET /api/outcomes/[key] route tests
 *
 * Cases:
 *  1. Flag OFF → 404
 *  2. Valid range + registered outcome → 200 with measurements array
 *  3. tenantId isolation: tenantId from JWT is used (not spoofable)
 *  4. Missing 'outcomes.read' permission → 403
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { FLAGS } from '@/lib/core/flags';

// ─── Mocks (hoisted before any route import) ─────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgresql://test',
    NEXTAUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/security/config', () => ({
  SESSION_CONFIG: { ABSOLUTE_MAX_AGE_MS: 86400000, IDLE_TIMEOUT_MS: 1800000, COOKIE_NAME: 'auth-token' },
  RATE_LIMIT_CONFIG: {
    LOGIN: { MAX_ATTEMPTS: 5, WINDOW_MS: 900000 },
    API: { MAX_REQUESTS: 120, WINDOW_MS: 60000 },
    ACCOUNT_LOCKOUT: { MAX_FAILED_ATTEMPTS: 5, LOCKOUT_DURATION_MS: 1800000 },
    AI: { MAX_REQUESTS: 30, WINDOW_MS: 60000 },
    SEARCH: { MAX_REQUESTS: 60, WINDOW_MS: 60000 },
    EXPORT: { MAX_REQUESTS: 5, WINDOW_MS: 300000 },
    PORTAL: { MAX_REQUESTS: 30, WINDOW_MS: 60000 },
    OTP: { MAX_REQUESTS: 3, WINDOW_MS: 300000 },
  },
  SECURITY_HEADERS: {},
  CORS_CONFIG: { allowedOrigins: [] },
}));

vi.mock('@/lib/config', () => ({
  appConfig: { environment: 'test', isProduction: false, isDevelopment: false },
}));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER_ID  = '33333333-3333-3333-3333-333333333333';

let mockUser: { role: string; id: string; permissions: string[] } | null = {
  role: 'staff', id: USER_ID, permissions: ['outcomes.read'],
};
let mockTenantId = TENANT_A;

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: vi.fn(async () => {
    if (!mockUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!mockUser.permissions.includes('outcomes.read')) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return {
      user: mockUser,
      tenantId: mockTenantId,
      sessionId: 'sess-001',
      permissions: mockUser.permissions,
    };
  }),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    tenant: { findFirst: vi.fn().mockResolvedValue({ id: TENANT_A, tenantId: 'thea-test', name: 'Test' }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: USER_ID, role: 'staff' }) },
  },
}));

vi.mock('@/lib/security/rateLimit', () => ({
  checkRateLimitRedis: vi.fn().mockResolvedValue({ allowed: true, remaining: 119 }),
  getRequestIp: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('@/lib/security/csrf', () => ({ requireCSRF: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/security/sanitize', () => ({
  sanitizeRequestBody: vi.fn(async (_req: unknown, body: unknown) => body),
}));
vi.mock('@/lib/core/subscription/engine', () => ({
  isPlatformEnabled: vi.fn().mockReturnValue(true),
  checkSubscription: vi.fn().mockResolvedValue({ allowed: true, contract: { enabledPlatforms: { theaHealth: true } } }),
}));
vi.mock('@/lib/core/owner/separation', () => ({
  requireOwner: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/access/tenantUser', () => ({
  requireAreaAccess: vi.fn().mockResolvedValue(null),
}));

const mockGetMeasurements = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/outcomes/report', () => ({
  getMeasurements: (...a: unknown[]) => mockGetMeasurements(...a),
  compareToTarget: vi.fn().mockReturnValue({ status: 'on_target', delta: -5, percentDelta: -16.7 }),
}));

vi.mock('@/lib/outcomes/registry', () => ({
  getOutcome: vi.fn().mockReturnValue({
    key: 'er.door_to_provider_minutes',
    target: 30,
    direction: 'lower_is_better',
    targetTolerance: 10,
  }),
  listOutcomes: vi.fn().mockReturnValue([]),
}));

// ─── Import route after mocks ─────────────────────────────────────────────────

const { GET } = await import('@/app/api/outcomes/[key]/route');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

function makeRequest(key: string, search = 'from=2026-04-14T00:00:00Z&to=2026-04-21T00:00:00Z&granularity=day') {
  return new NextRequest(
    `http://localhost/api/outcomes/${key}?${search}`,
    { method: 'GET', headers: { Authorization: 'Bearer fake-jwt' } },
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/outcomes/[key]', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
    mockUser = { role: 'staff', id: USER_ID, permissions: ['outcomes.read'] };
    mockTenantId = TENANT_A;
    mockGetMeasurements.mockResolvedValue([]);
  });
  afterEach(() => { disableFlag(); });

  it('1. flag OFF → 404', async () => {
    const req = makeRequest('er.door_to_provider_minutes');
    const res = await GET(req, { params: { key: 'er.door_to_provider_minutes' } });
    expect(res.status).toBe(404);
  });

  it('2. valid range + registered outcome → 200 with measurements array', async () => {
    enableFlag();
    const T0 = new Date('2026-04-18T00:00:00Z');
    const T1 = new Date('2026-04-19T00:00:00Z');
    mockGetMeasurements.mockResolvedValue([
      {
        id: 'meas-1',
        outcomeKey: 'er.door_to_provider_minutes',
        tenantId: TENANT_A,
        periodStart: T0,
        periodEnd: T1,
        periodGranularity: 'day',
        dimensions: {},
        dimensionsHash: 'abc',
        value: 24.5,
        sampleSize: 38,
        computedAt: new Date(),
      },
    ]);

    const req = makeRequest('er.door_to_provider_minutes');
    const res = await GET(req, { params: { key: 'er.door_to_provider_minutes' } });
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ value: number; sampleSize: number; target: number; status: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].value).toBe(24.5);
    expect(body[0].sampleSize).toBe(38);
    expect(body[0].target).toBe(30);
    expect(body[0].status).toBe('on_target');
  });

  it('3. tenantId isolation: getMeasurements receives tenantId from JWT', async () => {
    enableFlag();
    mockTenantId = TENANT_B;

    const req = makeRequest('er.door_to_provider_minutes');
    await GET(req, { params: { key: 'er.door_to_provider_minutes' } });

    expect(mockGetMeasurements).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_B }),
    );
  });

  it('4. missing outcomes.read permission → 403', async () => {
    enableFlag();
    mockUser = { role: 'staff', id: USER_ID, permissions: [] };

    const req = makeRequest('er.door_to_provider_minutes');
    const res = await GET(req, { params: { key: 'er.door_to_provider_minutes' } });
    expect(res.status).toBe(403);
  });
});
