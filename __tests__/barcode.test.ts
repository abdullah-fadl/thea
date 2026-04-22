/**
 * Lab Barcode Generation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateAccessionNumber,
  parseAccessionNumber,
  generateSpecimenBarcode,
  parseSpecimenBarcode,
  generateNumericBarcode,
  buildBarcodeLabel,
} from '@/lib/lab/barcode';

describe('Lab Barcode System', () => {
  describe('generateAccessionNumber', () => {
    it('should generate accession in LAB-YYMMDD-NNNN format', () => {
      const result = generateAccessionNumber(42, new Date('2026-02-17'));
      expect(result.accession).toBe('LAB-260217-0042');
      expect(result.sequence).toBe(42);
    });

    it('should pad sequence to 4 digits', () => {
      const result = generateAccessionNumber(1);
      expect(result.accession).toMatch(/^LAB-\d{6}-0001$/);
    });
  });

  describe('parseAccessionNumber', () => {
    it('should parse valid accession', () => {
      const result = parseAccessionNumber('LAB-260217-0042');
      expect(result).toBeTruthy();
      expect(result?.date).toBe('260217');
      expect(result?.sequence).toBe(42);
    });

    it('should return null for invalid format', () => {
      expect(parseAccessionNumber('INVALID')).toBeNull();
      expect(parseAccessionNumber('LAB-123-45')).toBeNull();
    });
  });

  describe('generateSpecimenBarcode', () => {
    it('should generate specimen barcode with tube suffix', () => {
      const result = generateSpecimenBarcode('LAB-260217-0042', 'lavender');
      expect(result.barcode).toBe('SP-260217-0042-E');
      expect(result.tubeType).toBe('lavender');
    });

    it('should use X for unknown tube type', () => {
      const result = generateSpecimenBarcode('LAB-260217-0042', 'unknown');
      expect(result.barcode).toBe('SP-260217-0042-X');
    });
  });

  describe('generateNumericBarcode', () => {
    it('should generate numeric-only barcode', () => {
      const result = generateNumericBarcode('LAB-260217-0042', 'lavender');
      expect(result).toMatch(/^\d+$/);
    });
  });

  describe('buildBarcodeLabel', () => {
    it('should build complete label data', () => {
      const label = buildBarcodeLabel({
        accession: 'LAB-260217-0042',
        tubeType: 'gold',
        patientName: 'Test Patient',
        mrn: 'MRN-001',
        tests: ['CBC', 'CMP'],
      });
      expect(label.patientName).toBe('Test Patient');
      expect(label.mrn).toBe('MRN-001');
      expect(label.tests).toEqual(['CBC', 'CMP']);
      expect(label.barcodeValue).toBeTruthy();
    });
  });
});
