/**
 * ADT Event Processor — Unit Tests
 *
 * Tests the core ADT processing logic for HL7 v2.5 events:
 *   A01 (Admit), A02 (Transfer), A03 (Discharge),
 *   A04 (Register Outpatient), A08 (Update Patient)
 *
 * Uses Prisma mock to isolate from database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma — use vi.hoisted to avoid factory hoisting issues
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    patientMaster: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    encounterCore: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ipdEpisode: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    opdEncounter: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { processADTEvent } from '@/lib/integration/hl7/adtProcessor';
import type { ADTEvent } from '@/lib/integration/hl7/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'test-tenant-123';

function makeADTEvent(overrides: Partial<ADTEvent> = {}): ADTEvent {
  return {
    messageId: 'MSG-001',
    eventType: 'A01',
    patientId: 'MRN-12345',
    patientName: 'Doe, John',
    dateOfBirth: '19900101',
    sex: 'M',
    patientClass: 'I',
    assignedLocation: 'Ward-3A',
    attendingDoctor: 'Dr. Smith',
    admitDateTime: '20240301120000',
    visitNumber: 'V-100',
    ...overrides,
  };
}

const MOCK_PATIENT = { id: 'pat-uuid-1', mrn: 'MRN-12345', fullName: 'John Doe' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ADT Event Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Patient matching ─────────────────────────────────────────────────

  describe('Patient Matching', () => {
    it('should return success with patient_not_matched when patient is not found', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(null);

      const result = await processADTEvent(TENANT, makeADTEvent());

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
      expect(result.patientId).toBeNull();
      expect(result.actions).toContain('patient_not_matched');
      expect(result.errors[0]).toMatch(/Patient not found/);
    });

    it('should match patient by MRN', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue(null); // no existing encounter
      mockPrisma.encounterCore.create.mockResolvedValue({ id: 'enc-1' });
      mockPrisma.ipdEpisode.create.mockResolvedValue({ id: 'ep-1' });

      const result = await processADTEvent(TENANT, makeADTEvent());

      expect(result.patientId).toBe('pat-uuid-1');
      expect(mockPrisma.patientMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            OR: expect.arrayContaining([
              { mrn: 'MRN-12345' },
            ]),
          }),
        }),
      );
    });

    it('should return ackCode AR for unsupported event type', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);

      const result = await processADTEvent(TENANT, makeADTEvent({ eventType: 'A99' as unknown as ADTEvent['eventType'] }));

      expect(result.success).toBe(false);
      expect(result.ackCode).toBe('AR');
      expect(result.errors[0]).toMatch(/Unsupported ADT event type/);
    });
  });

  // ── A01 — Admit ──────────────────────────────────────────────────────

  describe('A01 — Admit', () => {
    it('should create EncounterCore and IpdEpisode', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue(null);
      mockPrisma.encounterCore.create.mockResolvedValue({ id: 'enc-new' });
      mockPrisma.ipdEpisode.create.mockResolvedValue({ id: 'ep-new' });

      const result = await processADTEvent(TENANT, makeADTEvent({ eventType: 'A01' }));

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
      expect(result.actions).toContain('encounter_created');
      expect(result.actions).toContain('ipd_episode_created');

      expect(mockPrisma.encounterCore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT,
            patientId: 'pat-uuid-1',
            encounterType: 'IPD',
            status: 'ACTIVE',
            department: 'Ward-3A',
          }),
        }),
      );

      expect(mockPrisma.ipdEpisode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT,
            encounterId: 'enc-new',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should skip creation if patient already has active IPD encounter', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue({ id: 'enc-existing' }); // active encounter exists

      const result = await processADTEvent(TENANT, makeADTEvent({ eventType: 'A01' }));

      expect(result.success).toBe(true);
      expect(result.actions).toContain('encounter_already_exists');
      expect(mockPrisma.encounterCore.create).not.toHaveBeenCalled();
    });
  });

  // ── A02 — Transfer ───────────────────────────────────────────────────

  describe('A02 — Transfer', () => {
    it('should update encounter and episode location', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue({ id: 'enc-active' });
      mockPrisma.encounterCore.update.mockResolvedValue({});
      mockPrisma.ipdEpisode.updateMany.mockResolvedValue({ count: 1 });

      const result = await processADTEvent(TENANT, makeADTEvent({
        eventType: 'A02',
        assignedLocation: 'ICU-2B',
      }));

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
      expect(result.actions).toContain('encounter_location_updated');
      expect(result.actions).toContain('ipd_episode_location_updated');

      expect(mockPrisma.encounterCore.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            department: 'ICU-2B',
          }),
        }),
      );
    });

    it('should handle transfer when no active encounter exists', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue(null);

      const result = await processADTEvent(TENANT, makeADTEvent({ eventType: 'A02' }));

      expect(result.success).toBe(true);
      expect(result.actions).toContain('no_active_encounter');
      expect(result.errors).toContain('No active IPD encounter found for transfer');
    });
  });

  // ── A03 — Discharge ──────────────────────────────────────────────────

  describe('A03 — Discharge', () => {
    it('should close encounter and discharge IPD episode', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue({ id: 'enc-ipd', encounterType: 'IPD' });
      mockPrisma.encounterCore.update.mockResolvedValue({});
      mockPrisma.ipdEpisode.updateMany.mockResolvedValue({ count: 1 });

      const result = await processADTEvent(TENANT, makeADTEvent({
        eventType: 'A03',
        dischargeDateTime: '20240310150000',
      }));

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
      expect(result.actions).toContain('encounter_closed');
      expect(result.actions).toContain('ipd_episode_discharged');

      expect(mockPrisma.encounterCore.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLOSED',
          }),
        }),
      );

      expect(mockPrisma.ipdEpisode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DISCHARGED',
          }),
        }),
      );
    });

    it('should handle discharge when no active encounter exists', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue(null);

      const result = await processADTEvent(TENANT, makeADTEvent({ eventType: 'A03' }));

      expect(result.success).toBe(true);
      expect(result.actions).toContain('no_active_encounter');
    });
  });

  // ── A04 — Register Outpatient ────────────────────────────────────────

  describe('A04 — Register Outpatient', () => {
    it('should create EncounterCore and OpdEncounter', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.encounterCore.findFirst.mockResolvedValue(null);
      mockPrisma.encounterCore.create.mockResolvedValue({ id: 'enc-opd' });
      mockPrisma.opdEncounter.create.mockResolvedValue({ id: 'opd-1' });

      const result = await processADTEvent(TENANT, makeADTEvent({
        eventType: 'A04',
        assignedLocation: 'OPD-Clinic-A',
      }));

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
      expect(result.actions).toContain('encounter_created');
      expect(result.actions).toContain('opd_encounter_created');

      expect(mockPrisma.encounterCore.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            encounterType: 'OPD',
            status: 'ACTIVE',
            department: 'OPD-Clinic-A',
          }),
        }),
      );

      expect(mockPrisma.opdEncounter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OPEN',
            patientId: 'pat-uuid-1',
          }),
        }),
      );
    });
  });

  // ── A08 — Update Patient ─────────────────────────────────────────────

  describe('A08 — Update Patient', () => {
    it('should update patient demographics', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);
      mockPrisma.patientMaster.update.mockResolvedValue({});

      const result = await processADTEvent(TENANT, makeADTEvent({
        eventType: 'A08',
        patientName: 'Smith, Jane',
        dateOfBirth: '19850615',
        sex: 'F',
      }));

      expect(result.success).toBe(true);
      expect(result.ackCode).toBe('AA');
      expect(result.actions).toContain('patient_demographics_updated');

      expect(mockPrisma.patientMaster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pat-uuid-1' },
          data: expect.objectContaining({
            firstName: 'Jane',
            lastName: 'Smith',
            fullName: 'Jane Smith',
            gender: 'FEMALE',
          }),
        }),
      );
    });

    it('should skip update when no fields to change', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(MOCK_PATIENT);

      const result = await processADTEvent(TENANT, makeADTEvent({
        eventType: 'A08',
        patientName: '',
        dateOfBirth: '',
        sex: '',
      }));

      expect(result.success).toBe(true);
      expect(result.actions).toContain('no_updates_needed');
      expect(mockPrisma.patientMaster.update).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ───────────────────────────────────────────────────

  describe('Error handling', () => {
    it('should return AE on processing error', async () => {
      mockPrisma.patientMaster.findFirst.mockRejectedValue(new Error('DB connection lost'));

      const result = await processADTEvent(TENANT, makeADTEvent());

      expect(result.success).toBe(false);
      expect(result.ackCode).toBe('AE');
      expect(result.errors[0]).toMatch(/Processing error/);
    });

    it('should return consistent result structure', async () => {
      mockPrisma.patientMaster.findFirst.mockResolvedValue(null);

      const result = await processADTEvent(TENANT, makeADTEvent());

      // Verify shape
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('eventType');
      expect(result).toHaveProperty('patientId');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('ackCode');
      expect(Array.isArray(result.actions)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
