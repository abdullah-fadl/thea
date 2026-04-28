/**
 * CV Parsing Phase 2 Tests
 *
 * Tests for Phase 2 scope: Structured data extraction via regex patterns.
 * Validates extractStructuredData() for English CVs, Arabic CVs, mixed CVs,
 * and edge cases (empty text, missing fields).
 */

import { describe, it, expect } from 'vitest';
import {
  extractStructuredData,
} from '@/lib/cvision/cv-structured-extract';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENGLISH_CV = `
John Alexander Smith
Senior Software Engineer

Email: john.smith@example.com
Phone: +966 55 123 4567
Nationality: Saudi

Summary
Experienced software engineer with 8 years of professional experience in web and mobile development.

Education
Bachelor of Science in Computer Science, King Saud University
2012 - 2016 | GPA 3.8
Master of Science in Software Engineering, MIT
2016 - 2018

Experience
Senior Software Engineer at TechCorp (2020 - Present)
- Led development of microservices architecture
- Managed team of 6 developers

Software Engineer at StartupXYZ (2018 - 2020)
- Built React Native mobile applications
- Implemented CI/CD pipelines

Skills
JavaScript, TypeScript, React, Node.js, Python, Docker, Kubernetes, AWS, MongoDB, PostgreSQL

Languages
Arabic - Native
English - Fluent
French - Intermediate
`;

const ARABIC_CV = `
محمد أحمد العلي
مهندس برمجيات أول

البريد الإلكتروني: mohammed.ali@example.com
الهاتف: 0551234567
الجنسية: سعودي

الملخص
مهندس برمجيات بخبرة 10 سنوات في تطوير التطبيقات

التعليم
بكالوريوس علوم الحاسب - الجامعة الملك سعود
2010 - 2014
ماجستير هندسة البرمجيات
2014 - 2016

المهارات
جافا سكريبت، بايثون، ريأكت، نود، قواعد البيانات

اللغات
العربية
الإنجليزية
`;

const MINIMAL_CV = `
Jane Doe
Software Developer

Contact: jane.doe@gmail.com
Mobile: +1 (555) 987-6543

I have 3+ years experience in software development.

Education
BSc Computer Science, Stanford University

Skills: HTML, CSS, JavaScript, React, Git
`;

const EMPTY_TEXT = '';

