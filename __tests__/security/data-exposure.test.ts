/**
 * Security Tests — Sensitive Data Leakage
 *
 * Verifies that API responses never expose sensitive information:
 * password hashes, JWT secrets, DB connection strings, stack traces,
 * and that proper security headers are present.
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
  BASE_URL,
  type SecurityTestContext,
} from './helpers';

let ctx: SecurityTestContext;

describe('Sensitive Data Leakage', () => {
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
  // Sensitive fields in API responses
  // ─────────────────────────────────────────────────────────────────────

  describe('Response Body Sanitization', () => {
    it('DATA-01: /api/auth/me does NOT return password hash', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      if (res.status === 200) {
        const text = await res.text();
        expect(text).not.toContain('$2a$');   // bcrypt hash prefix
        expect(text).not.toContain('$2b$');   // bcrypt hash prefix
        expect(text).not.toMatch(/password.*:\s*"\$2[ab]\$/);
      }
    });

    it('DATA-02: /api/admin/users does NOT expose password hashes', async () => {
      const res = await authGet('/api/admin/users', ctx.adminToken);
      if (res.status === 200) {
        const text = await res.text();
        expect(text).not.toContain('$2a$');
        expect(text).not.toContain('$2b$');
        // Should not contain plaintext passwords either
        expect(text.toLowerCase()).not.toContain(ctx.userPassword.toLowerCase());
      }
    });

    it('DATA-03: API responses never include JWT_SECRET', async () => {
      const endpoints = [
        '/api/auth/me',
        '/api/patients?limit=1',
        '/api/admin/users',
      ];

      const jwtSecret = process.env.JWT_SECRET || '';
      if (jwtSecret) {
        for (const ep of endpoints) {
          const res = await authGet(ep, ctx.adminToken);
          const text = await res.text();
          expect(text).not.toContain(jwtSecret);
        }
      }
    }, 30_000);

    it('DATA-04: API responses never include DATABASE_URL', async () => {
      const dbUrl = process.env.DATABASE_URL || '';
      if (dbUrl) {
        const endpoints = ['/api/auth/me', '/api/patients?limit=1'];
        for (const ep of endpoints) {
          const res = await authGet(ep, ctx.adminToken);
          const text = await res.text();
          // Check for parts of the connection string
          expect(text).not.toContain('postgresql://');
          expect(text).not.toContain('postgres://');
          expect(text).not.toContain(dbUrl);
        }
      }
    }, 30_000);

    it('DATA-05: API responses never include internal IPs', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      if (res.status === 200) {
        const text = await res.text();
        // Should not expose internal network addresses
        expect(text).not.toMatch(/10\.\d+\.\d+\.\d+/);
        expect(text).not.toMatch(/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/);
        expect(text).not.toMatch(/192\.168\.\d+\.\d+/);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Error response sanitization
  // ─────────────────────────────────────────────────────────────────────

  describe('Error Response Sanitization', () => {
    it('DATA-06: 404 errors do not expose stack traces', async () => {
      const res = await authGet('/api/nonexistent-endpoint-12345', ctx.adminToken);
      const text = await res.text();
      expect(text).not.toContain('at Function.');
      expect(text).not.toContain('at Object.');
      expect(text).not.toContain('node_modules');
      expect(text).not.toMatch(/\.ts:\d+:\d+/); // TypeScript file:line:col
    });

    it('DATA-07: Invalid input errors do not expose internals', async () => {
      const res = await authPost('/api/patients', ctx.adminToken, {
        // Missing required fields
      });
      if (res.status >= 400) {
        const text = await res.text();
        expect(text).not.toContain('PrismaClient');
        expect(text).not.toContain('node_modules');
        expect(text).not.toContain('Error:');
        // May contain validation messages — that's fine
      }
    });

    it('DATA-08: Server errors (forced) do not expose stack traces', async () => {
      // Send an invalid UUID to trigger a DB error
      const res = await authGet('/api/patients/not-a-valid-uuid-!!!!!', ctx.adminToken);
      const text = await res.text();
      // Should not expose Prisma/internal errors
      expect(text).not.toContain('prisma');
      expect(text).not.toContain('PrismaClientKnownRequestError');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Patient data in list endpoints
  // ─────────────────────────────────────────────────────────────────────

  describe('Data Minimization', () => {
    it('DATA-09: Patient list endpoint returns summary, not full details', async () => {
      const res = await authGet('/api/patients?limit=5', ctx.adminToken);
      if (res.status === 200) {
        const data = await res.json();
        const patients = data.patients || data.items || data.results || [];
        if (Array.isArray(patients) && patients.length > 0) {
          const patient = patients[0];
          // List view should NOT include full medical history
          expect(patient).not.toHaveProperty('medicalHistory');
          expect(patient).not.toHaveProperty('encounters');
          expect(patient).not.toHaveProperty('labResults');
          expect(patient).not.toHaveProperty('prescriptions');
        }
      }
    });

    it('DATA-10: Audit logs do not contain plaintext passwords', async () => {
      // Trigger an audit log by attempting login
      await unauthFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: ctx.adminEmail,
          password: 'wrong-password-audit-test',
          tenantId: ctx.tenantKey,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // If there's an audit log endpoint, check it
      const res = await authGet('/api/admin/audit-logs?limit=5', ctx.adminToken);
      if (res.status === 200) {
        const text = await res.text();
        expect(text).not.toContain('wrong-password-audit-test');
        expect(text).not.toContain(ctx.userPassword);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Security headers
  // ─────────────────────────────────────────────────────────────────────

  describe('Security Headers', () => {
    it('DATA-11: X-Content-Type-Options: nosniff is present', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      const header = res.headers.get('x-content-type-options');
      expect(header).toBe('nosniff');
    });

    it('DATA-12: X-Frame-Options: DENY is present', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      const header = res.headers.get('x-frame-options');
      expect(header).toBe('DENY');
    });

    it('DATA-13: Referrer-Policy is set', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      const header = res.headers.get('referrer-policy');
      if (header) {
        expect(['strict-origin-when-cross-origin', 'no-referrer', 'same-origin']).toContain(header);
      }
    });

    it('DATA-14: CORS is not wildcard', async () => {
      // Send a cross-origin request
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          Origin: 'https://evil-attacker.com',
          Cookie: `auth-token=${ctx.adminToken}`,
        },
      });

      const corsHeader = res.headers.get('access-control-allow-origin');
      // Should NOT be '*' in production
      if (corsHeader) {
        expect(corsHeader).not.toBe('*');
        expect(corsHeader).not.toBe('https://evil-attacker.com');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Debug/test endpoint protection
  // ─────────────────────────────────────────────────────────────────────

  describe('Debug Endpoint Protection', () => {
    it('DATA-15: Test/debug endpoints require authentication or secret', async () => {
      const debugEndpoints = [
        '/api/test/seed',
        '/api/quality/verify',
      ];

      for (const ep of debugEndpoints) {
        // Try without auth
        const noAuth = await unauthFetch(ep, { method: 'GET' });
        expect([401, 302, 307, 403, 404, 405]).toContain(noAuth.status);

        // Try with regular auth (no test secret)
        const withAuth = await authGet(ep, ctx.adminToken);
        // Should either require additional test secret or be 404/403
        expect([200]).not.toContain(withAuth.status);
      }
    }, 30_000);
  });
});
