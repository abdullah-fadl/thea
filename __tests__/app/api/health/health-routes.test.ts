/**
 * Phase 8.6 — Health endpoint tests.
 *
 * Scope: the two NEW endpoints added by 8.6. The pre-existing top-level
 * `/api/health` route (already shipped, returns `{status, version, uptime, timestamp}`)
 * is unchanged by this phase and is not re-tested here — pulling its
 * monitoring → errorReporter → @sentry/nextjs (dynamic) import chain into a
 * jsdom test environment would require a Vite alias change, which is out of
 * scope for 8.6.
 *
 * Cases:
 *  1. GET /api/health/ready  — DB reachable      → 200, ready=true, has dbLatencyMs
 *  2. GET /api/health/ready  — DB unreachable    → 503, ready=false, error message
 *  3. GET /api/health/deep   — auth + DB up      → 200, expected full shape
 *  4. GET /api/health/deep   — DB unreachable    → 503, status=degraded, registries still returned
 *  5. GET /api/health/deep   — unauthenticated   → 401
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks (hoisted before route imports) ──────────────────────────────────

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
const USER_ID  = '33333333-3333-3333-3333-333333333333';

let mockUser: { role: string; id: string; permissions: string[] } | null = {
  role: 'staff', id: USER_ID, permissions: [],
};
let mockTenantId: string = TENANT_A;

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: vi.fn(async () => {
    if (!mockUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return {
      user: mockUser,
      tenantId: mockTenantId,
      sessionId: 'sess-001',
      permissions: mockUser.permissions,
    };
  }),
}));

const mockQueryRaw = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
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
  checkSubscription: vi.fn().mockResolvedValue({
    allowed: true,
    contract: { enabledPlatforms: { theaHealth: true } },
  }),
}));
vi.mock('@/lib/core/owner/separation', () => ({
  requireOwner: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/access/tenantUser', () => ({
  requireAreaAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/events/registry', () => ({
  listRegisteredEvents: vi.fn().mockReturnValue(new Array(7).fill({})),
}));
vi.mock('@/lib/agents/framework/registry', () => ({
  listAgents: vi.fn().mockReturnValue(new Array(3).fill({})),
}));
vi.mock('@/lib/outcomes/registry', () => ({
  listOutcomes: vi.fn().mockReturnValue(new Array(15).fill({})),
}));

// ─── Import routes after mocks ─────────────────────────────────────────────

const { GET: readyGET } = await import('@/app/api/health/ready/route');
const { GET: deepGET } = await import('@/app/api/health/deep/route');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer fake-jwt' },
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Phase 8.6 — health endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { role: 'staff', id: USER_ID, permissions: [] };
    mockTenantId = TENANT_A;
    mockQueryRaw.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. /api/health/ready → 200 ready=true when DB reachable', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await readyGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(typeof body.dbLatencyMs).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('2. /api/health/ready → 503 ready=false when DB unreachable', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = await readyGET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.error).toContain('connection refused');
  });

  it('3. /api/health/deep → 200 with full shape when authenticated and DB up', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([
        { migration_name: '20260424000010_outcome_metrics' },
        { migration_name: '20260424000009_ai_agents' },
      ]);

    const req = makeRequest('/api/health/deep');
    const res = await deepGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.dbLatencyMs).toBe('number');
    expect(body.migrations.applied).toBe(2);
    expect(body.migrations.latest).toBe('20260424000010_outcome_metrics');
    expect(body.flags.total).toBeGreaterThan(0);
    expect(typeof body.flags.enabled).toBe('number');
    expect(body.registries.events).toBe(7);
    expect(body.registries.agents).toBe(3);
    expect(body.registries.outcomes).toBe(15);
  });

  it('4. /api/health/deep → 503 status=degraded when DB down (registries still returned)', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('timeout'));
    const req = makeRequest('/api/health/deep');
    const res = await deepGET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.dbLatencyMs).toBeNull();
    expect(body.registries.events).toBe(7);
    expect(body.registries.agents).toBe(3);
    expect(body.registries.outcomes).toBe(15);
  });

  it('5. /api/health/deep → 401 when unauthenticated', async () => {
    mockUser = null;
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const req = makeRequest('/api/health/deep');
    const res = await deepGET(req);
    expect(res.status).toBe(401);
  });
});
