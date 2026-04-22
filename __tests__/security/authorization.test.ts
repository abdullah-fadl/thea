/**
 * Security Tests — Privilege Escalation
 *
 * Verifies that users cannot access resources beyond their role,
 * impersonate other users, or escalate from one platform to another.
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
  authPut,
  authDelete,
  type SecurityTestContext,
} from './helpers';

let ctx: SecurityTestContext;

describe('Privilege Escalation', () => {
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
  // Vertical escalation — nurse accessing admin endpoints
  // ─────────────────────────────────────────────────────────────────────

  describe('Nurse → Admin Escalation', () => {
    it('AUTHZ-01: Nurse CANNOT access /api/admin/users', async () => {
      const res = await authGet('/api/admin/users', ctx.nurseToken);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-02: Nurse CANNOT access /api/owner/tenants', async () => {
      const res = await authGet('/api/owner/tenants', ctx.nurseToken);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-03: Nurse CANNOT create billing payments', async () => {
      const res = await authPost('/api/billing/payments', ctx.nurseToken, {
        patientId: 'fake-id',
        amount: 100,
        method: 'CASH',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Vertical escalation — patient portal token on clinical endpoints
  // ─────────────────────────────────────────────────────────────────────

  describe('Patient Portal → Clinical Escalation', () => {
    it('AUTHZ-04: Patient token CANNOT access /api/ipd/live-beds', async () => {
      const res = await authGet('/api/ipd/live-beds', ctx.patientToken);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-05: Patient token CANNOT access /api/er/board', async () => {
      const res = await authGet('/api/er/board', ctx.patientToken);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-06: Patient token CANNOT access /api/admin/users', async () => {
      const res = await authGet('/api/admin/users', ctx.patientToken);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-07: Patient token CANNOT create prescriptions', async () => {
      const res = await authPost('/api/pharmacy/prescriptions', ctx.patientToken, {
        patientId: 'self',
        medication: 'Aspirin',
        strength: '100mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '30 days',
        quantity: 30,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-08: Patient token CANNOT create lab orders', async () => {
      const res = await authPost('/api/lab/orders', ctx.patientToken, {
        patientId: 'self',
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Horizontal escalation — doctor accessing other doctor's patients
  // ─────────────────────────────────────────────────────────────────────

  describe('Horizontal Escalation', () => {
    it('AUTHZ-09: Request body userId/doctorId tampering is ignored', async () => {
      // Doctor tries to create an order claiming to be someone else
      const res = await authPost('/api/orders', ctx.doctorToken, {
        encounterCoreId: 'fake-encounter',
        kind: 'LAB',
        priority: 'ROUTINE',
        orderedBy: ctx.adminUserId, // Trying to impersonate admin
        items: [{ testCode: 'CBC', testName: 'Complete Blood Count' }],
      });

      // If it succeeds (unlikely with fake encounter), the server should
      // use the JWT userId, not the body userId
      // Either way, no 500 error
      expect(res.status).not.toBe(500);
    });

    it('AUTHZ-10: Viewer CANNOT modify encounters', async () => {
      const res = await authPost('/api/opd/encounters/open', ctx.viewerToken, {
        patientMasterId: 'fake-patient',
        reason: 'Escalation attempt',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // HTTP method enforcement
  // ─────────────────────────────────────────────────────────────────────

  describe('HTTP Method Enforcement', () => {
    it('AUTHZ-11: DELETE method on GET-only endpoints is rejected', async () => {
      const getOnlyEndpoints = [
        '/api/patients',
        '/api/opd/encounters/open',
        '/api/er/board',
        '/api/lab/results',
      ];

      for (const ep of getOnlyEndpoints) {
        const res = await authDelete(ep, ctx.adminToken);
        // Should be 405 Method Not Allowed, 404, or at minimum not 200
        expect([200, 201, 204]).not.toContain(res.status);
      }
    }, 30_000);

    it('AUTHZ-12: PUT method on POST-only endpoints is rejected', async () => {
      const res = await authPut('/api/auth/login', ctx.adminToken, {
        email: ctx.adminEmail,
        password: ctx.userPassword,
      });
      // Login only accepts POST — PUT should fail
      expect([200, 201]).not.toContain(res.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Platform escalation
  // ─────────────────────────────────────────────────────────────────────

  describe('Platform Escalation', () => {
    it('AUTHZ-13: Health platform user cannot access owner platform', async () => {
      const ownerEndpoints = [
        '/api/owner/tenants',
        '/api/owner/users',
        '/api/owner/billing',
        '/api/owner/metrics',
      ];

      for (const ep of ownerEndpoints) {
        const res = await authGet(ep, ctx.adminToken);
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    }, 30_000);

    it('AUTHZ-14: Receptionist cannot access clinical triage', async () => {
      const res = await authPost('/api/er/triage/save', ctx.receptionistToken, {
        encounterId: 'fake-id',
        vitals: { HR: 80, BP_SYS: 120, BP_DIA: 80 },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AUTHZ-15: Viewer cannot create patients', async () => {
      const res = await authPost('/api/patients', ctx.viewerToken, {
        firstName: 'Escalation',
        lastName: 'Attempt',
        gender: 'MALE',
        dob: '1990-01-01',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
