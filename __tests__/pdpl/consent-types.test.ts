/**
 * PDPL Consent Types Tests
 *
 * Tests for lib/clinical/consentTypes.ts
 */

import { describe, it, expect } from 'vitest';
import {
  CONSENT_TYPES,
  CONSENT_DELIVERY_METHODS,
  type ConsentType,
  type ConsentDeliveryMethod,
} from '@/lib/clinical/consentTypes';

describe('Consent Types', () => {
  describe('CONSENT_TYPES structure', () => {
    it('should have all required fields on every consent type', () => {
      for (const ct of CONSENT_TYPES) {
        expect(ct.id).toBeDefined();
        expect(typeof ct.id).toBe('string');
        expect(ct.name).toBeDefined();
        expect(typeof ct.name).toBe('string');
        expect(ct.nameAr).toBeDefined();
        expect(typeof ct.nameAr).toBe('string');
        expect(ct.content).toBeDefined();
        expect(typeof ct.content).toBe('string');
        expect(ct.contentAr).toBeDefined();
        expect(typeof ct.contentAr).toBe('string');
        expect(typeof ct.required).toBe('boolean');
      }
    });

    it('should have no duplicate consent type IDs', () => {
      const ids = CONSENT_TYPES.map((ct: ConsentType) => ct.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should contain at least 5 consent types', () => {
      expect(CONSENT_TYPES.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('pdpl_data_processing consent type', () => {
    it('should exist in the consent types list', () => {
      const pdpl = CONSENT_TYPES.find((ct: ConsentType) => ct.id === 'pdpl_data_processing');
      expect(pdpl).toBeDefined();
    });

    it('should be marked as required', () => {
      const pdpl = CONSENT_TYPES.find((ct: ConsentType) => ct.id === 'pdpl_data_processing');
      expect(pdpl?.required).toBe(true);
    });

    it('should have both English and Arabic content', () => {
      const pdpl = CONSENT_TYPES.find((ct: ConsentType) => ct.id === 'pdpl_data_processing');
      expect(pdpl?.content).toContain('PDPL');
      expect(pdpl?.contentAr.length).toBeGreaterThan(0);
    });

    it('should mention withdrawal rights in content', () => {
      const pdpl = CONSENT_TYPES.find((ct: ConsentType) => ct.id === 'pdpl_data_processing');
      expect(pdpl?.content).toContain('withdraw');
    });
  });

  describe('Refusal consent types', () => {
    it('should have isRefusal set to true on refusal types', () => {
      const refusals = CONSENT_TYPES.filter((ct: ConsentType) => ct.isRefusal === true);
      expect(refusals.length).toBeGreaterThanOrEqual(3);
      for (const r of refusals) {
        expect(r.isRefusal).toBe(true);
      }
    });

    it('should include vitals_refusal, procedure_refusal, and treatment_refusal', () => {
      const refusalIds = CONSENT_TYPES
        .filter((ct: ConsentType) => ct.isRefusal === true)
        .map((ct: ConsentType) => ct.id);
      expect(refusalIds).toContain('vitals_refusal');
      expect(refusalIds).toContain('procedure_refusal');
      expect(refusalIds).toContain('treatment_refusal');
    });

    it('should mark refusal types as not required', () => {
      const refusals = CONSENT_TYPES.filter((ct: ConsentType) => ct.isRefusal === true);
      for (const r of refusals) {
        expect(r.required).toBe(false);
      }
    });

    it('should require details on refusal types', () => {
      const refusals = CONSENT_TYPES.filter((ct: ConsentType) => ct.isRefusal === true);
      for (const r of refusals) {
        expect(r.requiresDetails).toBe(true);
      }
    });
  });

  describe('CONSENT_DELIVERY_METHODS', () => {
    it('should have correct structure for each delivery method', () => {
      for (const method of CONSENT_DELIVERY_METHODS) {
        expect(method.key).toBeDefined();
        expect(typeof method.label).toBe('string');
        expect(typeof method.labelAr).toBe('string');
        expect(typeof method.available).toBe('boolean');
      }
    });

    it('should include tablet, sms, and whatsapp methods', () => {
      const keys = CONSENT_DELIVERY_METHODS.map((m) => m.key);
      expect(keys).toContain('tablet');
      expect(keys).toContain('sms');
      expect(keys).toContain('whatsapp');
    });

    it('should have tablet as the only currently available method', () => {
      const available = CONSENT_DELIVERY_METHODS.filter((m) => m.available);
      expect(available.length).toBe(1);
      expect(available[0].key).toBe('tablet');
    });
  });
});
