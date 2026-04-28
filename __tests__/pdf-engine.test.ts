/**
 * 15 PDF Engine Tests
 *
 * Structural validation of the PDF generation engine and templates via
 * source file inspection. Verifies that the generator provides all core
 * functions, that templates cover all 5 document types, that bilingual
 * support is wired throughout, and that API routes properly import
 * from the template module.
 *
 * Categories:
 *   PDF-01..PDF-04  Generator core (exports, bilingual headers, QR, constants)
 *   PDF-05..PDF-07  Templates (5 generators, PrescriptionPdfData, Lab flags)
 *   PDF-08..PDF-09  Discharge summary (LOS calculation, medication table)
 *   PDF-10..PDF-11  Excuse letter (total days, bilingual body)
 *   PDF-12..PDF-13  Visit report (vitals, diagnoses, medications sections)
 *   PDF-14          Confidentiality notice (bilingual)
 *   PDF-15          QR code support (addQrCode function)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Generator Core (PDF-01..PDF-04)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — Generator Core', () => {
  const genSrc = readSource('lib/pdf/generator.ts');

  // PDF-01: Generator exports all essential functions
  it('PDF-01: generator.ts exports createPdfDocument, addSectionHeader, addFieldRow, addTable', () => {
    expect(genSrc).toContain('export async function createPdfDocument(');
    expect(genSrc).toContain('export function addSectionHeader(');
    expect(genSrc).toContain('export function addFieldRow(');
    expect(genSrc).toContain('export function addTable(');
    expect(genSrc).toContain('export function addMedicationRow(');
    expect(genSrc).toContain('export function addSignatureLine(');
    expect(genSrc).toContain('export function addConfidentialityNotice(');
    expect(genSrc).toContain('export function pdfToBuffer(');
  });

  // PDF-02: Generator supports bilingual document headers (title + titleAr)
  it('PDF-02: PdfDocumentOptions supports title and titleAr for bilingual headers', () => {
    expect(genSrc).toContain('export interface PdfDocumentOptions');
    expect(genSrc).toContain('title: string');
    expect(genSrc).toContain('titleAr?: string');
    expect(genSrc).toContain('facilityName?: string');
    expect(genSrc).toContain('facilityNameAr?: string');
    expect(genSrc).toContain("language?: 'ar' | 'en'");
  });

  // PDF-03: Generator exports reusable content blocks (patient, doctor info)
  it('PDF-03: generator exports addPatientInfoBlock and addDoctorInfoBlock', () => {
    expect(genSrc).toContain('export function addPatientInfoBlock(');
    expect(genSrc).toContain('export function addDoctorInfoBlock(');
    expect(genSrc).toContain('export function addDivider(');
    expect(genSrc).toContain('export function addParagraph(');
  });

  // PDF-04: Generator exports layout constants for templates
  it('PDF-04: generator exports layout constants (MARGIN, CONTENT_WIDTH, A4_WIDTH, colors)', () => {
    expect(genSrc).toContain('export {');
    expect(genSrc).toContain('MARGIN');
    expect(genSrc).toContain('CONTENT_WIDTH');
    expect(genSrc).toContain('A4_WIDTH');
    expect(genSrc).toContain('A4_HEIGHT');
    expect(genSrc).toContain('COLOR_PRIMARY');
    expect(genSrc).toContain('COLOR_ACCENT');
    expect(genSrc).toContain('COLOR_DANGER');
    expect(genSrc).toContain('FONT_BODY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Templates (PDF-05..PDF-07)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — Templates', () => {
  const tplSrc = readSource('lib/pdf/templates.ts');

  // PDF-05: Templates export all 5 PDF generators
  it('PDF-05: templates.ts exports generators for prescription, visit report, excuse, lab report, discharge summary', () => {
    expect(tplSrc).toContain('export async function generatePrescriptionPdf(');
    expect(tplSrc).toContain('export async function generateVisitReportPdf(');
    expect(tplSrc).toContain('export async function generateExcusePdf(');
    expect(tplSrc).toContain('export async function generateLabReportPdf(');
    expect(tplSrc).toContain('export async function generateDischargeSummaryPdf(');
  });

  // PDF-06: PrescriptionPdfData interface includes patient, doctor, facility, medications
  it('PDF-06: PrescriptionPdfData includes patient, doctor, facility, medications, and language', () => {
    expect(tplSrc).toContain('export interface PrescriptionPdfData');
    expect(tplSrc).toContain('patient: PatientInfo');
    expect(tplSrc).toContain('doctor: DoctorInfo');
    expect(tplSrc).toContain('facility: FacilityInfo');
    expect(tplSrc).toContain('medications: MedicationEntry[]');
    expect(tplSrc).toContain("language?: 'ar' | 'en'");
  });

  // PDF-07: Lab report supports flag codes (H, L, HH, LL, N)
  it('PDF-07: lab report template supports flag codes H, L, HH, LL, N via getFlagLabel', () => {
    expect(tplSrc).toContain("flag?: 'H' | 'L' | 'HH' | 'LL' | 'N'");
    expect(tplSrc).toContain('function getFlagLabel(');
    expect(tplSrc).toContain("case 'HH':");
    expect(tplSrc).toContain("return 'CRITICAL HIGH'");
    expect(tplSrc).toContain("case 'LL':");
    expect(tplSrc).toContain("return 'CRITICAL LOW'");
    expect(tplSrc).toContain("case 'H':");
    expect(tplSrc).toContain("return 'HIGH'");
    expect(tplSrc).toContain("case 'L':");
    expect(tplSrc).toContain("return 'LOW'");
    expect(tplSrc).toContain("case 'N':");
    expect(tplSrc).toContain("return 'Normal'");
    // Flag legend text
    expect(tplSrc).toContain('Flag Legend: H = High, L = Low, HH = Critical High, LL = Critical Low, N = Normal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Discharge Summary (PDF-08..PDF-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — Discharge Summary', () => {
  const tplSrc = readSource('lib/pdf/templates.ts');

  // PDF-08: Discharge summary calculates length of stay
  it('PDF-08: discharge summary calculates length of stay from admission/discharge dates', () => {
    expect(tplSrc).toContain('export interface DischargeSummaryPdfData');
    expect(tplSrc).toContain('admissionDate: string');
    expect(tplSrc).toContain('dischargeDate: string');
    // LOS calculation
    expect(tplSrc).toContain('(disDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)');
    expect(tplSrc).toContain("'Length of Stay'");
    expect(tplSrc).toContain('`${los} day(s)`');
  });

  // PDF-09: Discharge summary includes medications table and follow-up
  it('PDF-09: discharge summary supports dischargeMedications array and followUpInstructions', () => {
    expect(tplSrc).toContain('dischargeMedications?: Array<');
    expect(tplSrc).toContain('followUpInstructions?: string');
    expect(tplSrc).toContain("'Discharge Medications'");
    expect(tplSrc).toContain("'Follow-up Instructions'");
    expect(tplSrc).toContain('attendingDoctor: string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Excuse Letter (PDF-10..PDF-11)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — Medical Excuse', () => {
  const tplSrc = readSource('lib/pdf/templates.ts');

  // PDF-10: Excuse letter calculates total days
  it('PDF-10: excuse letter calculates total days between fromDate and toDate', () => {
    expect(tplSrc).toContain('export interface ExcusePdfData');
    expect(tplSrc).toContain('fromDate: string');
    expect(tplSrc).toContain('toDate: string');
    // Days calculation: +1 for inclusive
    expect(tplSrc).toContain("(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1");
    expect(tplSrc).toContain("'Total Days'");
    expect(tplSrc).toContain('`${days} day(s)`');
  });

  // PDF-11: Excuse letter has bilingual body text
  it('PDF-11: excuse letter includes bilingual body text (English + Arabic)', () => {
    expect(tplSrc).toContain("'Medical Excuse Letter'");
    expect(tplSrc).toContain("'To Whom It May Concern,'");
    expect(tplSrc).toContain('This is to certify that');
    expect(tplSrc).toContain('requires medical leave');
    // Arabic text (checking for known Arabic phrases used in the template)
    expect(tplSrc).toContain('bodyAr');
    expect(tplSrc).toContain('bodyEn');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Visit Report (PDF-12..PDF-13)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — Visit Report', () => {
  const tplSrc = readSource('lib/pdf/templates.ts');

  // PDF-12: Visit report includes vitals, diagnoses, and medications sections
  it('PDF-12: visit report includes vitals, diagnoses, and medications sections', () => {
    expect(tplSrc).toContain('export interface VisitReportPdfData');

    // Vitals section
    expect(tplSrc).toContain("'Vital Signs'");
    expect(tplSrc).toContain("'Blood Pressure'");
    expect(tplSrc).toContain("'Heart Rate'");
    expect(tplSrc).toContain("'Temperature'");
    expect(tplSrc).toContain("'SpO2'");

    // Diagnoses section
    expect(tplSrc).toContain("'Diagnoses'");
    expect(tplSrc).toContain("'ICD Code'");

    // Medications section
    expect(tplSrc).toContain("'Medications'");
    expect(tplSrc).toContain("'Dose'");
    expect(tplSrc).toContain("'Frequency'");
    expect(tplSrc).toContain("'Route'");
    expect(tplSrc).toContain("'Duration'");
  });

  // PDF-13: Visit report supports lab results with flag column
  it('PDF-13: visit report includes lab results table with Flag column', () => {
    expect(tplSrc).toContain("'Lab Results'");
    expect(tplSrc).toContain("['Test', 'Result', 'Unit', 'Reference', 'Flag']");
    expect(tplSrc).toContain('r.flag');
    expect(tplSrc).toContain('labResults?: Array<');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Confidentiality Notice (PDF-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — Confidentiality Notice', () => {
  const genSrc = readSource('lib/pdf/generator.ts');

  // PDF-14: Confidentiality notice is bilingual (English + Arabic)
  it('PDF-14: confidentiality notice includes English and Arabic PHI warnings', () => {
    expect(genSrc).toContain('CONFIDENTIAL: This document contains protected health information (PHI)');
    expect(genSrc).toContain('Unauthorized disclosure is prohibited');
    // Arabic text is encoded as unicode escapes in the source, but the function name confirms bilingual
    expect(genSrc).toContain('addConfidentialityNotice');
    expect(genSrc).toContain("language: 'ar' | 'en'");
    // Outputs both primary and secondary language
    expect(genSrc).toContain("language === 'ar' ? noticeAr : noticeEn");
    expect(genSrc).toContain("language === 'ar' ? noticeEn : noticeAr");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: QR Code Support (PDF-15)
// ─────────────────────────────────────────────────────────────────────────────
describe('PDF Engine — QR Code', () => {
  const genSrc = readSource('lib/pdf/generator.ts');

  // PDF-15: QR code function exists using qrcode library
  it('PDF-15: addQrCode uses qrcode library to embed PNG QR codes in PDF', () => {
    expect(genSrc).toContain('export async function addQrCode(');
    expect(genSrc).toContain("import QRCode from 'qrcode'");
    expect(genSrc).toContain('QRCode.toBuffer(data');
    expect(genSrc).toContain("type: 'png'");
    expect(genSrc).toContain("errorCorrectionLevel: 'M'");
    expect(genSrc).toContain('doc.image(pngBuffer');
  });
});
