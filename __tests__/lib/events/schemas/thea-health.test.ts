/**
 * Phase 7.4 — Thea Health event schema tests
 *
 * One test per registered event:
 *   1. patient.registered@v1     — accepts valid payload, rejects PHI fields, rejects missing scope
 *   2. encounter.opened@v1       — same
 *   3. encounter.closed@v1       — same
 *   4. order.placed@v1           — same
 *   5. lab.result.posted@v1      — same
 *
 * Importing the schemas barrel triggers registerEventType() for all five
 * at module load. Each test then resolves the schema via getSchema() and
 * exercises its Zod payload contract directly.
 *
 * The schemas use Zod v4's `.strict()` semantics — by default `.object()`
 * strips unknown keys. We enforce the "no PHI" discipline by checking that
 * the schema does NOT recognise PHI-shaped fields after parse: any extra
 * field a careless caller adds must be discarded silently, not persisted.
 */

import { describe, it, expect } from 'vitest';
import '@/lib/events/schemas';
import { getSchema } from '@/lib/events/registry';

// Valid RFC-4122 v4 UUIDs for fixtures (Zod's uuid() requires variant 10xx).
const TENANT_ID      = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PATIENT_ID     = '550e8400-e29b-41d4-a716-446655440000';
const ENCOUNTER_ID   = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const ORDER_ID       = '7d3a9c2e-1b8d-4c4f-9e7a-2f5e8a1d3c4b';
const LAB_RESULT_ID  = '8e4b0d3f-2c9e-45a0-9f8b-3a6f9b2e4d5c';
const PORTAL_USER_ID = '9f5c1e40-3dad-46b1-a09c-4b7a0c3f5e6d';
const NOW_ISO        = '2026-04-25T10:00:00.000Z';

describe('Thea Health event schemas', () => {
  describe('patient.registered@v1', () => {
    const schema = getSchema('patient.registered', 1).payloadSchema;

    it('accepts a valid payload', () => {
      const result = schema.safeParse({
        patientId: PATIENT_ID,
        portalUserId: PORTAL_USER_ID,
        tenantId: TENANT_ID,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with missing required scope (tenantId)', () => {
      const result = schema.safeParse({
        patientId: PATIENT_ID,
        portalUserId: PORTAL_USER_ID,
      });
      expect(result.success).toBe(false);
    });

    it('strips PHI fields (mobile, fullName) — no PHI leaves the route in event payload', () => {
      const result = schema.safeParse({
        patientId: PATIENT_ID,
        portalUserId: PORTAL_USER_ID,
        tenantId: TENANT_ID,
        // PHI a careless caller might attach:
        mobile: '+966500000000',
        fullName: 'Patient Name',
        nationalId: '1234567890',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('mobile');
        expect(result.data).not.toHaveProperty('fullName');
        expect(result.data).not.toHaveProperty('nationalId');
      }
    });
  });

  describe('encounter.opened@v1', () => {
    const schema = getSchema('encounter.opened', 1).payloadSchema;

    it('accepts a valid payload', () => {
      const result = schema.safeParse({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        encounterType: 'OPD',
        openedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with non-UUID encounterId', () => {
      const result = schema.safeParse({
        encounterId: 'not-a-uuid',
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        encounterType: 'OPD',
        openedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PHI fields (chiefComplaint, vitals) — only IDs + scope persist', () => {
      const result = schema.safeParse({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        encounterType: 'OPD',
        openedAt: NOW_ISO,
        chiefComplaint: 'chest pain radiating to left arm',
        vitals: { bp: '180/120', hr: 110 },
        triageNotes: 'patient anxious, family present',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('chiefComplaint');
        expect(result.data).not.toHaveProperty('vitals');
        expect(result.data).not.toHaveProperty('triageNotes');
      }
    });
  });

  describe('encounter.closed@v1', () => {
    const schema = getSchema('encounter.closed', 1).payloadSchema;

    it('accepts a valid payload with status = COMPLETED', () => {
      const result = schema.safeParse({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        status: 'COMPLETED',
        closedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with status outside the enum', () => {
      const result = schema.safeParse({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        status: 'CANCELLED',
        closedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PHI fields (diagnosis, dischargeNote) — only ID + status persist', () => {
      const result = schema.safeParse({
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        status: 'CLOSED',
        closedAt: NOW_ISO,
        diagnosis: 'I21.9 Acute MI, unspecified',
        dischargeNote: 'patient stable, follow-up in 2 weeks',
        prescription: 'aspirin 100mg PO daily',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('diagnosis');
        expect(result.data).not.toHaveProperty('dischargeNote');
        expect(result.data).not.toHaveProperty('prescription');
      }
    });
  });

  describe('order.placed@v1', () => {
    const schema = getSchema('order.placed', 1).payloadSchema;

    it('accepts a valid payload', () => {
      const result = schema.safeParse({
        orderId: ORDER_ID,
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        kind: 'LAB',
        placedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with kind outside the supported enum', () => {
      const result = schema.safeParse({
        orderId: ORDER_ID,
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        kind: 'GENETIC_TESTING',
        placedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PHI fields (clinicalNotes, testName) — only IDs + kind persist', () => {
      const result = schema.safeParse({
        orderId: ORDER_ID,
        encounterId: ENCOUNTER_ID,
        patientId: PATIENT_ID,
        tenantId: TENANT_ID,
        kind: 'RADIOLOGY',
        placedAt: NOW_ISO,
        clinicalNotes: 'r/o pneumonia, fever 39.2',
        testName: 'Chest X-ray PA + lateral',
        priority: 'STAT',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('clinicalNotes');
        expect(result.data).not.toHaveProperty('testName');
        expect(result.data).not.toHaveProperty('priority');
      }
    });
  });

  describe('lab.result.posted@v1', () => {
    const schema = getSchema('lab.result.posted', 1).payloadSchema;

    it('accepts a valid payload (with nullable patient/encounter scope)', () => {
      const result = schema.safeParse({
        labResultId: LAB_RESULT_ID,
        orderId: ORDER_ID,
        testId: 'CBC',
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        status: 'COMPLETED',
        postedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with missing required orderId', () => {
      const result = schema.safeParse({
        labResultId: LAB_RESULT_ID,
        testId: 'CBC',
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        status: 'COMPLETED',
        postedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PHI fields (parameters, abnormalFlags, criticalAlerts) — clinical values stay out', () => {
      const result = schema.safeParse({
        labResultId: LAB_RESULT_ID,
        orderId: ORDER_ID,
        testId: 'CBC',
        tenantId: TENANT_ID,
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        status: 'VERIFIED',
        postedAt: NOW_ISO,
        // PHI / PHI-like data the route saw but must NOT broadcast:
        parameters: [{ name: 'WBC', value: 18.4, unit: '10^9/L' }],
        abnormalFlags: ['H'],
        criticalAlerts: [{ value: 18.4, threshold: 11 }],
        patientName: 'Patient Name',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('parameters');
        expect(result.data).not.toHaveProperty('abnormalFlags');
        expect(result.data).not.toHaveProperty('criticalAlerts');
        expect(result.data).not.toHaveProperty('patientName');
      }
    });
  });
});
