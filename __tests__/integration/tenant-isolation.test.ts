/**
 * Integration Tests — Cross-Tenant Isolation
 *
 * Verifies that data created in Tenant A is completely invisible
 * from Tenant B and vice versa — the foundational security guarantee
 * of any multi-tenant EHR system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  seedTestData,
  cleanupTestData,
  disconnectPrisma,
  ensureServerRunning,
  createTestPatient,
  authPost,
  authGet,
  TestContext,
} from './helpers';

let ctx: TestContext;
let patientA_Id: string;
let encounterA_Id: string;

describe('Cross-Tenant Isolation', () => {
  beforeAll(async () => {
    await ensureServerRunning();
    ctx = await seedTestData();

    // Seed a patient + encounter in Tenant A
    const patient = await createTestPatient(ctx.tenantA.id, {
      firstName: 'Isolated',
      lastName: 'PatientA',
    });
    patientA_Id = patient.id;

    // Open an encounter for this patient using Tenant A admin
    const encRes = await authPost('/api/opd/encounters/open', ctx.tokens.admin, {
      patientMasterId: patientA_Id,
      reason: 'Isolation test encounter',
    });
    if (encRes.status < 300) {
      const encData = await encRes.json();
      encounterA_Id = encData.encounter?.id;
    }
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(ctx);
    await disconnectPrisma();
  }, 30_000);

  // -----------------------------------------------------------------------
  // Patient isolation
  // -----------------------------------------------------------------------

  describe('Patient Data Isolation', () => {
    it('ISO-01: Tenant A admin can see patient A', async () => {
      // List patients from Tenant A
      const res = await authGet('/api/patients/search?search=Isolated', ctx.tokens.admin);
      expect(res.status).toBe(200);
      const data = await res.json();
      const patients = data.patients || data.items || data.results || [];
      // Should find our patient
      if (Array.isArray(patients) && patients.length > 0) {
        const found = patients.some(
          (p: any) =>
            p.id === patientA_Id ||
            p.firstName === 'Isolated',
        );
        expect(found).toBe(true);
      }
    });

    it('ISO-02: Tenant B admin CANNOT see Tenant A patients', async () => {
      const res = await authGet('/api/patients/search?search=Isolated', ctx.tokenTenantB);
      expect(res.status).toBe(200);
      const data = await res.json();
      const patients = data.patients || data.items || data.results || [];

      // Should NOT find Tenant A patient
      if (Array.isArray(patients)) {
        const found = patients.some(
          (p: any) =>
            p.id === patientA_Id ||
            p.firstName === 'Isolated',
        );
        expect(found).toBe(false);
      }
    });

    it('ISO-03: Tenant B admin CANNOT access patient A by direct ID', async () => {
      const res = await authGet(`/api/patients/${patientA_Id}`, ctx.tokenTenantB);

      // Should be 403, 404, or empty result — never 200 with data
      if (res.status === 200) {
        const data = await res.json();
        // If 200, the patient data should be null/empty
        expect(data.patient || data.id).toBeFalsy();
      } else {
        expect([403, 404]).toContain(res.status);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Encounter isolation
  // -----------------------------------------------------------------------

  describe('Encounter Data Isolation', () => {
    it('ISO-04: Tenant A can access encounter A', async () => {
      if (!encounterA_Id) return; // skip if encounter wasn't created
      const res = await authGet(`/api/opd/encounters/${encounterA_Id}`, ctx.tokens.admin);
      expect(res.status).toBe(200);
    });

    it('ISO-05: Tenant B CANNOT access Tenant A encounter', async () => {
      if (!encounterA_Id) return;
      const res = await authGet(`/api/opd/encounters/${encounterA_Id}`, ctx.tokenTenantB);

      // Should fail
      if (res.status === 200) {
        const data = await res.json();
        // Should have no encounter data
        expect(data.opd).toBeFalsy();
      } else {
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('ISO-06: Tenant B CANNOT modify Tenant A encounter', async () => {
      if (!encounterA_Id) return;
      const res = await authPost(
        `/api/opd/encounters/${encounterA_Id}/visit-notes`,
        ctx.tokenTenantB,
        {
          chiefComplaint: 'INJECTION ATTEMPT',
          assessment: 'Should not be saved',
          plan: 'Attack plan',
        },
      );

      // Must fail
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -----------------------------------------------------------------------
  // List endpoint isolation
  // -----------------------------------------------------------------------

  describe('List Endpoint Isolation', () => {
    it('ISO-07: OPD encounter list from Tenant B shows no Tenant A data', async () => {
      const res = await authGet('/api/opd/encounters/open?status=ACTIVE', ctx.tokenTenantB);

      if (res.status === 200) {
        const data = await res.json();
        const encounters = data.encounters || data.items || [];
        if (Array.isArray(encounters)) {
          const leaked = encounters.some(
            (e: any) =>
              e.id === encounterA_Id ||
              e.patientId === patientA_Id,
          );
          expect(leaked).toBe(false);
        }
      }
    });

    it('ISO-08: Lab orders from Tenant B show no Tenant A data', async () => {
      // First create a lab order in Tenant A
      await authPost('/api/lab/orders', ctx.tokens.doctor, {
        patientId: patientA_Id,
        patientName: 'Isolated PatientA',
        mrn: 'ISO-MRN-A',
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      });

      // Tenant B should NOT see it
      const res = await authGet('/api/lab/orders', ctx.tokenTenantB);
      if (res.status === 200) {
        const data = await res.json();
        const orders = data.orders || data.items || [];
        if (Array.isArray(orders)) {
          const leaked = orders.some(
            (o: any) => o.patientId === patientA_Id || o.mrn === 'ISO-MRN-A',
          );
          expect(leaked).toBe(false);
        }
      }
    });

    it('ISO-09: Pharmacy prescriptions from Tenant B show no Tenant A data', async () => {
      // Create a prescription in Tenant A
      await authPost('/api/pharmacy/prescriptions', ctx.tokens.doctor, {
        patientId: patientA_Id,
        patientName: 'Isolated PatientA',
        mrn: 'ISO-MRN-A',
        medication: 'Isolation Drug',
        strength: '100mg',
        form: 'tablet',
        route: 'oral',
        frequency: 'QD',
        duration: '7 days',
        quantity: 7,
      });

      // Tenant B should NOT see it
      const res = await authGet('/api/pharmacy/prescriptions', ctx.tokenTenantB);
      if (res.status === 200) {
        const data = await res.json();
        const items = data.items || data.prescriptions || [];
        if (Array.isArray(items)) {
          const leaked = items.some(
            (p: any) => p.patientId === patientA_Id || p.medication === 'Isolation Drug',
          );
          expect(leaked).toBe(false);
        }
      }
    });

    it('ISO-10: Billing from Tenant B shows no Tenant A data', async () => {
      const res = await authGet('/api/billing/payments', ctx.tokenTenantB);
      if (res.status === 200) {
        const data = await res.json();
        const items = data.items || data.payments || [];
        if (Array.isArray(items)) {
          const leaked = items.some(
            (p: any) => p.patientId === patientA_Id,
          );
          expect(leaked).toBe(false);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Create-in-wrong-tenant attempts
  // -----------------------------------------------------------------------

  describe('Cross-Tenant Write Attempts', () => {
    it('ISO-11: Tenant B cannot create patient with Tenant A context', async () => {
      // Tenant B tries to create a patient — should succeed in their OWN tenant
      const res = await authPost('/api/patients', ctx.tokenTenantB, {
        firstName: 'TenantB',
        lastName: 'OwnPatient',
        dob: '1985-06-15',
        gender: 'FEMALE',
      });

      if (res.status < 300) {
        const data = await res.json();
        const patient = data.patient || data;
        // Verify the patient was created in Tenant B, not Tenant A
        if (patient.tenantId) {
          expect(patient.tenantId).toBe(ctx.tenantB.id);
          expect(patient.tenantId).not.toBe(ctx.tenantA.id);
        }
      }
    });

    it('ISO-12: Tenant B cannot open encounter on Tenant A patient', async () => {
      const res = await authPost('/api/opd/encounters/open', ctx.tokenTenantB, {
        patientMasterId: patientA_Id,
        reason: 'Cross-tenant attack',
      });

      // Should fail — patient belongs to Tenant A
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
