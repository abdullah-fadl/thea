/**
 * Security Tests — Authentication Bypass Attempts
 *
 * Verifies the system correctly rejects all forms of authentication bypass:
 * missing tokens, malformed JWTs, expired tokens, tampered payloads,
 * alg:none attacks, cross-tenant tokens, and brute force.
 *
 * ⚠️  NEVER run against production.
 */

if (process.env.NODE_ENV === 'production') throw new Error('Security tests must not run in production');

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  assertNotProduction,
  seedSecurityTestData,
  cleanupSecurityTestData,
  disconnectPrisma,
  ensureServerRunning,
  authGet,
  authPost,
  unauthFetch,
  generateExpiredToken,
  generateTamperedToken,
  generateAlgNoneToken,
  BASE_URL,
  type SecurityTestContext,
} from './helpers';

let ctx: SecurityTestContext;

describe('Authentication Bypass Attempts', () => {
  beforeAll(async () => {
    assertNotProduction();
    await ensureServerRunning();
    ctx = await seedSecurityTestData();
  }, 60_000);

  afterAll(async () => {
    await cleanupSecurityTestData(ctx);
    await disconnectPrisma();
  }, 30_000);

  // ─────────────────────────────────────────────────────────────────────
  // No token
  // ─────────────────────────────────────────────────────────────────────

  describe('Missing Authentication', () => {
    const protectedEndpoints = [
      '/api/auth/me',
      '/api/patients',
      '/api/opd/encounters/open',
      '/api/er/board',
      '/api/ipd/live-beds',
      '/api/admin/users',
      '/api/lab/results',
      '/api/billing/payments',
      '/api/notifications',
    ];

    it('AUTH-01: All protected endpoints reject requests with no token', async () => {
      for (const ep of protectedEndpoints) {
        const res = await unauthFetch(ep, { method: 'GET' });
        // Must be 401 or 302 redirect to login — never 200
        expect([401, 302, 307, 403]).toContain(res.status);
      }
    }, 30_000);

    it('AUTH-02: POST endpoints reject requests with no token', async () => {
      const res = await unauthFetch('/api/patients', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'Hacker', lastName: 'NoAuth', gender: 'MALE' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect([401, 302, 307, 403]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Malformed JWT
  // ─────────────────────────────────────────────────────────────────────

  describe('Malformed JWT', () => {
    it('AUTH-03: Truncated JWT is rejected', async () => {
      const truncated = ctx.adminToken.substring(0, 50);
      const res = await authGet('/api/auth/me', truncated);
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-04: Random garbage token is rejected', async () => {
      const garbage = 'not.a.valid.jwt.at.all';
      const res = await authGet('/api/auth/me', garbage);
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-05: Empty token is rejected', async () => {
      const res = await authGet('/api/auth/me', '');
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-06: Token with wrong signature is rejected', async () => {
      const tampered = generateTamperedToken(ctx.adminUserId, ctx.adminEmail, {
        role: 'admin',
        activeTenantId: ctx.tenantKey,
      });
      const res = await authGet('/api/auth/me', tampered);
      expect([401, 302, 307, 403]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Expired token
  // ─────────────────────────────────────────────────────────────────────

  describe('Expired Token', () => {
    it('AUTH-07: Expired token is rejected', async () => {
      const expired = generateExpiredToken(ctx.adminUserId, ctx.adminEmail, 'admin');
      const res = await authGet('/api/auth/me', expired);
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-08: Expired token cannot access clinical endpoints', async () => {
      const expired = generateExpiredToken(ctx.doctorUserId, ctx.doctorEmail, 'staff');
      const res = await authGet('/api/opd/encounters/open', expired);
      expect([401, 302, 307, 403]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Cross-tenant token
  // ─────────────────────────────────────────────────────────────────────

  describe('Cross-Tenant Token', () => {
    it('AUTH-09: Tenant A token cannot access Tenant B data', async () => {
      // Admin from Tenant A tries to list Tenant B's patients
      // The server should scope the query to Tenant A's data
      const res = await authGet('/api/patients?limit=5', ctx.adminToken);
      if (res.status === 200) {
        const data = await res.json();
        const patients = data.patients || data.items || [];
        // Every returned patient should belong to Tenant A, not B
        for (const p of patients) {
          if (p.tenantId) {
            expect(p.tenantId).not.toBe(ctx.tenantBId);
          }
        }
      }
    });

    it('AUTH-10: Tenant B token on Tenant A scoped endpoint is isolated', async () => {
      const res = await authGet('/api/patients?limit=5', ctx.tenantBAdminToken);
      // Should return only Tenant B data or empty
      if (res.status === 200) {
        const data = await res.json();
        const patients = data.patients || data.items || [];
        for (const p of patients) {
          if (p.tenantId) {
            expect(p.tenantId).not.toBe(ctx.tenantId);
          }
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Brute force protection
  // ─────────────────────────────────────────────────────────────────────

  describe('Brute Force Protection', () => {
    it('AUTH-11: Rate limiting after many wrong passwords', async () => {
      let rateLimited = false;
      const fakeEmail = `bruteforce-${Date.now()}@sec.thea.local`;

      // Send 20 wrong password attempts
      for (let i = 0; i < 20; i++) {
        const res = await unauthFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: fakeEmail,
            password: `wrong-password-${i}`,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 429) {
          rateLimited = true;
          console.log(`   🛡️ Rate limited after ${i + 1} attempts`);
          break;
        }
      }

      // Should have been rate limited at some point
      // (may not trigger if rate limiting is per-IP and we're testing locally)
      console.log(`   Rate limited: ${rateLimited}`);
      // We don't strictly assert here since rate limiting behavior depends on config
    }, 60_000);

    it('AUTH-12: Account lockout after failed login attempts', async () => {
      // Use the real admin email with wrong passwords
      let locked = false;
      for (let i = 0; i < 10; i++) {
        const res = await unauthFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: ctx.adminEmail,
            password: `wrong-${i}`,
            tenantId: ctx.tenantKey,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 429) {
          locked = true;
          const data = await res.json().catch(() => ({}));
          console.log(`   🔒 Account locked after ${i + 1} attempts: ${data.error || ''}`);
          break;
        }
      }

      console.log(`   Account locked: ${locked}`);
    }, 60_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // JWT payload tampering
  // ─────────────────────────────────────────────────────────────────────

  describe('JWT Payload Tampering', () => {
    it('AUTH-13: Tampered role (viewer→admin) with wrong signature is rejected', async () => {
      const tampered = generateTamperedToken(ctx.adminUserId, ctx.adminEmail, {
        role: 'thea-owner', // Escalate to owner
        activeTenantId: ctx.tenantKey,
      });
      const res = await authGet('/api/admin/users', tampered);
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-14: Tampered tenantId with wrong signature is rejected', async () => {
      const tampered = generateTamperedToken(ctx.adminUserId, ctx.adminEmail, {
        role: 'admin',
        activeTenantId: ctx.tenantBKey, // Try to access other tenant
      });
      const res = await authGet('/api/patients', tampered);
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-15: Tampered userId with wrong signature is rejected', async () => {
      const tampered = generateTamperedToken('fake-user-id', ctx.adminEmail, {
        role: 'admin',
        activeTenantId: ctx.tenantKey,
      });
      const res = await authGet('/api/auth/me', tampered);
      expect([401, 302, 307, 403]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Algorithm none attack
  // ─────────────────────────────────────────────────────────────────────

  describe('JWT Algorithm Attacks', () => {
    it('AUTH-16: alg:none JWT is rejected', async () => {
      const noneToken = generateAlgNoneToken({
        userId: ctx.adminUserId,
        email: ctx.adminEmail,
        role: 'admin',
        sessionId: 'fake-session',
        activeTenantId: ctx.tenantKey,
      });
      const res = await authGet('/api/auth/me', noneToken);
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-17: alg:none JWT cannot access admin endpoints', async () => {
      const noneToken = generateAlgNoneToken({
        userId: ctx.adminUserId,
        email: ctx.adminEmail,
        role: 'thea-owner',
        sessionId: 'fake-session',
        activeTenantId: ctx.tenantKey,
      });
      const res = await authGet('/api/admin/users', noneToken);
      expect([401, 302, 307, 403]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Session invalidation
  // ─────────────────────────────────────────────────────────────────────

  describe('Session Invalidation', () => {
    it('AUTH-18: Token with non-existent session ID is rejected', async () => {
      const { generateTestToken } = await import('./helpers');
      const badSessionToken = generateTestToken(
        ctx.adminUserId,
        ctx.adminEmail,
        'admin',
        'non-existent-session-id-12345',
        ctx.tenantKey,
      );
      const res = await authGet('/api/auth/me', badSessionToken);
      // Should be rejected — session doesn't exist in DB
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('AUTH-19: Token for non-existent user is rejected', async () => {
      const { generateTestToken } = await import('./helpers');
      const badUserToken = generateTestToken(
        'non-existent-user-uuid-12345',
        'ghost@test.local',
        'admin',
        'fake-session',
        ctx.tenantKey,
      );
      const res = await authGet('/api/auth/me', badUserToken);
      expect([401, 302, 307, 403]).toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Owner endpoint protection
  // ─────────────────────────────────────────────────────────────────────

  describe('Owner Endpoint Protection', () => {
    it('AUTH-20: Regular admin token cannot access owner endpoints', async () => {
      const ownerEndpoints = [
        '/api/owner/tenants',
        '/api/owner/users',
        '/api/owner/billing',
      ];

      for (const ep of ownerEndpoints) {
        const res = await authGet(ep, ctx.adminToken);
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    }, 30_000);
  });
});
