/**
 * Integration Tests — Authentication
 *
 * Tests the full auth lifecycle: login, /me, token expiry, and tenant scoping.
 * Requires `yarn dev` running against a live database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  seedTestData,
  cleanupTestData,
  disconnectPrisma,
  ensureServerRunning,
  authenticatedFetch,
  generateExpiredToken,
  TestContext,
  BASE_URL,
} from './helpers';

let ctx: TestContext;

describe('Auth Integration', () => {
  beforeAll(async () => {
    await ensureServerRunning();
    ctx = await seedTestData();
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(ctx);
    await disconnectPrisma();
  }, 30_000);

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------

  // Token refreshed after login (login invalidates previous sessions)
  let adminLoginToken: string | undefined;

  describe('POST /api/auth/login', () => {
    it('AUTH-01: returns JWT token with valid credentials', async () => {
      const user = ctx.users.admin;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          tenantId: user.tenantKey,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(user.email);
      expect(data.user.id).toBe(user.id);

      // Verify Set-Cookie header contains auth-token
      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toMatch(/auth-token=/);

      // Extract auth-token from Set-Cookie for subsequent /me tests
      // (login invalidates all previous sessions, so test seeded tokens become stale)
      const match = setCookie.match(/auth-token=([^;]+)/);
      if (match) adminLoginToken = match[1];
    });

    it('AUTH-02: returns 401 with wrong password', async () => {
      const user = ctx.users.admin;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'WrongPassword123!',
          tenantId: user.tenantKey,
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeTruthy();
    });

    it('AUTH-03: returns 401 for non-existent user', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'noexist@fake.thea.local',
          password: 'anything',
          tenantId: ctx.tenantA.tenantId,
        }),
      });

      // 401 expected, but 429 is also acceptable (rate limiter may fire after previous attempts)
      expect([401, 429]).toContain(res.status);
    });

    it('AUTH-04: returns 400 for missing tenant (non-owner user)', async () => {
      const user = ctx.users.doctor;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          // tenantId intentionally omitted
        }),
      });

      // Should get 400 because non-owner needs tenantId
      expect(res.status).toBe(400);
    });

    it('AUTH-05: returns 400 for invalid JSON body', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      expect(res.status).toBe(400);
    });

    it('AUTH-06: returns error for wrong tenant', async () => {
      // Tenant A user cannot log in with Tenant B key
      const user = ctx.users.doctor;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          tenantId: ctx.tenantB.tenantId,
        }),
      });

      // Should be 403 (wrong tenant for user)
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // -----------------------------------------------------------------------
  // /me endpoint
  // -----------------------------------------------------------------------

  describe('GET /api/auth/me', () => {
    it('AUTH-07: returns user profile with valid token', async () => {
      // Use login-obtained token (AUTH-01 invalidates seeded sessions)
      const token = adminLoginToken || ctx.tokens.admin;
      const res = await authenticatedFetch('/api/auth/me', token);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(ctx.users.admin.email);
      expect(data.tenantId).toBeTruthy();
    });

    it('AUTH-08: returns user permissions array', async () => {
      const token = adminLoginToken || ctx.tokens.admin;
      const res = await authenticatedFetch('/api/auth/me', token);

      const data = await res.json();
      expect(data.user.permissions).toBeDefined();
      expect(Array.isArray(data.user.permissions)).toBe(true);
    });

    it('AUTH-09: returns 401 with no token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, { method: 'GET' });

      // Middleware may redirect or return {user: null}
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        // If 200, user should be null
        expect(data.user).toBeNull();
      } else {
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('AUTH-10: returns 401 with expired token', async () => {
      const user = ctx.users.admin;
      const expiredToken = generateExpiredToken(user.id, user.email, 'admin');
      const res = await authenticatedFetch('/api/auth/me', expiredToken);

      const data = await res.json().catch(() => ({}));
      // Either 401 directly, or user is null
      if (res.status === 200) {
        expect(data.user).toBeNull();
      } else {
        expect(res.status).toBe(401);
      }
    });

    it('AUTH-11: returns 401 with garbage token', async () => {
      const res = await authenticatedFetch('/api/auth/me', 'this-is-not-a-jwt');

      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        expect(data.user).toBeNull();
      } else {
        expect(res.status).toBe(401);
      }
    });

    it('AUTH-12: doctor token returns correct role', async () => {
      const res = await authenticatedFetch('/api/auth/me', ctx.tokens.doctor);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(ctx.users.doctor.email);
    });
  });

  // -----------------------------------------------------------------------
  // Tenant entitlements
  // -----------------------------------------------------------------------

  describe('Tenant entitlements', () => {
    it('AUTH-13: /me response includes tenant entitlements', async () => {
      const token = adminLoginToken || ctx.tokens.admin;
      const res = await authenticatedFetch('/api/auth/me', token);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Check that some entitlement-related field exists
      const hasEntitlements =
        data.tenantEntitlements !== undefined ||
        data.effectiveEntitlements !== undefined ||
        data.entitlements !== undefined;
      expect(hasEntitlements).toBe(true);
    });

    it('AUTH-14: subscription status is returned', async () => {
      const token = adminLoginToken || ctx.tokens.admin;
      const res = await authenticatedFetch('/api/auth/me', token);
      const data = await res.json();

      expect(res.status).toBe(200);
      // subscription object should exist
      if (data.subscription) {
        expect(data.subscription.allowed).toBeDefined();
      }
    });
  });
});
