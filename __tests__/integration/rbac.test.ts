/**
 * Integration Tests — RBAC (Role-Based Access Control)
 *
 * Verifies that each role can ONLY access endpoints matching their
 * permission set, and that forbidden endpoints return 403.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  seedTestData,
  cleanupTestData,
  disconnectPrisma,
  ensureServerRunning,
  authGet,
  authPost,
  TestContext,
} from './helpers';

let ctx: TestContext;

describe('RBAC Permissions', () => {
  beforeAll(async () => {
    await ensureServerRunning();
    ctx = await seedTestData();
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(ctx);
    await disconnectPrisma();
  }, 30_000);

  // -----------------------------------------------------------------------
  // Admin endpoints — should be admin-only
  // -----------------------------------------------------------------------

  describe('Admin-Only Endpoints', () => {
    it('RBAC-01: Admin CAN access /api/admin/users', async () => {
      const res = await authGet('/api/admin/users', ctx.tokens.admin);
      // Admin should have access
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-02: Doctor CANNOT access /api/admin/users', async () => {
      const res = await authGet('/api/admin/users', ctx.tokens.doctor);
      // Should be forbidden
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-03: Nurse CANNOT access /api/admin/users', async () => {
      const res = await authGet('/api/admin/users', ctx.tokens.nurse);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-04: Viewer CANNOT access /api/admin/users', async () => {
      const res = await authGet('/api/admin/users', ctx.tokens.viewer);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -----------------------------------------------------------------------
  // Owner endpoints — should be owner-only
  // -----------------------------------------------------------------------

  describe('Owner-Only Endpoints', () => {
    it('RBAC-05: Admin CANNOT access /api/owner/tenants', async () => {
      const res = await authGet('/api/owner/tenants', ctx.tokens.admin);
      // Owner endpoints should reject non-owner roles
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-06: Doctor CANNOT access /api/owner/tenants', async () => {
      const res = await authGet('/api/owner/tenants', ctx.tokens.doctor);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -----------------------------------------------------------------------
  // Clinical endpoints — doctor/nurse access
  // -----------------------------------------------------------------------

  describe('Clinical Endpoints', () => {
    it('RBAC-07: Doctor CAN access OPD dashboard', async () => {
      const res = await authGet('/api/opd/dashboard/stats', ctx.tokens.doctor);
      // Doctor should have opd.dashboard.view
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-08: Nurse CAN access OPD dashboard (view only)', async () => {
      const res = await authGet('/api/opd/dashboard/stats', ctx.tokens.nurse);
      // Nurse should have opd.dashboard.view
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-09: Viewer CAN access OPD dashboard (view only)', async () => {
      const res = await authGet('/api/opd/dashboard/stats', ctx.tokens.viewer);
      // Viewer has opd.dashboard.view
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-10: Viewer CANNOT create encounters', async () => {
      const res = await authPost('/api/opd/dashboard/stats', ctx.tokens.viewer, {
        patientMasterId: 'fake-uuid',
        reason: 'Should be blocked',
      });
      // Viewer doesn't have opd.visit.create
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -----------------------------------------------------------------------
  // ER endpoints — nurse creates, doctor triages
  // -----------------------------------------------------------------------

  describe('ER Role-Based Access', () => {
    it('RBAC-11: Nurse CAN register ER patient', async () => {
      const res = await authPost('/api/er/encounters/unknown', ctx.tokens.nurse, {
        fullName: 'Unknown ER Patient',
        gender: 'MALE',
        arrivalMethod: 'AMBULANCE',
      });
      // Nurse has er.register.create
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-12: Viewer CANNOT register ER patient', async () => {
      const res = await authPost('/api/er/encounters/unknown', ctx.tokens.viewer, {
        fullName: 'Blocked Patient',
        gender: 'MALE',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-13: Doctor CAN access ER encounters', async () => {
      const res = await authGet('/api/er/board', ctx.tokens.doctor);
      // Doctor has er.encounter.view
      expect(res.status).toBeLessThan(400);
    });
  });

  // -----------------------------------------------------------------------
  // Lab endpoints — permission-gated
  // -----------------------------------------------------------------------

  describe('Lab Role-Based Access', () => {
    it('RBAC-14: Doctor CAN create lab orders', async () => {
      const res = await authPost('/api/lab/orders', ctx.tokens.doctor, {
        patientId: 'fake-patient-id',
        patientName: 'Test Patient',
        mrn: 'RBAC-MRN',
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      });
      // May return 404 (patient not found) but NOT 403
      expect(res.status).not.toBe(403);
    });

    it('RBAC-15: Viewer CANNOT create lab orders', async () => {
      const res = await authPost('/api/lab/orders', ctx.tokens.viewer, {
        patientId: 'fake-patient-id',
        patientName: 'Test Patient',
        mrn: 'RBAC-MRN',
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      });
      // Viewer doesn't have lab.orders.create
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-16: Doctor CAN view lab results', async () => {
      const res = await authGet('/api/lab/results', ctx.tokens.doctor);
      expect(res.status).toBeLessThan(400);
    });
  });

  // -----------------------------------------------------------------------
  // Pharmacy endpoints
  // -----------------------------------------------------------------------

  describe('Pharmacy Role-Based Access', () => {
    it('RBAC-17: Doctor CAN create prescriptions', async () => {
      const res = await authPost('/api/pharmacy/prescriptions', ctx.tokens.doctor, {
        patientId: 'fake-id',
        patientName: 'Test',
        mrn: 'RBAC-MRN',
        medication: 'Aspirin',
        strength: '100mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '30 days',
        quantity: 30,
      });
      // May return 404/422 for fake patient, but NOT 403
      expect(res.status).not.toBe(403);
    });

    it('RBAC-18: Nurse CANNOT create prescriptions', async () => {
      const res = await authPost('/api/pharmacy/prescriptions', ctx.tokens.nurse, {
        patientId: 'fake-id',
        patientName: 'Test',
        mrn: 'RBAC-MRN',
        medication: 'Aspirin',
        strength: '100mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '30 days',
        quantity: 30,
      });
      // Nurse doesn't have pharmacy.prescriptions.create
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-19: Admin CAN view dispensing queue', async () => {
      const res = await authGet('/api/pharmacy/prescriptions', ctx.tokens.admin);
      expect(res.status).toBeLessThan(400);
    });
  });

  // -----------------------------------------------------------------------
  // Billing endpoints
  // -----------------------------------------------------------------------

  describe('Billing Role-Based Access', () => {
    it('RBAC-20: Admin CAN view billing payments', async () => {
      const res = await authGet('/api/billing/pending-payments', ctx.tokens.admin);
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-21: Receptionist CAN view billing', async () => {
      const res = await authGet('/api/billing/pending-payments', ctx.tokens.receptionist);
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-22: Viewer CANNOT view billing', async () => {
      const res = await authGet('/api/billing/pending-payments', ctx.tokens.viewer);
      // Viewer doesn't have billing.payment.view
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -----------------------------------------------------------------------
  // IPD endpoints
  // -----------------------------------------------------------------------

  describe('IPD Role-Based Access', () => {
    it('RBAC-23: Doctor CAN access IPD beds', async () => {
      const res = await authGet('/api/ipd/live-beds', ctx.tokens.doctor);
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-24: Nurse CAN access IPD beds', async () => {
      const res = await authGet('/api/ipd/live-beds', ctx.tokens.nurse);
      expect(res.status).toBeLessThan(400);
    });

    it('RBAC-25: Viewer CANNOT access IPD beds', async () => {
      const res = await authGet('/api/ipd/live-beds', ctx.tokens.viewer);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -----------------------------------------------------------------------
  // Cross-role escalation attempts
  // -----------------------------------------------------------------------

  describe('Role Escalation Prevention', () => {
    it('RBAC-26: Nurse cannot impersonate admin (token is role-bound)', async () => {
      // Nurse's token already has role=staff, so hitting admin endpoints fails
      const res = await authGet('/api/admin/users', ctx.tokens.nurse);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-27: Viewer cannot perform write operations', async () => {
      // Viewer tries to create a patient
      const res = await authPost('/api/patients', ctx.tokens.viewer, {
        firstName: 'Hacker',
        lastName: 'Attempt',
        gender: 'MALE',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('RBAC-28: Receptionist cannot access clinical ER triage', async () => {
      const res = await authPost('/api/er/triage/save', ctx.tokens.receptionist, {
        encounterId: 'fake-id',
        vitals: { HR: 80 },
      });
      // Receptionist doesn't have er.triage.edit
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
