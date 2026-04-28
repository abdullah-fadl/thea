/**
 * Security Tests — Injection Attacks
 *
 * Verifies the system is resistant to SQL injection, NoSQL injection,
 * XSS, command injection, and header injection attacks.
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
  authenticatedFetch,
  SQL_INJECTION_PAYLOADS,
  NOSQL_INJECTION_PAYLOADS,
  XSS_PAYLOADS,
  COMMAND_INJECTION_PAYLOADS,
  HEADER_INJECTION_PAYLOADS,
  BASE_URL,
  type SecurityTestContext,
} from './helpers';

let ctx: SecurityTestContext;

describe('Injection Attacks', () => {
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
  // SQL Injection
  // ─────────────────────────────────────────────────────────────────────

  describe('SQL Injection', () => {
    it('INJ-01: SQL injection in patient name search', async () => {
      for (const payload of SQL_INJECTION_PAYLOADS) {
        const res = await authGet(
          `/api/patients?search=${encodeURIComponent(payload)}`,
          ctx.adminToken,
        );
        // Must NOT return 500 (would indicate unescaped SQL)
        expect(res.status).not.toBe(500);

        if (res.status === 200) {
          const data = await res.json();
          const patients = data.patients || data.items || data.results || [];
          // SQL injection should NOT return ALL records
          if (Array.isArray(patients)) {
            // Injected query shouldn't return unreasonably many results
            expect(patients.length).toBeLessThan(1000);
          }
        }
      }
    }, 30_000);

    it('INJ-02: SQL injection in MRN search', async () => {
      for (const payload of SQL_INJECTION_PAYLOADS) {
        const res = await authGet(
          `/api/patients?search=${encodeURIComponent(payload)}&limit=10`,
          ctx.adminToken,
        );
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-03: SQL injection in lab results filter', async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 4)) {
        const res = await authGet(
          `/api/lab/results?search=${encodeURIComponent(payload)}`,
          ctx.doctorToken,
        );
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-04: SQL injection in scheduling search', async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 4)) {
        const res = await authGet(
          `/api/scheduling/slots?resourceId=${encodeURIComponent(payload)}&date=2026-01-01`,
          ctx.adminToken,
        );
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-05: SQL injection in POST body (patient creation)', async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 4)) {
        const res = await authPost('/api/patients', ctx.adminToken, {
          firstName: payload,
          lastName: payload,
          gender: 'MALE',
          dob: '1990-01-01',
        });
        // Should be 400 (validation) or 200 (sanitized) — never 500
        expect(res.status).not.toBe(500);
      }
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // NoSQL Injection
  // ─────────────────────────────────────────────────────────────────────

  describe('NoSQL Injection', () => {
    it('INJ-06: NoSQL injection in query parameters', async () => {
      for (const payload of NOSQL_INJECTION_PAYLOADS) {
        const serialized = JSON.stringify(payload);
        const res = await authGet(
          `/api/patients?search=${encodeURIComponent(serialized)}`,
          ctx.adminToken,
        );
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-07: NoSQL injection in POST body', async () => {
      for (const payload of NOSQL_INJECTION_PAYLOADS) {
        const res = await authPost('/api/patients', ctx.adminToken, {
          firstName: payload,
          lastName: 'Test',
          gender: 'MALE',
        });
        // Should reject or sanitize — never crash
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-08: NoSQL $gt operator in login password field', async () => {
      const res = await authPost('/api/auth/login', ctx.adminToken, {
        email: ctx.adminEmail,
        password: { $gt: '' },
        tenantId: ctx.tenantKey,
      });
      // Must NOT succeed with operator injection
      expect(res.status).not.toBe(500);
      if (res.status === 200) {
        const data = await res.json();
        expect(data.success).not.toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // XSS (Cross-Site Scripting)
  // ─────────────────────────────────────────────────────────────────────

  describe('XSS Prevention', () => {
    it('INJ-09: XSS in patient name — must sanitize or reject', async () => {
      for (const payload of XSS_PAYLOADS) {
        const res = await authPost('/api/patients', ctx.adminToken, {
          firstName: payload,
          lastName: 'XSSTest',
          gender: 'MALE',
          dob: '1990-01-01',
        });
        expect(res.status).not.toBe(500);

        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          const patient = data.patient || data;
          // If stored, the name must be sanitized (no raw <script> tags)
          if (patient?.firstName) {
            expect(patient.firstName).not.toContain('<script');
            expect(patient.firstName).not.toContain('onerror=');
            expect(patient.firstName).not.toContain('javascript:');
          }
        }
      }
    }, 30_000);

    it('INJ-10: XSS in clinical notes (SOAP notes)', async () => {
      for (const payload of XSS_PAYLOADS.slice(0, 5)) {
        const res = await authPost('/api/opd/encounters/fake-enc-id/visit-notes', ctx.doctorToken, {
          chiefComplaint: payload,
          assessment: payload,
          plan: payload,
        });
        // Should not crash — 400/404 is fine (fake encounter ID)
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-11: XSS in ER registration notes', async () => {
      for (const payload of XSS_PAYLOADS.slice(0, 5)) {
        const res = await authPost('/api/er/encounters/unknown', ctx.nurseToken, {
          fullName: payload,
          gender: 'MALE',
          arrivalMethod: 'WALK_IN',
          chiefComplaint: payload,
        });
        expect(res.status).not.toBe(500);

        if (res.status < 300) {
          const data = await res.json();
          const encounter = data.encounter || data;
          if (encounter?.fullName) {
            expect(encounter.fullName).not.toContain('<script');
          }
        }
      }
    }, 30_000);

    it('INJ-12: XSS in search query reflected in response', async () => {
      const xssPayload = '<script>alert(document.cookie)</script>';
      const res = await authGet(
        `/api/patients?search=${encodeURIComponent(xssPayload)}`,
        ctx.adminToken,
      );
      expect(res.status).not.toBe(500);

      // Response body should NEVER reflect the raw XSS payload
      const text = await res.text();
      expect(text).not.toContain('<script>alert(document.cookie)</script>');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Command Injection
  // ─────────────────────────────────────────────────────────────────────

  describe('Command Injection', () => {
    it('INJ-13: Command injection in attachment filename', async () => {
      for (const payload of COMMAND_INJECTION_PAYLOADS) {
        const res = await authPost('/api/attachments', ctx.doctorToken, {
          entityType: 'clinical_note',
          entityId: 'fake-entity-id',
          fileName: payload,
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          storageProvider: 'local_stub',
          storagePath: '/tmp/test.pdf',
        });
        // Must not execute the command — 400/422 is expected
        expect(res.status).not.toBe(500);
      }
    }, 30_000);

    it('INJ-14: Command injection in patient firstName', async () => {
      for (const payload of COMMAND_INJECTION_PAYLOADS.slice(0, 3)) {
        const res = await authPost('/api/patients', ctx.adminToken, {
          firstName: payload,
          lastName: 'CmdInjTest',
          gender: 'MALE',
          dob: '1990-01-01',
        });
        expect(res.status).not.toBe(500);
      }
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Header Injection
  // ─────────────────────────────────────────────────────────────────────

  describe('Header Injection', () => {
    it('INJ-15: CRLF injection in custom headers', async () => {
      for (const payload of HEADER_INJECTION_PAYLOADS) {
        try {
          const res = await authenticatedFetch('/api/auth/me', ctx.adminToken, {
            method: 'GET',
            headers: {
              'X-Custom-Header': payload,
            },
          });
          // Should not inject extra headers
          expect(res.headers.get('X-Injected')).toBeNull();
          expect(res.headers.get('Set-Cookie')).not.toContain('stolen=true');
        } catch {
          // Some HTTP libraries reject CRLF in headers — that's good
        }
      }
    });

    it('INJ-16: CRLF injection in query parameters', async () => {
      const payload = 'test%0d%0aX-Injected:%20true';
      const res = await authGet(`/api/patients?search=${payload}`, ctx.adminToken);
      expect(res.status).not.toBe(500);
      expect(res.headers.get('X-Injected')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // LDAP Injection (if applicable)
  // ─────────────────────────────────────────────────────────────────────

  describe('LDAP/Template Injection', () => {
    it('INJ-17: LDAP injection characters in search', async () => {
      const ldapPayloads = ['*)(uid=*))(|(uid=*', '*()|&=', 'admin)(|(password=*))'];
      for (const payload of ldapPayloads) {
        const res = await authGet(
          `/api/patients?search=${encodeURIComponent(payload)}`,
          ctx.adminToken,
        );
        expect(res.status).not.toBe(500);
      }
    });

    it('INJ-18: Template injection in user-supplied text', async () => {
      const templatePayloads = ['{{7*7}}', '${7*7}', '#{7*7}', '<%= 7*7 %>'];
      for (const payload of templatePayloads) {
        const res = await authPost('/api/patients', ctx.adminToken, {
          firstName: payload,
          lastName: 'TemplateTest',
          gender: 'MALE',
          dob: '1990-01-01',
        });
        expect(res.status).not.toBe(500);

        if (res.status < 300) {
          const data = await res.json();
          const patient = data.patient || data;
          // Template should NOT be evaluated
          if (patient?.firstName) {
            expect(patient.firstName).not.toBe('49'); // 7*7 evaluated
          }
        }
      }
    });
  });
});
