/**
 * PDPL Consent Enforcement Tests
 *
 * Tests for lib/clinical/consentEnforcement.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getMissingConsents,
  getMissingConsentsWithRefusals,
  hasRefusalConsent,
  getWithdrawnConsents,
  CONSENT_REQUIREMENTS,
  type ConsentRecord,
  type ConsentRequirement,
} from '@/lib/clinical/consentEnforcement';

describe('Consent Enforcement', () => {
  describe('CONSENT_REQUIREMENTS', () => {
    it('should define requirements for MARK_READY transition', () => {
      const reqs = CONSENT_REQUIREMENTS.MARK_READY;
      expect(reqs).toBeDefined();
      expect(reqs.length).toBe(2);
      const ids = reqs.map((r: ConsentRequirement) => r.consentTypeId);
      expect(ids).toContain('general_treatment');
      expect(ids).toContain('data_privacy');
    });

    it('should define requirements for ADMISSION transition', () => {
      const reqs = CONSENT_REQUIREMENTS.ADMISSION;
      expect(reqs).toBeDefined();
      expect(reqs.length).toBe(3);
      const ids = reqs.map((r: ConsentRequirement) => r.consentTypeId);
      expect(ids).toContain('general_treatment');
      expect(ids).toContain('data_privacy');
      expect(ids).toContain('admission_consent');
    });

    it('should define requirements for PROCEDURE transition', () => {
      const reqs = CONSENT_REQUIREMENTS.PROCEDURE;
      expect(reqs).toBeDefined();
      expect(reqs.length).toBe(2);
      const ids = reqs.map((r: ConsentRequirement) => r.consentTypeId);
      expect(ids).toContain('general_treatment');
      expect(ids).toContain('procedure');
    });

    it('should define requirements for SURGERY transition', () => {
      const reqs = CONSENT_REQUIREMENTS.SURGERY;
      expect(reqs).toBeDefined();
      expect(reqs.length).toBe(2);
      const ids = reqs.map((r: ConsentRequirement) => r.consentTypeId);
      expect(ids).toContain('general_treatment');
      expect(ids).toContain('surgical_consent');
    });
  });

  describe('getMissingConsents', () => {
    it('should return all requirements when no consents exist', () => {
      const missing = getMissingConsents('MARK_READY', []);
      expect(missing.length).toBe(2);
    });

    it('should return empty array when all consents are signed', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'signed' },
      ];
      const missing = getMissingConsents('MARK_READY', consents);
      expect(missing).toEqual([]);
    });

    it('should return only the missing consent types', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
      ];
      const missing = getMissingConsents('MARK_READY', consents);
      expect(missing.length).toBe(1);
      expect(missing[0].consentTypeId).toBe('data_privacy');
    });

    it('should ignore withdrawn consents and treat them as missing', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'withdrawn', withdrawnAt: '2026-01-01' },
        { consentType: 'data_privacy', status: 'signed' },
      ];
      const missing = getMissingConsents('MARK_READY', consents);
      expect(missing.length).toBe(1);
      expect(missing[0].consentTypeId).toBe('general_treatment');
    });

    it('should return empty array for unknown transition type', () => {
      const missing = getMissingConsents('UNKNOWN_TRANSITION', []);
      expect(missing).toEqual([]);
    });

    it('should handle ADMISSION transition with partial consents', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'signed' },
      ];
      const missing = getMissingConsents('ADMISSION', consents);
      expect(missing.length).toBe(1);
      expect(missing[0].consentTypeId).toBe('admission_consent');
    });
  });

  describe('hasRefusalConsent', () => {
    it('should return true when procedure_refusal exists for procedure consent', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'procedure_refusal', status: 'signed' },
      ];
      expect(hasRefusalConsent('procedure', consents)).toBe(true);
    });

    it('should return true when treatment_refusal exists for general_treatment', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'treatment_refusal', status: 'signed' },
      ];
      expect(hasRefusalConsent('general_treatment', consents)).toBe(true);
    });

    it('should return false when no refusal consent exists', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
      ];
      expect(hasRefusalConsent('procedure', consents)).toBe(false);
    });

    it('should return false for consent types that have no refusal mapping', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'procedure_refusal', status: 'signed' },
      ];
      expect(hasRefusalConsent('data_privacy', consents)).toBe(false);
      expect(hasRefusalConsent('admission_consent', consents)).toBe(false);
    });
  });

  describe('getWithdrawnConsents', () => {
    it('should return only withdrawn consent records', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'data_privacy', status: 'withdrawn', withdrawnAt: '2026-01-15' },
        { consentType: 'procedure', status: 'signed' },
      ];
      const withdrawn = getWithdrawnConsents(consents);
      expect(withdrawn.length).toBe(1);
      expect(withdrawn[0].consentType).toBe('data_privacy');
    });

    it('should return empty array when no consents are withdrawn', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
      ];
      expect(getWithdrawnConsents(consents)).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      expect(getWithdrawnConsents([])).toEqual([]);
    });
  });

  describe('getMissingConsentsWithRefusals', () => {
    it('should accept procedure_refusal as alternative for procedure consent', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'general_treatment', status: 'signed' },
        { consentType: 'procedure_refusal', status: 'signed' },
      ];
      const missing = getMissingConsentsWithRefusals('PROCEDURE', consents);
      expect(missing).toEqual([]);
    });

    it('should still require consents that have no refusal alternative', () => {
      const consents: ConsentRecord[] = [
        { consentType: 'treatment_refusal', status: 'signed' },
      ];
      const missing = getMissingConsentsWithRefusals('MARK_READY', consents);
      // treatment_refusal covers general_treatment, but data_privacy has no refusal
      expect(missing.length).toBe(1);
      expect(missing[0].consentTypeId).toBe('data_privacy');
    });

    it('should return all requirements when no consents or refusals exist', () => {
      const missing = getMissingConsentsWithRefusals('PROCEDURE', []);
      expect(missing.length).toBe(2);
    });
  });
});
