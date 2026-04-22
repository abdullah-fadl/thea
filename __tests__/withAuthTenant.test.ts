/**
 * withAuthTenant Guard Tests
 *
 * Tests for the centralized API route wrapper that provides:
 * - Authentication enforcement
 * - Tenant isolation (UUID validation)
 * - Platform access checks
 * - Permission checks
 * - Role-based bypass (owner, admin)
 * - Public route handling
 * - Owner-scoped route handling
 * - Portal session blocking
 * - Rate limiting
 * - CSRF protection
 * - Input sanitization
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ───────────────────────────────────────────

const mockRequireAuth = vi.fn();
const mockRequireOwner = vi.fn();
const mockIsPlatformEnabled = vi.fn();
const mockCheckSubscription = vi.fn();
const mockCheckRateLimitRedis = vi.fn();
const mockRequireCSRF = vi.fn();
const mockSanitizeRequestBody = vi.fn((body: any) => body);
const mockGetDefaultPermissionsForRole = vi.fn(() => []);
const mockExpandGroupedPermissions = vi.fn((p: string[]) => p);
const mockRequireAreaAccess = vi.fn();
const mockPrisma = { tenant: { findFirst: vi.fn() } };

vi.mock('@/lib/auth/requireAuth', () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/core/owner/separation', () => ({
  requireOwner: (...args: any[]) => mockRequireOwner(...args),
}));

vi.mock('../subscription/engine', () => ({
  isPlatformEnabled: (...args: any[]) => mockIsPlatformEnabled(...args),
  checkSubscription: (...args: any[]) => mockCheckSubscription(...args),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/db/tenantLookup', () => ({
  tenantWhere: (id: string) => ({ tenantId: id }),
}));

vi.mock('@/lib/access/tenantUser', () => ({
  requireAreaAccess: (...args: any[]) => mockRequireAreaAccess(...args),
}));

vi.mock('@/lib/permissions', () => ({
  getDefaultPermissionsForRole: (...args: any[]) => mockGetDefaultPermissionsForRole(...args),
  expandGroupedPermissions: (...args: any[]) => mockExpandGroupedPermissions(...args),
}));

vi.mock('@/lib/security/rateLimit', () => ({
  checkRateLimitRedis: (...args: any[]) => mockCheckRateLimitRedis(...args),
  getRequestIp: () => '127.0.0.1',
}));

vi.mock('@/lib/security/config', () => ({
  RATE_LIMIT_CONFIG: {
    API: { MAX_REQUESTS: 120, WINDOW_MS: 60000 },
  },
}));

vi.mock('@/lib/security/csrf', () => ({
  requireCSRF: (...args: any[]) => mockRequireCSRF(...args),
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizeRequestBody: (...args: any[]) => mockSanitizeRequestBody(...args),
}));

// ─── Helpers ─────────────────────────────────────────

const VALID_TENANT_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function makeRequest(url = 'http://localhost:3000/api/test', method = 'GET', body?: any): NextRequest {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return new NextRequest(url, init);
}

function makeAuthResult(overrides: Record<string, any> = {}) {
  return {
    user: {
      id: 'user-123',
      role: 'doctor',
      permissions: [],
      ...overrides.user,
    },
    tenantId: VALID_TENANT_UUID,
    sessionId: 'session-abc',
    ...overrides,
  };
}

function setupDefaultMocks() {
  mockRequireAuth.mockResolvedValue(makeAuthResult());
  mockCheckRateLimitRedis.mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 });
  mockRequireCSRF.mockResolvedValue(null);
  mockExpandGroupedPermissions.mockImplementation((p: string[]) => p);
  mockGetDefaultPermissionsForRole.mockReturnValue([]);
  mockIsPlatformEnabled.mockResolvedValue(true);
  mockRequireAreaAccess.mockResolvedValue(undefined);
}

// ─── Tests ───────────────────────────────────────────

describe('withAuthTenant guard', () => {
  let withAuthTenant: typeof import('@/lib/core/guards/withAuthTenant').withAuthTenant;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupDefaultMocks();
    const mod = await import('@/lib/core/guards/withAuthTenant');
    withAuthTenant = mod.withAuthTenant;
  });

  // ══════════════════════════════════════════════
  // 1. Basic authentication
  // ══════════════════════════════════════════════

  describe('authentication', () => {
    it('should call handler with authenticated context when auth succeeds', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler);
      const req = makeRequest();

      await route(req);

      expect(handler).toHaveBeenCalledTimes(1);
      const [, ctx] = handler.mock.calls[0];
      expect(ctx.tenantId).toBe(VALID_TENANT_UUID);
      expect(ctx.userId).toBe('user-123');
      expect(ctx.role).toBe('doctor');
    });

    it('should return 401 when authentication fails', async () => {
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
      const handler = vi.fn();
      const route = withAuthTenant(handler);

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(401);
    });

    it('should use softFailResponse when auth fails and softFailResponse is set', async () => {
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
      const softResponse = NextResponse.json({ data: [] });
      const handler = vi.fn();
      const route = withAuthTenant(handler, { softFailResponse: softResponse });

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('should support softFailResponse as a function', async () => {
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
      const handler = vi.fn();
      const route = withAuthTenant(handler, {
        softFailResponse: () => NextResponse.json({ empty: true }),
      });

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      const body = await res.json();
      expect(body.empty).toBe(true);
    });
  });

  // ══════════════════════════════════════════════
  // 2. Tenant isolation (UUID validation)
  // ══════════════════════════════════════════════

  describe('tenant isolation', () => {
    it('should return 403 when tenantId is empty and tenantScoped is true', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({ tenantId: '' }));
      const handler = vi.fn();
      const route = withAuthTenant(handler, { tenantScoped: true });

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('No tenant selected');
    });

    it('should return 403 when tenantId is not a valid UUID', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({ tenantId: 'not-a-uuid' }));
      const handler = vi.fn();
      const route = withAuthTenant(handler);

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
    });

    it('should allow valid UUID tenantId', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler);

      await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should NOT enforce UUID check when tenantScoped is false', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({ tenantId: '' }));
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { tenantScoped: false });

      const res = await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
    });
  });

  // ══════════════════════════════════════════════
  // 3. Public routes
  // ══════════════════════════════════════════════

  describe('public routes', () => {
    it('should skip authentication for public routes', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ public: true }));
      const route = withAuthTenant(handler, { publicRoute: true });

      await route(makeRequest());

      expect(mockRequireAuth).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
      const [, ctx] = handler.mock.calls[0];
      expect(ctx.role).toBe('public');
      expect(ctx.tenantId).toBe('');
    });
  });

  // ══════════════════════════════════════════════
  // 4. Owner-scoped routes
  // ══════════════════════════════════════════════

  describe('owner-scoped routes', () => {
    it('should use requireOwner for owner-scoped routes', async () => {
      mockRequireOwner.mockResolvedValue({
        user: { id: 'owner-1', role: 'thea-owner', permissions: ['*'] },
        tenantId: VALID_TENANT_UUID,
      });
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { ownerScoped: true });

      await route(makeRequest());

      expect(mockRequireOwner).toHaveBeenCalled();
      expect(mockRequireAuth).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should block non-owners from owner-scoped routes', async () => {
      mockRequireOwner.mockResolvedValue(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
      const handler = vi.fn();
      const route = withAuthTenant(handler, { ownerScoped: true });

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
    });
  });

  // ══════════════════════════════════════════════
  // 5. Permission checks
  // ══════════════════════════════════════════════

  describe('permission checks', () => {
    it('should block user without required permission', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'user-1', role: 'doctor', permissions: ['opd.view'] },
      }));
      mockExpandGroupedPermissions.mockReturnValue(['opd.view']);
      const handler = vi.fn();
      // No platformKey — tests pure permission check without platform gating
      const route = withAuthTenant(handler, {
        permissionKey: 'billing.manage',
      });

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain('Permission required');
    });

    it('should allow user with required permission', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'user-1', role: 'doctor', permissions: ['billing.manage'] },
      }));
      mockExpandGroupedPermissions.mockReturnValue(['billing.manage']);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { permissionKey: 'billing.manage' });

      await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should allow access with ANY of permissionKeys (OR logic)', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'user-1', role: 'doctor', permissions: ['orders.write'] },
      }));
      mockExpandGroupedPermissions.mockReturnValue(['orders.write']);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, {
        permissionKeys: ['orders.read', 'orders.write'],
      });

      await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should let owner bypass permission checks', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'owner-1', role: 'thea-owner', permissions: [] },
      }));
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { permissionKey: 'billing.manage' });

      await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should let admin bypass permission checks', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'admin-1', role: 'admin', permissions: [] },
      }));
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { permissionKey: 'billing.manage' });

      await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should let tenant-admin bypass permission checks', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'tadmin-1', role: 'tenant-admin', permissions: [] },
      }));
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { permissionKey: 'billing.manage' });

      await route(makeRequest());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should use default permissions for role when user has no explicit permissions', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthResult({
        user: { id: 'user-1', role: 'doctor', permissions: [] },
      }));
      mockGetDefaultPermissionsForRole.mockReturnValue(['opd.view', 'orders.read']);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { permissionKey: 'opd.view' });

      await route(makeRequest());

      expect(mockGetDefaultPermissionsForRole).toHaveBeenCalledWith('doctor');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════
  // 6. Portal session blocking
  // ══════════════════════════════════════════════

  describe('portal session blocking', () => {
    it('should block portal sessions from accessing staff API routes', async () => {
      mockRequireAuth.mockResolvedValue({
        ...makeAuthResult({
          user: { id: 'patient-1', role: 'patient', permissions: [] },
        }),
        sessionType: 'portal',
      });
      const handler = vi.fn();
      const route = withAuthTenant(handler);

      const res = await route(makeRequest('http://localhost:3000/api/opd/encounters'));

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain('Portal sessions cannot access staff API routes');
    });

    it('should allow portal sessions to access /api/portal routes', async () => {
      mockRequireAuth.mockResolvedValue({
        ...makeAuthResult({
          user: { id: 'patient-1', role: 'patient', permissions: [] },
        }),
        sessionType: 'portal',
      });
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { tenantScoped: false });

      await route(makeRequest('http://localhost:3000/api/portal/appointments'));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════
  // 7. Rate limiting
  // ══════════════════════════════════════════════

  describe('rate limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      mockCheckRateLimitRedis.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });
      const handler = vi.fn();
      const route = withAuthTenant(handler);

      const res = await route(makeRequest());

      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeTruthy();
    });

    it('should skip rate limiting when rateLimit is false', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { rateLimit: false });

      await route(makeRequest());

      expect(mockCheckRateLimitRedis).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should use custom rate limit config when provided', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler, { rateLimit: { max: 10, windowMs: 5000 } });

      await route(makeRequest());

      expect(mockCheckRateLimitRedis).toHaveBeenCalledWith(
        'api:user-123',
        10,
        5000,
      );
    });
  });

  // ══════════════════════════════════════════════
  // 8. Dynamic route params
  // ══════════════════════════════════════════════

  describe('dynamic route params', () => {
    it('should resolve params and pass them to handler', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler);

      await route(makeRequest(), { params: { id: 'abc-123' } });

      expect(handler).toHaveBeenCalledTimes(1);
      const [, , params] = handler.mock.calls[0];
      expect(params).toEqual({ id: 'abc-123' });
    });

    it('should resolve Promise-based params (Next.js 15+)', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const route = withAuthTenant(handler);

      await route(makeRequest(), {
        params: Promise.resolve({ encounterId: 'enc-456' }),
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const [, , params] = handler.mock.calls[0];
      expect(params).toEqual({ encounterId: 'enc-456' });
    });
  });

  // ══════════════════════════════════════════════
  // 9. resolveAreaFromPath
  // ══════════════════════════════════════════════

  describe('area resolution (source validation)', () => {
    it('should map known API paths to area keys', () => {
      const fs = require('fs');
      const src = fs.readFileSync(
        require('path').join(process.cwd(), 'lib/core/guards/withAuthTenant.ts'),
        'utf-8'
      );

      // Verify all area mappings exist
      expect(src).toContain("'/api/registration'");
      expect(src).toContain("'/api/er'");
      expect(src).toContain("'/api/opd'");
      expect(src).toContain("'/api/ipd'");
      expect(src).toContain("'/api/orders'");
      expect(src).toContain("'/api/results'");
      expect(src).toContain("'/api/tasks'");
      expect(src).toContain("'/api/handover'");
      expect(src).toContain("'/api/notifications'");
      expect(src).toContain("'/api/billing'");
      expect(src).toContain("'/api/mortuary'");

      // Verify return types
      expect(src).toContain("return 'REGISTRATION'");
      expect(src).toContain("return 'ER'");
      expect(src).toContain("return 'OPD'");
      expect(src).toContain("return 'IPD'");
      expect(src).toContain("return 'ORDERS'");
      expect(src).toContain("return 'RESULTS'");
      expect(src).toContain("return 'TASKS'");
      expect(src).toContain("return 'HANDOVER'");
      expect(src).toContain("return 'NOTIFICATIONS'");
      expect(src).toContain("return 'BILLING'");
      expect(src).toContain("return 'MORTUARY'");
    });
  });

  // ══════════════════════════════════════════════
  // 10. createTenantQuery helper
  // ══════════════════════════════════════════════

  describe('createTenantQuery', () => {
    it('should merge tenantId into base query', async () => {
      const { createTenantQuery } = await import('@/lib/core/guards/withAuthTenant');
      const query = createTenantQuery({ status: 'active' }, 'tenant-abc');

      expect(query).toEqual({ status: 'active', tenantId: 'tenant-abc' });
    });
  });

  // ══════════════════════════════════════════════
  // 11. Source-level structural checks
  // ══════════════════════════════════════════════

  describe('structural integrity', () => {
    it('should export withAuthTenant and createTenantQuery', () => {
      const fs = require('fs');
      const src = fs.readFileSync(
        require('path').join(process.cwd(), 'lib/core/guards/withAuthTenant.ts'),
        'utf-8'
      );

      expect(src).toContain('export function withAuthTenant(');
      expect(src).toContain('export function createTenantQuery');
      expect(src).toContain("export type { PlatformKey }");
    });

    it('should have all expected options in WithAuthTenantOptions', () => {
      const fs = require('fs');
      const src = fs.readFileSync(
        require('path').join(process.cwd(), 'lib/core/guards/withAuthTenant.ts'),
        'utf-8'
      );

      expect(src).toContain('platformKey?:');
      expect(src).toContain('permissionKey?:');
      expect(src).toContain('permissionKeys?:');
      expect(src).toContain('tenantScoped?:');
      expect(src).toContain('ownerScoped?:');
      expect(src).toContain('publicRoute?:');
      expect(src).toContain('softFailResponse?:');
      expect(src).toContain('rateLimit?:');
      expect(src).toContain('csrf?:');
      expect(src).toContain('sanitize?:');
    });

    it('should default tenantScoped to true', () => {
      const fs = require('fs');
      const src = fs.readFileSync(
        require('path').join(process.cwd(), 'lib/core/guards/withAuthTenant.ts'),
        'utf-8'
      );

      expect(src).toContain('tenantScoped = true');
    });

    it('should validate UUID format for tenantId', () => {
      const fs = require('fs');
      const src = fs.readFileSync(
        require('path').join(process.cwd(), 'lib/core/guards/withAuthTenant.ts'),
        'utf-8'
      );

      expect(src).toContain('UUID_RE');
      expect(src).toContain('UUID_RE.test(tenantId)');
    });
  });
});
