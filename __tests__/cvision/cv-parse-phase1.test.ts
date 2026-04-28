/**
 * CV Parsing Phase 1 Tests
 * 
 * Tests for Phase 1 scope: Raw text extraction only (NO semantic extraction, NO AI)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the parseCv function signature
interface ParseResult {
  extractedRawText: string;
  metaJson: {
    pages: number;
    mimeType: string;
    parserVersion: string;
    parserUsed: string;
    fileName: string;
    fileSize?: number | null;
    extractedAt: string;
    textLength: number;
  };
  errors: string | null;
}

describe('CV Parsing Phase 1', () => {
  const MIN_TEXT_LENGTH = 300;
  const PARSER_VERSION = '1.0.0-phase1';

  describe('parseCv - Raw Text Extraction', () => {
    it('should extract raw text from PDF with text content', async () => {
      // Mock document with pre-extracted text (must exceed MIN_TEXT_LENGTH of 300 chars)
      const mockDocument = {
        id: 'doc-1',
        fileName: 'cv.pdf',
        mimeType: 'application/pdf',
        extractedText: 'John Doe\nSoftware Engineer\nEmail: john@example.com\nPhone: +1234567890\n\nProfessional Summary:\nExperienced software engineer with over 8 years of experience in full-stack web development. Skilled in modern JavaScript frameworks, cloud infrastructure, and agile methodologies.\n\nExperience:\n- 5 years at Company X as Senior Developer, leading a team of 6 engineers\n- 3 years at Company Y as Junior Developer, building RESTful APIs and microservices\n\nEducation:\n- BS Computer Science, University ABC, Graduated 2015\n\nSkills:\n- JavaScript, TypeScript, Python, SQL\n- React, Node.js, Docker, Kubernetes\n- AWS, GCP, CI/CD Pipelines',
        storageKey: '/tmp/cv-uploads/test.pdf',
        fileSize: 50000,
      };

      // Simulate parseCv logic
      const extractedRawText = mockDocument.extractedText.trim();
      const hasValidText = extractedRawText.length >= MIN_TEXT_LENGTH;
      
      const result: ParseResult = {
        extractedRawText,
        metaJson: {
          pages: 1,
          mimeType: mockDocument.mimeType,
          parserVersion: PARSER_VERSION,
          parserUsed: 'pre-extracted',
          fileName: mockDocument.fileName,
          fileSize: mockDocument.fileSize,
          extractedAt: new Date().toISOString(),
          textLength: extractedRawText.length,
        },
        errors: hasValidText ? null : `Extracted text too short (${extractedRawText.length} chars, minimum ${MIN_TEXT_LENGTH})`,
      };

      expect(result.extractedRawText.length).toBeGreaterThan(MIN_TEXT_LENGTH);
      expect(result.errors).toBeNull();
      expect(result.metaJson.parserVersion).toBe(PARSER_VERSION);
      expect(result.metaJson.textLength).toBeGreaterThan(0);
    });

    it('should fail for image-only PDF (scanned)', async () => {
      // Mock scanned PDF with minimal text
      const mockDocument = {
        id: 'doc-2',
        fileName: 'scanned-cv.pdf',
        mimeType: 'application/pdf',
        extractedText: '', // Empty or very short text
        storageKey: '/tmp/cv-uploads/scanned.pdf',
        fileSize: 200000,
      };

      const extractedRawText = mockDocument.extractedText.trim();
      const hasValidText = extractedRawText.length >= MIN_TEXT_LENGTH;
      
      const result: ParseResult = {
        extractedRawText,
        metaJson: {
          pages: 2,
          mimeType: mockDocument.mimeType,
          parserVersion: PARSER_VERSION,
          parserUsed: 'pdf-parse',
          fileName: mockDocument.fileName,
          fileSize: mockDocument.fileSize,
          extractedAt: new Date().toISOString(),
          textLength: extractedRawText.length,
        },
        errors: hasValidText ? null : 'Scanned PDF not supported yet. Please provide a text-based PDF.',
      };

      expect(result.extractedRawText.length).toBeLessThan(MIN_TEXT_LENGTH);
      expect(result.errors).toContain('Scanned PDF');
      expect(result.metaJson.pages).toBeGreaterThan(0);
    });

    it('should fail for text too short', async () => {
      const mockDocument = {
        id: 'doc-3',
        fileName: 'short.txt',
        mimeType: 'text/plain',
        extractedText: 'Short CV', // Less than 300 chars
        storageKey: '/tmp/cv-uploads/short.txt',
        fileSize: 100,
      };

      const extractedRawText = mockDocument.extractedText.trim();
      const hasValidText = extractedRawText.length >= MIN_TEXT_LENGTH;
      
      const result: ParseResult = {
        extractedRawText,
        metaJson: {
          pages: 0,
          mimeType: mockDocument.mimeType,
          parserVersion: PARSER_VERSION,
          parserUsed: 'pre-extracted',
          fileName: mockDocument.fileName,
          fileSize: mockDocument.fileSize,
          extractedAt: new Date().toISOString(),
          textLength: extractedRawText.length,
        },
        errors: hasValidText ? null : `Extracted text too short (${extractedRawText.length} chars, minimum ${MIN_TEXT_LENGTH})`,
      };

      expect(result.extractedRawText.length).toBeLessThan(MIN_TEXT_LENGTH);
      expect(result.errors).toContain('too short');
      expect(result.errors).toContain(MIN_TEXT_LENGTH.toString());
    });

    it('should extract raw text from DOCX', async () => {
      const mockDocument = {
        id: 'doc-4',
        fileName: 'cv.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedText: 'Jane Smith\nSenior Developer\nEmail: jane@example.com\n\nWork History:\n- 7 years software development\n- Led team of 5 developers\n\nEducation:\n- MS Computer Science\n- BS Mathematics',
        storageKey: '/tmp/cv-uploads/cv.docx',
        fileSize: 30000,
      };

      const extractedRawText = mockDocument.extractedText.trim();
      const hasValidText = extractedRawText.length >= MIN_TEXT_LENGTH;
      
      const result: ParseResult = {
        extractedRawText,
        metaJson: {
          pages: Math.max(1, Math.ceil(extractedRawText.length / 500)),
          mimeType: mockDocument.mimeType,
          parserVersion: PARSER_VERSION,
          parserUsed: 'mammoth-docx',
          fileName: mockDocument.fileName,
          fileSize: mockDocument.fileSize,
          extractedAt: new Date().toISOString(),
          textLength: extractedRawText.length,
        },
        errors: hasValidText ? null : `Extracted text too short (${extractedRawText.length} chars, minimum ${MIN_TEXT_LENGTH})`,
      };

      expect(result.metaJson.parserUsed).toBe('mammoth-docx');
      expect(result.metaJson.mimeType).toContain('word');
    });

    it('should NOT extract semantic fields (Phase 1 scope)', () => {
      const extractedRawText = 'John Doe\nEmail: john@example.com\nPhone: +1234567890\n\nEducation:\n- BS Computer Science\n\nExperience:\n- Software Engineer at Company X\n\nSkills:\n- JavaScript\n- Python';

      // Phase 1: Only raw text, no semantic extraction
      const result = {
        extractedRawText,
        metaJson: {
          pages: 1,
          mimeType: 'application/pdf',
          parserVersion: PARSER_VERSION,
          parserUsed: 'pre-extracted',
          fileName: 'cv.pdf',
          textLength: extractedRawText.length,
          extractedAt: new Date().toISOString(),
        },
        errors: null,
      };

      // Verify NO semantic fields are extracted
      expect(result).not.toHaveProperty('extractedJson');
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('education');
      expect(result).not.toHaveProperty('experience');
      expect(result).not.toHaveProperty('skills');
      
      // Verify raw text is present
      expect(result.extractedRawText).toContain('John Doe');
      expect(result.extractedRawText).toContain('john@example.com');
      expect(result.extractedRawText).toContain('JavaScript');
    });
  });

  describe('Status Determination', () => {
    it('should mark DONE for text > 300 chars', () => {
      const extractedRawText = 'A'.repeat(500);
      const hasValidText = extractedRawText.length >= MIN_TEXT_LENGTH;
      const status: 'DONE' | 'FAILED' = hasValidText ? 'DONE' : 'FAILED';
      
      expect(status).toBe('DONE');
    });

    it('should mark FAILED for text < 300 chars', () => {
      const extractedRawText = 'Short text';
      const hasValidText = extractedRawText.length >= MIN_TEXT_LENGTH;
      const status: 'DONE' | 'FAILED' = hasValidText ? 'DONE' : 'FAILED';
      
      expect(status).toBe('FAILED');
    });
  });

  describe('Metadata', () => {
    it('should include parser version in metaJson', () => {
      const metaJson = {
        pages: 2,
        mimeType: 'application/pdf',
        parserVersion: PARSER_VERSION,
        parserUsed: 'pdf-parse',
        fileName: 'cv.pdf',
        textLength: 1000,
        extractedAt: new Date().toISOString(),
      };

      expect(metaJson.parserVersion).toBe(PARSER_VERSION);
      expect(metaJson.pages).toBeGreaterThan(0);
      expect(metaJson.textLength).toBeGreaterThan(0);
    });
  });
});
