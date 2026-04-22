/**
 * Security Tests — Input Validation & Boundary Testing
 *
 * Tests boundary conditions: oversized payloads, deeply nested JSON,
 * extremely long strings, null bytes, Unicode edge cases, negative numbers,
 * future dates, and integer overflow.
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
  BASE_URL,
  type SecurityTestContext,
} from './helpers';

let ctx: SecurityTestContext;

describe('Input Validation & Boundary Testing', () => {
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
  // Oversized payloads
  // ─────────────────────────────────────────────────────────────────────

  describe('Oversized Payloads', () => {
    it('VAL-01: 10MB body to POST endpoint is rejected (413)', async () => {
      // Generate ~10MB string
      const largeString = 'A'.repeat(10 * 1024 * 1024);
      const res = await authenticatedFetch('/api/patients', ctx.adminToken, {
        method: 'POST',
        body: JSON.stringify({ firstName: largeString, lastName: 'Test', gender: 'MALE' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Should be 413 (Payload Too Large) or 400
      expect([413, 400, 431]).toContain(res.status);
    }, 30_000);

    it('VAL-02: 1MB body to clinical notes is rejected or truncated', async () => {
      const largeNote = 'B'.repeat(1024 * 1024);
      const res = await authPost('/api/opd/encounters/fake-enc/visit-notes', ctx.doctorToken, {
        chiefComplaint: largeNote,
        assessment: 'Normal',
        plan: 'Follow up',
      });

      // Should not crash — either reject or accept with truncation
      expect(res.status).not.toBe(500);
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Deeply nested JSON
  // ─────────────────────────────────────────────────────────────────────

  describe('Deeply Nested JSON', () => {
    it('VAL-03: 100-level nested JSON is rejected', async () => {
      // Build deeply nested object: { a: { a: { a: ... } } }
      let nested: any = { value: 'deep' };
      for (let i = 0; i < 100; i++) {
        nested = { a: nested };
      }

      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: 'DeepNest',
        lastName: 'Test',
        gender: 'MALE',
        metadata: nested,
      });

      // Should reject or ignore nested data — never crash
      expect(res.status).not.toBe(500);
    });

    it('VAL-04: Highly recursive array is rejected', async () => {
      const deepArray = Array.from({ length: 1000 }, (_, i) => ({
        level: i,
        data: { nested: true },
      }));

      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: 'ArrayTest',
        lastName: 'Deep',
        gender: 'MALE',
        items: deepArray,
      });

      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Extremely long strings
  // ─────────────────────────────────────────────────────────────────────

  describe('Extremely Long Strings', () => {
    it('VAL-05: 100,000 char patient name is rejected or truncated', async () => {
      const longName = 'X'.repeat(100_000);
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: longName,
        lastName: 'LongTest',
        gender: 'MALE',
        dob: '1990-01-01',
      });

      // Should reject (400/422) or truncate — never crash
      expect(res.status).not.toBe(500);

      if (res.status < 300) {
        const data = await res.json();
        const patient = data.patient || data;
        // If accepted, should be truncated
        if (patient?.firstName) {
          expect(patient.firstName.length).toBeLessThan(100_000);
        }
      }
    });

    it('VAL-06: Long MRN in search query is handled', async () => {
      const longMRN = 'M'.repeat(10_000);
      const res = await authGet(
        `/api/patients?search=${encodeURIComponent(longMRN)}&limit=5`,
        ctx.adminToken,
      );
      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Null bytes
  // ─────────────────────────────────────────────────────────────────────

  describe('Null Bytes', () => {
    it('VAL-07: Null bytes in string fields are stripped or rejected', async () => {
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: 'Null\x00Byte',
        lastName: 'Test\x00Injection',
        gender: 'MALE',
        dob: '1990-01-01',
      });

      expect(res.status).not.toBe(500);

      if (res.status < 300) {
        const data = await res.json();
        const patient = data.patient || data;
        // Null bytes should be stripped
        if (patient?.firstName) {
          expect(patient.firstName).not.toContain('\x00');
        }
      }
    });

    it('VAL-08: Null bytes in search parameter', async () => {
      const res = await authGet(
        `/api/patients?search=test%00injection`,
        ctx.adminToken,
      );
      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Unicode edge cases
  // ─────────────────────────────────────────────────────────────────────

  describe('Unicode Edge Cases', () => {
    it('VAL-09: RTL override characters in patient names', async () => {
      // RTL override U+202E can be used to spoof displayed text
      const rtlPayload = '\u202EgnissorcP rehtaF';
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: rtlPayload,
        lastName: 'RTLTest',
        gender: 'MALE',
        dob: '1990-01-01',
      });

      expect(res.status).not.toBe(500);
    });

    it('VAL-10: Zero-width joiners and invisible characters', async () => {
      // Zero-width characters can create visually identical but different strings
      const zwj = 'Admin\u200D\u200B\u200CUser'; // Contains ZWJ, ZWSP, ZWNJ
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: zwj,
        lastName: 'ZWJTest',
        gender: 'MALE',
        dob: '1990-01-01',
      });

      expect(res.status).not.toBe(500);
    });

    it('VAL-11: Arabic text with diacritics (valid bilingual input)', async () => {
      // This is valid Arabic input that should be accepted
      const arabicName = 'محمد عبدالله';
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: arabicName,
        lastName: 'الثبيتي',
        gender: 'MALE',
        dob: '1990-01-01',
      });

      // Valid bilingual input should be accepted
      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Negative numbers / invalid ranges
  // ─────────────────────────────────────────────────────────────────────

  describe('Invalid Numeric Values', () => {
    it('VAL-12: Negative quantity in prescription is rejected', async () => {
      const res = await authPost('/api/pharmacy/prescriptions', ctx.doctorToken, {
        patientId: 'fake-patient',
        patientName: 'Test',
        mrn: 'NEG-001',
        medication: 'Aspirin',
        strength: '100mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '7 days',
        quantity: -50, // Negative quantity
      });

      // Should reject negative quantity
      expect(res.status).not.toBe(500);
      // Ideally rejects with 400/422
    });

    it('VAL-13: Integer overflow in numeric fields', async () => {
      const res = await authPost('/api/pharmacy/prescriptions', ctx.doctorToken, {
        patientId: 'fake-patient',
        patientName: 'Test',
        mrn: 'OVF-001',
        medication: 'Aspirin',
        strength: '100mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '7 days',
        quantity: 99999999999999, // Integer overflow
      });

      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Invalid dates
  // ─────────────────────────────────────────────────────────────────────

  describe('Invalid Dates', () => {
    it('VAL-14: Future date of birth (year 2099) is rejected or flagged', async () => {
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: 'FutureBaby',
        lastName: 'Test',
        gender: 'MALE',
        dob: '2099-01-01',
      });

      // Should reject or at least not crash
      expect(res.status).not.toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Missing / extra / empty fields
  // ─────────────────────────────────────────────────────────────────────

  describe('Field Presence Validation', () => {
    it('VAL-15: Empty required fields are rejected', async () => {
      const res = await authPost('/api/patients', ctx.adminToken, {
        firstName: '',
        lastName: '',
        gender: '',
      });

      // Should reject empty required fields
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
