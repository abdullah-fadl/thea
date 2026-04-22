/**
 * PDPL Anonymization Tests
 *
 * Tests for lib/privacy/anonymization.ts
 */

import { describe, it, expect } from 'vitest';
import {
  PII_FIELDS,
  anonymizePatientRecord,
  anonymizeText,
  buildAnonymizationUpdate,
} from '@/lib/privacy/anonymization';

describe('Anonymization', () => {
  describe('PII_FIELDS', () => {
    it('should contain all expected PII field names', () => {
      const expected = [
        'firstName', 'lastName', 'fullName', 'email', 'phone', 'mobile',
        'nationalId', 'iqamaNumber', 'passportNo', 'passportNumber',
        'emergencyContactName', 'emergencyContactPhone',
        'address', 'street', 'city', 'zipCode', 'postalCode',
      ];
      for (const field of expected) {
        expect((PII_FIELDS as readonly string[]).includes(field)).toBe(true);
      }
    });

    it('should have at least 20 PII fields defined', () => {
      expect(PII_FIELDS.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('anonymizePatientRecord', () => {
    it('should replace PII fields with [REDACTED]', () => {
      const patient: Record<string, unknown> = {
        id: 'p-123',
        firstName: 'Ahmed',
        lastName: 'Al-Saud',
        email: 'ahmed@example.com',
        phone: '+966501234567',
        mrn: 'MRN-001',
      };
      const result = anonymizePatientRecord(patient);
      expect(result.firstName).toBe('[REDACTED]');
      expect(result.lastName).toBe('[REDACTED]');
      expect(result.email).toBe('[REDACTED]');
      expect(result.phone).toBe('[REDACTED]');
    });

    it('should preserve non-PII fields (id, mrn, tenantId)', () => {
      const patient: Record<string, unknown> = {
        id: 'p-123',
        mrn: 'MRN-001',
        tenantId: 'tenant-1',
        firstName: 'Ahmed',
      };
      const result = anonymizePatientRecord(patient);
      expect(result.id).toBe('p-123');
      expect(result.mrn).toBe('MRN-001');
      expect(result.tenantId).toBe('tenant-1');
    });

    it('should handle null values gracefully (not redact them)', () => {
      const patient: Record<string, unknown> = {
        id: 'p-123',
        firstName: null,
        lastName: undefined,
        email: 'test@test.com',
      };
      const result = anonymizePatientRecord(patient);
      expect(result.firstName).toBeNull();
      expect(result.lastName).toBeUndefined();
      expect(result.email).toBe('[REDACTED]');
    });

    it('should handle empty record', () => {
      const result = anonymizePatientRecord({});
      expect(Object.keys(result).length).toBe(0);
    });

    it('should redact all PII fields when present', () => {
      const patient: Record<string, unknown> = {};
      for (const field of PII_FIELDS) {
        patient[field] = 'some-value';
      }
      patient.id = 'preserve-me';

      const result = anonymizePatientRecord(patient);
      for (const field of PII_FIELDS) {
        expect(result[field]).toBe('[REDACTED]');
      }
      expect(result.id).toBe('preserve-me');
    });
  });

  describe('buildAnonymizationUpdate', () => {
    it('should build update object only for PII fields present on the record', () => {
      const record: Record<string, unknown> = {
        id: 'p-1',
        firstName: 'Ahmed',
        lastName: 'Test',
        mrn: 'MRN-001',
      };
      const update = buildAnonymizationUpdate(record);
      expect(update.firstName).toBe('[REDACTED]');
      expect(update.lastName).toBe('[REDACTED]');
      expect(update.mrn).toBeUndefined();
      expect(update.id).toBeUndefined();
    });

    it('should skip null/undefined PII fields', () => {
      const record: Record<string, unknown> = {
        firstName: null,
        lastName: 'Test',
        email: undefined,
      };
      const update = buildAnonymizationUpdate(record);
      expect(update.firstName).toBeUndefined();
      expect(update.email).toBeUndefined();
      expect(update.lastName).toBe('[REDACTED]');
    });
  });

  describe('anonymizeText', () => {
    it('should redact email addresses', () => {
      const text = 'Contact patient at ahmed@example.com for follow-up.';
      const result = anonymizeText(text);
      expect(result).not.toContain('ahmed@example.com');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact Saudi phone numbers (+966 format)', () => {
      const text = 'Patient phone: +966 512 345 678';
      const result = anonymizeText(text);
      expect(result).not.toContain('+966');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact Saudi phone numbers (05x format)', () => {
      const text = 'Call 0551234567 for appointment.';
      const result = anonymizeText(text);
      expect(result).not.toContain('0551234567');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact national ID patterns (10 digits starting with 1)', () => {
      const text = 'National ID: 1234567890 on file.';
      const result = anonymizeText(text);
      expect(result).not.toContain('1234567890');
      expect(result).toContain('[REDACTED]');
    });

    it('should redact iqama numbers (10 digits starting with 2)', () => {
      const text = 'Iqama: 2098765432 verified.';
      const result = anonymizeText(text);
      expect(result).not.toContain('2098765432');
      expect(result).toContain('[REDACTED]');
    });

    it('should preserve non-PII text', () => {
      const text = 'Patient was diagnosed with mild hypertension. Follow up in 2 weeks.';
      const result = anonymizeText(text);
      expect(result).toBe(text);
    });

    it('should handle text with multiple PII patterns', () => {
      const text = 'Email: a@b.com, Phone: 0551112222, ID: 1111111111';
      const result = anonymizeText(text);
      expect(result).not.toContain('a@b.com');
      expect(result).not.toContain('0551112222');
      expect(result).not.toContain('1111111111');
    });
  });
});