const NO_FIELDS_TEXT = `
This is just a bunch of random text that does not look like a CV at all.
It has no email addresses, no phone numbers, no education, and no skills section.
Just plain old paragraphs without any structured information.
More filler text to make the string longer than the minimum threshold for testing purposes.
Even more text here to ensure we have enough content for the extraction function to process.
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CV Parsing Phase 2 - extractStructuredData', () => {
  describe('Empty / null input', () => {
    it('should return all nulls for empty string', () => {
      const result = extractStructuredData(EMPTY_TEXT);
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.fullName).toBeNull();
      expect(result.education).toBeNull();
      expect(result.skills).toBeNull();
      expect(result.yearsOfExperience).toBeNull();
      expect(result.nationality).toBeNull();
      expect(result.languages).toBeNull();
    });

    it('should return all nulls for whitespace-only string', () => {
      const result = extractStructuredData('   \n  \t  \n  ');
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });
  });

  describe('Email extraction', () => {
    it('should extract email from English CV', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.email).toBe('john.smith@example.com');
    });

    it('should extract email from Arabic CV', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.email).toBe('mohammed.ali@example.com');
    });

    it('should extract email from minimal CV', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.email).toBe('jane.doe@gmail.com');
    });

    it('should return null when no email is found', () => {
      const result = extractStructuredData(NO_FIELDS_TEXT);
      expect(result.email).toBeNull();
    });

    it('should handle email with plus addressing', () => {
      const result = extractStructuredData('Name: Test User\nEmail: user+tag@example.com\nSome other text');
      expect(result.email).toBe('user+tag@example.com');
    });
  });

  describe('Phone extraction', () => {
    it('should extract Saudi phone number with +966 prefix', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.phone).not.toBeNull();
      // Should contain the digits from +966 55 123 4567
      const digits = (result.phone || '').replace(/\D/g, '');
      expect(digits).toContain('966551234567');
    });

    it('should extract local Saudi phone number', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.phone).not.toBeNull();
      const digits = (result.phone || '').replace(/\D/g, '');
      expect(digits).toContain('0551234567');
    });

    it('should extract US format phone number', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.phone).not.toBeNull();
      const digits = (result.phone || '').replace(/\D/g, '');
      expect(digits.length).toBeGreaterThanOrEqual(7);
    });

    it('should return null when no phone is found', () => {
      const result = extractStructuredData(NO_FIELDS_TEXT);
      expect(result.phone).toBeNull();
    });
  });

  describe('Full name extraction', () => {
    it('should extract name from English CV', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.fullName).toBe('John Alexander Smith');
    });

    it('should extract name from Arabic CV', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.fullName).toBe('محمد أحمد العلي');
    });

    it('should extract name from minimal CV', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.fullName).toBe('Jane Doe');
    });

    it('should extract name from labeled format', () => {
      const text = 'Name: Sarah Johnson\nEmail: sarah@test.com\nSkills: TypeScript';
      const result = extractStructuredData(text);
      expect(result.fullName).toBe('Sarah Johnson');
    });

    it('should extract name from Arabic labeled format', () => {
      const text = 'الاسم: فاطمة العمري\nالبريد: fatima@test.com';
      const result = extractStructuredData(text);
      expect(result.fullName).toBe('فاطمة العمري');
    });
  });

  describe('Education extraction', () => {
    it('should extract multiple education entries from English CV', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.education).not.toBeNull();
      expect((result.education || []).length).toBeGreaterThanOrEqual(2);
      // Should contain Bachelor and Master entries
      const joined = (result.education || []).join(' ').toLowerCase();
      expect(joined).toContain('bachelor');
      expect(joined).toContain('master');
    });

    it('should extract Arabic education entries', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.education).not.toBeNull();
      expect((result.education || []).length).toBeGreaterThanOrEqual(1);
      const joined = (result.education || []).join(' ');
      expect(joined).toMatch(/بكالوريوس|ماجستير|الجامعة/);
    });

    it('should extract BSc from minimal CV', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.education).not.toBeNull();
      expect((result.education || []).length).toBeGreaterThanOrEqual(1);
      const joined = (result.education || []).join(' ').toLowerCase();
      expect(joined).toContain('bsc');
    });

    it('should append date info when found on next line', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.education).not.toBeNull();
      // At least one entry should have the year appended
      const hasYear = (result.education || []).some(e => /2012|2016|2018/i.test(e));
      expect(hasYear).toBe(true);
    });

    it('should return null when no education keywords found', () => {
      const result = extractStructuredData(NO_FIELDS_TEXT);
      expect(result.education).toBeNull();
    });
  });

  describe('Skills extraction', () => {
    it('should extract comma-separated skills', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.skills).not.toBeNull();
      expect((result.skills || []).length).toBeGreaterThanOrEqual(5);
      expect(result.skills).toContain('JavaScript');
      expect(result.skills).toContain('TypeScript');
      expect(result.skills).toContain('React');
    });

    it('should extract inline skills after colon', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.skills).not.toBeNull();
      expect((result.skills || []).length).toBeGreaterThanOrEqual(3);
      const lower = (result.skills || []).map(s => s.toLowerCase());
      expect(lower).toContain('html');
      expect(lower).toContain('css');
      expect(lower).toContain('javascript');
    });

    it('should extract Arabic skills', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.skills).not.toBeNull();
      expect((result.skills || []).length).toBeGreaterThanOrEqual(1);
    });

    it('should deduplicate skills', () => {
      const text = 'Skills\nJavaScript\nTypeScript\nJavaScript\nReact\nReact';
      const result = extractStructuredData(text);
      if (result.skills) {
        const lower = result.skills.map(s => s.toLowerCase());
        const unique = new Set(lower);
        expect(lower.length).toBe(unique.size);
      }
    });

    it('should return null when no skills section found', () => {
      const result = extractStructuredData(NO_FIELDS_TEXT);
      expect(result.skills).toBeNull();
    });
  });

  describe('Years of experience extraction', () => {
    it('should extract "8 years" from English CV', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.yearsOfExperience).toBe(8);
    });

    it('should extract Arabic years of experience', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.yearsOfExperience).toBe(10);
    });

    it('should extract "3+ years" pattern', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.yearsOfExperience).toBe(3);
    });

    it('should handle "over X years" pattern', () => {
      const text = 'Over 15 years of extensive experience in healthcare IT.';
      const result = extractStructuredData(text);
      expect(result.yearsOfExperience).toBe(15);
    });

    it('should return null when no experience pattern found', () => {
      const result = extractStructuredData(NO_FIELDS_TEXT);
      expect(result.yearsOfExperience).toBeNull();
    });
  });

  describe('Nationality extraction', () => {
    it('should extract nationality from English CV', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.nationality).toBe('Saudi');
    });

    it('should extract nationality from Arabic CV', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.nationality).not.toBeNull();
      expect(result.nationality).toContain('سعودي');
    });

    it('should return null when no nationality found', () => {
      const result = extractStructuredData(MINIMAL_CV);
      expect(result.nationality).toBeNull();
    });
  });

  describe('Languages extraction', () => {
    it('should extract languages from English CV section', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.languages).not.toBeNull();
      expect((result.languages || []).length).toBeGreaterThanOrEqual(2);
      const lower = (result.languages || []).map(l => l.toLowerCase());
      expect(lower).toEqual(expect.arrayContaining(['arabic', 'english']));
    });

    it('should extract languages from Arabic CV section', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.languages).not.toBeNull();
      expect((result.languages || []).length).toBeGreaterThanOrEqual(1);
    });

    it('should detect languages from text mentions (fallback)', () => {
      const text = 'I am fluent in English and Arabic, with basic French skills. Education: BSc at University of London.';
      const result = extractStructuredData(text);
      expect(result.languages).not.toBeNull();
      const lower = (result.languages || []).map(l => l.toLowerCase());
      expect(lower).toContain('english');
      expect(lower).toContain('arabic');
      expect(lower).toContain('french');
    });

    it('should deduplicate languages', () => {
      const result = extractStructuredData(ENGLISH_CV);
      if (result.languages) {
        const lower = result.languages.map(l => l.toLowerCase());
        const unique = new Set(lower);
        expect(lower.length).toBe(unique.size);
      }
    });
  });

  describe('Full integration (all fields from one CV)', () => {
    it('should extract all fields from a complete English CV', () => {
      const result = extractStructuredData(ENGLISH_CV);
      expect(result.email).toBe('john.smith@example.com');
      expect(result.phone).not.toBeNull();
      expect(result.fullName).toBe('John Alexander Smith');
      expect(result.education).not.toBeNull();
      expect((result.education || []).length).toBeGreaterThanOrEqual(2);
      expect(result.skills).not.toBeNull();
      expect((result.skills || []).length).toBeGreaterThanOrEqual(5);
      expect(result.yearsOfExperience).toBe(8);
      expect(result.nationality).toBe('Saudi');
      expect(result.languages).not.toBeNull();
      expect((result.languages || []).length).toBeGreaterThanOrEqual(2);
    });

    it('should extract key fields from Arabic CV', () => {
      const result = extractStructuredData(ARABIC_CV);
      expect(result.email).toBe('mohammed.ali@example.com');
      expect(result.phone).not.toBeNull();
      expect(result.fullName).toBe('محمد أحمد العلي');
      expect(result.education).not.toBeNull();
      expect(result.yearsOfExperience).toBe(10);
    });
  });
});
