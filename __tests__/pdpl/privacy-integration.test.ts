/**
 * PDPL Privacy Integration Tests
 *
 * Integration-style tests (using mocks) that verify cross-module behavior
 * across consent, retention, anonymization, and breach detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma — factory must not reference outer variables (hoisted)
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Get reference to the mocked findMany after mock setup
import { prisma } from '@/lib/db/prisma';
const mockFindMany = vi.mocked(prisma.auditLog.findMany);

import {
  getMissingConsents,
  getWithdrawnConsents,
  type ConsentRecord,
} from '@/lib/clinical/consentEnforcement';
import { isRetentionExpired, getRetentionPolicy } from '@/lib/privacy/retention-policy';
import { anonymizePatientRecord, anonymizeText, PII_FIELDS } from '@/lib/privacy/anonymization';
import { runBreachDetection, type SuspiciousActivity } from '@/lib/privacy/breach-detection';

describe('Privacy Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Consent withdrawal flow', () => {
    it('should treat a consent as missing after withdrawal', () => {
      // Step 1: Patient has all consents signed
      const consentsActive: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'signed' },
      ];
      const missingBefore = getMissingConsents('MARK_READY', consentsActive);
      expect(missingBefore.length).toBe(0);

      // Step 2: Patient withdraws data_privacy consent
      const consentsAfterWithdrawal: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'withdrawn', withdrawnAt: '2026-03-20' },
      ];
      const missingAfter = getMissingConsents('MARK_READY', consentsAfterWithdrawal);
      expect(missingAfter.length).toBe(1);
      expect(missingAfter[0].consentTypeId).toBe('data_privacy');
    });

    it('should correctly list withdrawn consents after withdrawal', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'withdrawn', withdrawnAt: '2026-03-20' },
        { consentType: 'pdpl_data_processing', status: 'withdrawn', withdrawnAt: '2026-03-21' },
      ];
      const withdrawn = getWithdrawnConsents(consents);
      expect(withdrawn.length).toBe(2);
      expect(withdrawn.map((c) => c.consentType)).toContain('data_privacy');
      expect(withdrawn.map((c) => c.consentType)).toContain('pdpl_data_processing');
    });

    it('should re-require consent for ADMISSION after withdrawal', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'signed' },
        { consentType: 'admission_consent', status: 'withdrawn', withdrawnAt: '2026-03-15' },
      ];
      const missing = getMissingConsents('ADMISSION', consents);
      expect(missing.length).toBe(1);
      expect(missing[0].consentTypeId).toBe('admission_consent');
    });
  });

  describe('Retention + Anonymization', () => {
    it('should identify expired session data eligible for anonymization', () => {
      const createdAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      expect(isRetentionExpired('session_data', createdAt)).toBe(true);

      // When expired, anonymization can be applied
      const patientRecord: Record<string, unknown> = {
        id: 'p-expired',
        firstName: 'Omar',
        lastName: 'Hassan',
        email: 'omar@test.com',
        mrn: 'MRN-999',
      };
      const anonymized = anonymizePatientRecord(patientRecord);
      expect(anonymized.firstName).toBe('[REDACTED]');
      expect(anonymized.lastName).toBe('[REDACTED]');
      expect(anonymized.mrn).toBe('MRN-999');
    });

    it('should not anonymize data that is within retention period', () => {
      const createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      expect(isRetentionExpired('medical_records', createdAt)).toBe(false);
    });

    it('should anonymize free text in expired records', () => {
      const createdAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      expect(isRetentionExpired('temporary_files', createdAt)).toBe(true);

      const note = 'Patient ahmed@hospital.com called from 0551234567';
      const cleaned = anonymizeText(note);
      expect(cleaned).not.toContain('ahmed@hospital.com');
      expect(cleaned).not.toContain('0551234567');
    });

    it('should respect different retention periods per category', () => {
      const medicalPolicy = getRetentionPolicy('medical_records');
      const sessionPolicy = getRetentionPolicy('session_data');
      expect(medicalPolicy).not.toBeNull();
      expect(sessionPolicy).not.toBeNull();
      expect(medicalPolicy!.days).toBeGreaterThan(sessionPolicy!.days);
    });
  });

  describe('Breach detection typing', () => {
    it('should return SuspiciousActivity with all required fields', async () => {
      mockFindMany
        .mockResolvedValueOnce([
          {
            id: 'log-int-1',
            actorUserId: 'user-int',
            action: 'data_export',
            resourceType: 'patient',
            timestamp: new Date('2026-03-15'),
            ip: '10.0.0.5',
            metadata: { recordCount: 1500 },
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const results = await runBreachDetection('tenant-int', new Date('2026-03-01'));
      expect(results.length).toBe(1);

      const activity: SuspiciousActivity = results[0];
      expect(['bulk_export', 'repeated_denial', 'off_hours_access', 'break_glass_abuse', 'rapid_patient_browsing']).toContain(activity.type);
      expect(['low', 'medium', 'high']).toContain(activity.severity);
      expect(typeof activity.userId).toBe('string');
      expect(typeof activity.description).toBe('string');
      expect(activity.detectedAt).toBeInstanceOf(Date);
      expect(activity.metadata).toBeDefined();
    });

    it('should return empty array when no suspicious activity is found', async () => {
      mockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const results = await runBreachDetection('tenant-clean', new Date('2026-03-01'));
      expect(results).toEqual([]);
    });
  });

  describe('Full PII coverage', () => {
    it('should anonymize a record with every PII field populated', () => {
      const fullRecord: Record<string, unknown> = { id: 'full-test', mrn: 'MRN-F1', tenantId: 'T1' };
      for (const field of PII_FIELDS) {
        fullRecord[field] = `value-for-${field}`;
      }

      const result = anonymizePatientRecord(fullRecord);
      for (const field of PII_FIELDS) {
        expect(result[field]).toBe('[REDACTED]');
      }
      expect(result.id).toBe('full-test');
      expect(result.mrn).toBe('MRN-F1');
      expect(result.tenantId).toBe('T1');
    });
  });
});
