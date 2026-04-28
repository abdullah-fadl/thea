/**
 * Phase 6.2 — POST /api/agents/[key]/run route tests
 *
 * Cases:
 *  1. Flag OFF → 404
 *  2. Flag ON + unauthenticated → 401
 *  3. Flag ON + unknown agent → 404
 *  4. Flag ON + valid request → 200 with RunResult
 *  5. tenantId from JWT is passed to runAgent (not from body)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { FLAGS } from '@/lib/core/flags';

// ─── Mocks (must come before any module import that triggers side effects) ────

// Silence env validation — must be hoisted
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

const TENANT_UUID = '11111111-1111-1111-1111-111111111111';
const USER_UUID   = '22222222-2222-2222-2222-222222222222';

let mockAuthUser: { role: string; id: string; permissions: string[] } | null = {
  role: 'staff', id: USER_UUID, permissions: ['agents.run'],
};
let mockTenantId = TENANT_UUID;

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: vi.fn(async () => {
    if (!mockAuthUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return { user: mockAuthUser, tenantId: mockTenantId, sessionId: 'sess-001' };
  }),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    tenant: { findFirst: vi.fn().mockResolvedValue({ id: TENANT_UUID }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: USER_UUID, role: 'staff' }) },
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
}));
vi.mock('@/lib/core/owner/separation', () => ({
  requireOwner: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/access/tenantUser', () => ({
  requireAreaAccess: vi.fn().mockResolvedValue(null),
}));

const mockRunAgent = vi.fn();
vi.mock('@/lib/agents/framework/run', () => ({
  runAgent: (...a: unknown[]) => mockRunAgent(...a),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

function makeRequest(agentKey: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/agents/${agentKey}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-jwt' },
    body: JSON.stringify(body),
  });
}

// ─── Import route after mocks ─────────────────────────────────────────────────

const { POST } = await import('@/app/api/agents/[key]/run/route');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/agents/[key]/run', () => {
  beforeEach(() => {
    disableFlag();
    vi.clearAllMocks();
    mockAuthUser = { role: 'staff', id: USER_UUID, permissions: ['agents.run'] };
    mockTenantId = TENANT_UUID;
  });
  afterEach(() => { disableFlag(); });

  it('1. flag OFF → 404', async () => {
    const req = makeRequest('demo.triage.v1', { input: { greeting: 'hi' } });
    const res = await POST(req, { params: { key: 'demo.triage.v1' } });
    expect(res.status).toBe(404);
  });

  it('2. flag ON + unauthenticated → 401', async () => {
    enableFlag();
    mockAuthUser = null;
    const req = makeRequest('demo.triage.v1', { input: { greeting: 'hi' } });
    const res = await POST(req, { params: { key: 'demo.triage.v1' } });
    expect(res.status).toBe(401);
  });

  it('3. flag ON + unknown agent → 404', async () => {
    enableFlag();
    const { AgentNotFound } = await import('@/lib/agents/framework/types');
    mockRunAgent.mockRejectedValueOnce(new AgentNotFound('no.agent'));
    const req = makeRequest('no.agent', { input: {} });
    const res = await POST(req, { params: { key: 'no.agent' } });
    expect(res.status).toBe(404);
  });

  it('4. flag ON + valid request → 200 with RunResult', async () => {
    enableFlag();
    mockRunAgent.mockResolvedValueOnce({ id: 'run-abc', status: 'success', output: { reply: 'Hello!' } });
    const req = makeRequest('demo.triage.v1', { input: { greeting: 'Hi' } });
    const res = await POST(req, { params: { key: 'demo.triage.v1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');
    expect(json.id).toBe('run-abc');
  });

  it('5. tenantId from JWT passed to runAgent', async () => {
    enableFlag();
    mockRunAgent.mockResolvedValueOnce({ id: 'r1', status: 'success', output: {} });
    const req = makeRequest('demo.triage.v1', { input: { greeting: 'x' } });
    await POST(req, { params: { key: 'demo.triage.v1' } });
    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_UUID }),
    );
  });
});
