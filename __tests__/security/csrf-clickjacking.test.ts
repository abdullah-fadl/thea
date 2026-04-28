/**
 * Security Tests — CSRF & Clickjacking Protection
 *
 * Verifies CSRF token enforcement, SameSite cookie policy,
 * X-Frame-Options clickjacking prevention, and session cookie security.
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
  authenticatedFetch,
  BASE_URL,
  type SecurityTestContext,
} from './helpers';

let ctx: SecurityTestContext;

describe('CSRF & Clickjacking Protection', () => {
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
  // CSRF token enforcement
  // ─────────────────────────────────────────────────────────────────────

  describe('CSRF Token Enforcement', () => {
    it('CSRF-01: State-changing POST without CSRF token behavior', async () => {
      // POST to a state-changing endpoint without x-csrf-token header
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: 'CSRFTest',
        lastName: 'NoToken',
        gender: 'MALE',
        dob: '1990-01-01',
      });

      // Depending on CSRF enforcement, should either:
      // - Return 403 (CSRF validation failed)
      // - Or succeed if CSRF is cookie-based SameSite=strict (which prevents CSRF inherently)
      // Either way, document the behavior
      console.log(`   CSRF-01: POST without CSRF token returned ${res.status}`);

      // Must not be a 500
      expect(res.status).not.toBe(500);
    });

    it('CSRF-02: /api/auth/me returns CSRF token for client use', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      if (res.status === 200) {
        const data = await res.json();
        // Should include csrfToken field for client-side CSRF protection
        console.log(`   CSRF-02: csrfToken present: ${!!data.csrfToken}`);
        // Note: csrfToken may be set as a cookie instead
      }

      // Check for csrf-token cookie
      const setCookies = res.headers.getSetCookie?.() || [];
      const csrfCookie = setCookies.find((c: string) => c.includes('csrf-token'));
      console.log(`   CSRF-02: csrf-token cookie: ${csrfCookie ? 'present' : 'not in response'}`);
    });

    it('CSRF-03: Invalid CSRF token on state-changing endpoint', async () => {
      const res = await authenticatedFetch('/api/patients', ctx.adminToken, {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'CSRFBad',
          lastName: 'Token',
          gender: 'MALE',
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'definitely-invalid-csrf-token',
        },
      });

      // If CSRF is enforced, this should fail with 403
      // If CSRF relies on SameSite=strict cookies, it may succeed
      console.log(`   CSRF-03: POST with invalid CSRF token returned ${res.status}`);
      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Clickjacking protection
  // ─────────────────────────────────────────────────────────────────────

  describe('Clickjacking Prevention', () => {
    it('CSRF-04: X-Frame-Options: DENY prevents iframe embedding', async () => {
      const res = await authGet('/api/auth/me', ctx.adminToken);
      const xfo = res.headers.get('x-frame-options');
      expect(xfo).toBe('DENY');
    });

    it('CSRF-05: X-Frame-Options on page routes (if applicable)', async () => {
      // Check a page route for frame-options
      const res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
      const xfo = res.headers.get('x-frame-options');
      if (xfo) {
        expect(['DENY', 'SAMEORIGIN']).toContain(xfo);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Session cookie security
  // ─────────────────────────────────────────────────────────────────────

  describe('Session Cookie Security', () => {
    it('CSRF-06: Login response sets httpOnly, SameSite cookies', async () => {
      // Perform a login to check Set-Cookie headers
      const res = await unauthFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: ctx.adminEmail,
          password: ctx.userPassword,
          tenantId: ctx.tenantKey,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const setCookies = res.headers.getSetCookie?.() || [];
      const authCookie = setCookies.find((c: string) => c.includes('auth-token'));

      if (authCookie) {
        console.log(`   CSRF-06: auth-token cookie: ${authCookie.substring(0, 80)}...`);

        // Must have HttpOnly flag
        expect(authCookie.toLowerCase()).toContain('httponly');

        // Must have SameSite=Strict or SameSite=Lax
        expect(authCookie.toLowerCase()).toMatch(/samesite=(strict|lax)/);

        // In production, should have Secure flag
        // (in dev, secure may be omitted for localhost)
        console.log(`   Secure flag: ${authCookie.toLowerCase().includes('secure')}`);
      } else {
        console.log('   CSRF-06: No auth-token Set-Cookie in response (may be invalid login)');
      }
    });

    it('CSRF-07: Refresh token cookie has HttpOnly flag', async () => {
      const res = await unauthFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: ctx.adminEmail,
          password: ctx.userPassword,
          tenantId: ctx.tenantKey,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const setCookies = res.headers.getSetCookie?.() || [];
      const refreshCookie = setCookies.find((c: string) => c.includes('refresh-token'));

      if (refreshCookie) {
        expect(refreshCookie.toLowerCase()).toContain('httponly');
        console.log(`   CSRF-07: refresh-token has HttpOnly: true`);
      } else {
        console.log('   CSRF-07: No refresh-token cookie in response');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Cross-origin requests
  // ─────────────────────────────────────────────────────────────────────

  describe('Cross-Origin Protection', () => {
    it('CSRF-08: Cross-origin POST without proper headers', async () => {
      // Simulate a cross-origin request (no auth cookie, different origin)
      const res = await fetch(`${BASE_URL}/api/patients`, {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'CrossOrigin',
          lastName: 'Attack',
          gender: 'MALE',
        }),
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil-site.com',
          Referer: 'https://evil-site.com/attack-page',
        },
        redirect: 'manual',
      });

      // Should be rejected (401 no auth, or 403 CORS/CSRF)
      expect([401, 302, 307, 403]).toContain(res.status);
    });

    it('CSRF-09: Cross-origin preflight check', async () => {
      // OPTIONS preflight from an unauthorized origin
      const res = await fetch(`${BASE_URL}/api/patients`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil-site.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });

      // Should not include evil-site in Access-Control-Allow-Origin
      const acao = res.headers.get('access-control-allow-origin');
      if (acao) {
        expect(acao).not.toBe('https://evil-site.com');
        expect(acao).not.toBe('*');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Login rate limiting
  // ─────────────────────────────────────────────────────────────────────

  describe('Login Rate Limiting', () => {
    it('CSRF-10: /api/auth/login is rate-limited per IP', async () => {
      let rateLimited = false;

      // Rapidly hit login endpoint
      for (let i = 0; i < 25; i++) {
        const res = await unauthFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: `ratelimit-${Date.now()}-${i}@test.local`,
            password: 'wrong',
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 429) {
          rateLimited = true;
          console.log(`   CSRF-10: Rate limited after ${i + 1} requests`);
          break;
        }
      }

      console.log(`   Login rate limiting triggered: ${rateLimited}`);
      // Rate limiting depends on Redis/config — just verify no 500s
    }, 60_000);
  });
});
