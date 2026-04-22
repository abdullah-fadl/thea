/**
 * Thea EHR - PDF Document Templates
 *
 * Pre-built templates for the most common clinical documents:
 *   1. Prescription
 *   2. Visit Report
 *   3. Medical Excuse
 *   4. Lab Report
 *   5. Discharge Summary
 *
 * Each template accepts structured data, composes a PDF using the core
 * generator functions, and returns a Uint8Array ready for HTTP response.
 */

import {
  createPdfDocument,
  addSectionHeader,
  addFieldRow,
  addTable,
  addMedicationRow,
  addQrCode,
  addSignatureLine,
  addConfidentialityNotice,
  addPatientInfoBlock,
  addDoctorInfoBlock,
  addDivider,
  addParagraph,
  pdfToBuffer,
  MARGIN,
  CONTENT_WIDTH,
  A4_WIDTH,
  COLOR_DANGER,
  COLOR_WARNING,
  COLOR_BLACK,
  COLOR_MUTED,
  FONT_BODY,
  FONT_SMALL,
} from './generator';

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

interface PatientInfo {
  name: string;
  nameAr?: string;
  mrn: string;
  dob?: string;
  gender?: string;
}

interface DoctorInfo {
  name: string;
  nameAr?: string;
  licenseNo?: string;
  specialty?: string;
}

interface FacilityInfo {
  name: string;
  nameAr?: string;
}

interface MedicationEntry {
  name: string;
  nameAr?: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  instructions?: string;
}

// ---------------------------------------------------------------------------
// 1. Prescription PDF
// ---------------------------------------------------------------------------

export interface PrescriptionPdfData {
  patient: PatientInfo;
  doctor: DoctorInfo;
  facility: FacilityInfo;
  medications: MedicationEntry[];
  date: string;
  visitId?: string;
  language?: 'ar' | 'en';
}

/**
 * Generate a medical prescription PDF.
 *
 * Layout:
 *   - Hospital header with title "Medical Prescription / \u0648\u0635\u0641\u0629 \u0637\u0628\u064a\u0629"
 *   - Patient info block
 *   - Doctor info block
 *   - Numbered medication list with dose/frequency/route/duration/instructions
 *   - QR code encoding visit reference (if visitId provided)
 *   - Signature line
 *   - Confidentiality notice
 */
export async function generatePrescriptionPdf(
  data: PrescriptionPdfData,
): Promise<Uint8Array> {
  const lang = data.language || 'en';

  const doc = await createPdfDocument({
    title: 'Medical Prescription',
    titleAr: '\u0648\u0635\u0641\u0629 \u0637\u0628\u064a\u0629',
    facilityName: data.facility.name,
    facilityNameAr: data.facility.nameAr,
    headerDate: data.date,
    language: lang,
  });

  // Patient info
  addPatientInfoBlock(doc, data.patient);

  // Doctor info
  addDoctorInfoBlock(doc, data.doctor);

  // Medications section
  addSectionHeader(
    doc,
    'Prescribed Medications',
    '\u0627\u0644\u0623\u062f\u0648\u064a\u0629 \u0627\u0644\u0645\u0648\u0635\u0648\u0641\u0629',
  );

  if (data.medications.length === 0) {
    addParagraph(doc, 'No medications prescribed.', { italic: true, color: COLOR_MUTED });
  } else {
    data.medications.forEach((med, idx) => {
      addMedicationRow(doc, med, idx + 1);
    });
  }

  // QR code with visit reference
  if (data.visitId) {
    doc.moveDown(1);
    const qrData = JSON.stringify({
      type: 'prescription',
      visitId: data.visitId,
      mrn: data.patient.mrn,
      date: data.date,
      facility: data.facility.name,
    });
    await addQrCode(doc, qrData, A4_WIDTH - MARGIN - 80, doc.y, 70);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR_MUTED)
      .text('Scan to verify', A4_WIDTH - MARGIN - 80, doc.y + 72, {
        width: 70,
        align: 'center',
      });
    doc.y = Math.max(doc.y, doc.y); // ensure cursor is past QR
  }

  // Signature
  addSignatureLine(
    doc,
    'Physician Signature',
    '\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0637\u0628\u064a\u0628',
  );

  // Confidentiality
  addConfidentialityNotice(doc, lang);

  return pdfToBuffer(doc);
}

// ---------------------------------------------------------------------------
// 2. Visit Report PDF
// ---------------------------------------------------------------------------

export interface VisitReportPdfData {
  patient: PatientInfo;
  doctor: DoctorInfo;
  facility: FacilityInfo;
  encounter: {
    date: string;
    chiefComplaint?: string;
    chiefComplaintAr?: string;
    hpi?: string;
    vitals?: {
      bp?: string;
      hr?: string;
      temp?: string;
      rr?: string;
      spo2?: string;
      weight?: string;
      height?: string;
    };
    assessment?: string;
    assessmentAr?: string;
    plan?: string;
    planAr?: string;
    diagnoses?: Array<{
      code?: string;
      description: string;
      descriptionAr?: string;
    }>;
    medications?: Array<{
      name: string;
      dose: string;
      frequency: string;
      route: string;
      duration: string;
    }>;
    labResults?: Array<{
      test: string;
      result: string;
      unit?: string;
      reference?: string;
      flag?: string;
    }>;
    followUp?: string;
    instructions?: string;
    instructionsAr?: string;
  };
  language?: 'ar' | 'en';
}

/**
 * Generate a comprehensive visit report PDF.
 *
 * Includes chief complaint, vitals table, assessment, plan, diagnoses,
 * medications, lab results, follow-up, and patient instructions.
 */
export async function generateVisitReportPdf(
  data: VisitReportPdfData,
): Promise<Uint8Array> {
  const lang = data.language || 'en';
  const enc = data.encounter;

  const doc = await createPdfDocument({
    title: 'Visit Report',
    titleAr: '\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0632\u064a\u0627\u0631\u0629',
    facilityName: data.facility.name,
    facilityNameAr: data.facility.nameAr,
    headerDate: enc.date,
    language: lang,
  });

  // Patient & Doctor
  addPatientInfoBlock(doc, data.patient);
  addDoctorInfoBlock(doc, data.doctor);

  // Chief Complaint
  if (enc.chiefComplaint) {
    addSectionHeader(
      doc,
      'Chief Complaint',
      '\u0627\u0644\u0634\u0643\u0648\u0649 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
    );
    addParagraph(doc, enc.chiefComplaint);
    if (enc.chiefComplaintAr) {
      addParagraph(doc, enc.chiefComplaintAr, { italic: true, color: COLOR_MUTED });
    }
  }

  // HPI
  if (enc.hpi) {
    addSectionHeader(
      doc,
      'History of Present Illness',
      '\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u0631\u0636\u064a \u0627\u0644\u062d\u0627\u0644\u064a',
    );
    addParagraph(doc, enc.hpi);
  }

  // Vitals
  if (enc.vitals) {
    const v = enc.vitals;
    const vitalsEntries = [
      v.bp ? ['Blood Pressure', v.bp] : null,
      v.hr ? ['Heart Rate', `${v.hr} bpm`] : null,
      v.temp ? ['Temperature', `${v.temp} \u00b0C`] : null,
      v.rr ? ['Respiratory Rate', `${v.rr} /min`] : null,
      v.spo2 ? ['SpO2', `${v.spo2}%`] : null,
      v.weight ? ['Weight', `${v.weight} kg`] : null,
      v.height ? ['Height', `${v.height} cm`] : null,
    ].filter(Boolean) as string[][];

    if (vitalsEntries.length > 0) {
      addSectionHeader(
        doc,
        'Vital Signs',
        '\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u062d\u064a\u0648\u064a\u0629',
      );
      addTable(
        doc,
        ['Parameter', 'Value'],
        vitalsEntries,
        { columnWidths: [CONTENT_WIDTH * 0.5, CONTENT_WIDTH * 0.5] },
      );
    }
  }

  // Assessment
  if (enc.assessment) {
    addSectionHeader(
      doc,
      'Assessment',
      '\u0627\u0644\u062a\u0642\u064a\u064a\u0645',
    );
    addParagraph(doc, enc.assessment);
    if (enc.assessmentAr) {
      addParagraph(doc, enc.assessmentAr, { italic: true, color: COLOR_MUTED });
    }
  }

  // Plan
  if (enc.plan) {
    addSectionHeader(
      doc,
      'Plan',
      '\u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0639\u0644\u0627\u062c\u064a\u0629',
    );
    addParagraph(doc, enc.plan);
    if (enc.planAr) {
      addParagraph(doc, enc.planAr, { italic: true, color: COLOR_MUTED });
    }
  }

  // Diagnoses
  if (enc.diagnoses && enc.diagnoses.length > 0) {
    addSectionHeader(
      doc,
      'Diagnoses',
      '\u0627\u0644\u062a\u0634\u062e\u064a\u0635\u0627\u062a',
    );
    const diagRows = enc.diagnoses.map((d) => [
      d.code || '\u2014',
      d.descriptionAr ? `${d.description} / ${d.descriptionAr}` : d.description,
    ]);
    addTable(doc, ['ICD Code', 'Description'], diagRows, {
      columnWidths: [CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.8],
    });
  }

  // Medications
  if (enc.medications && enc.medications.length > 0) {
    addSectionHeader(
      doc,
      'Medications',
      '\u0627\u0644\u0623\u062f\u0648\u064a\u0629',
    );
    const medRows = enc.medications.map((m) => [
      m.name,
      m.dose,
      m.frequency,
      m.route,
      m.duration,
    ]);
    addTable(doc, ['Medication', 'Dose', 'Frequency', 'Route', 'Duration'], medRows, {
      columnWidths: [
        CONTENT_WIDTH * 0.3,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.2,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.2,
      ],
    });
  }

  // Lab Results
  if (enc.labResults && enc.labResults.length > 0) {
    addSectionHeader(
      doc,
      'Lab Results',
      '\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0645\u062e\u062a\u0628\u0631',
    );
    const labRows = enc.labResults.map((r) => [
      r.test,
      r.result,
      r.unit || '',
      r.reference || '',
      r.flag || '',
    ]);
    addTable(doc, ['Test', 'Result', 'Unit', 'Reference', 'Flag'], labRows, {
      columnWidths: [
        CONTENT_WIDTH * 0.3,
        CONTENT_WIDTH * 0.2,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.2,
        CONTENT_WIDTH * 0.15,
      ],
    });
  }

  // Follow-up
  if (enc.followUp) {
    addSectionHeader(
      doc,
      'Follow-up',
      '\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629',
    );
    addParagraph(doc, enc.followUp);
  }

  // Patient instructions
  if (enc.instructions) {
    addSectionHeader(
      doc,
      'Patient Instructions',
      '\u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u064a\u0636',
    );
    addParagraph(doc, enc.instructions);
    if (enc.instructionsAr) {
      addParagraph(doc, enc.instructionsAr, { italic: true, color: COLOR_MUTED });
    }
  }

  // Signature
  addSignatureLine(
    doc,
    'Physician Signature',
    '\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0637\u0628\u064a\u0628',
  );

  addConfidentialityNotice(doc, lang);

  return pdfToBuffer(doc);
}

// ---------------------------------------------------------------------------
// 3. Medical Excuse PDF
// ---------------------------------------------------------------------------

export interface ExcusePdfData {
  patient: PatientInfo;
  doctor: DoctorInfo;
  facility: FacilityInfo;
  excuseDate: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  language?: 'ar' | 'en';
}

/**
 * Generate a medical excuse letter PDF.
 *
 * A formal letter addressed "To Whom It May Concern" certifying that the
 * patient requires medical leave for the specified period.
 */
export async function generateExcusePdf(
  data: ExcusePdfData,
): Promise<Uint8Array> {
  const lang = data.language || 'en';

  const doc = await createPdfDocument({
    title: 'Medical Excuse Letter',
    titleAr: '\u0625\u0641\u0627\u062f\u0629 \u0637\u0628\u064a\u0629',
    facilityName: data.facility.name,
    facilityNameAr: data.facility.nameAr,
    headerDate: data.excuseDate,
    language: lang,
  });

  // Greeting
  doc.moveDown(1);
  addParagraph(doc, 'To Whom It May Concern,', { bold: true, fontSize: 12 });
  doc.moveDown(0.3);
  addParagraph(
    doc,
    '\u0625\u0644\u0649 \u0645\u0646 \u064a\u0647\u0645\u0647 \u0627\u0644\u0623\u0645\u0631\u060c',
    { italic: true, color: COLOR_MUTED },
  );
  doc.moveDown(0.8);

  // Body text (English)
  const patientDisplay = data.patient.nameAr
    ? `${data.patient.name} (${data.patient.nameAr})`
    : data.patient.name;

  const bodyEn =
    `This is to certify that ${patientDisplay}, MRN: ${data.patient.mrn}, ` +
    `was seen at ${data.facility.name} on ${data.excuseDate}. ` +
    `Based on the medical evaluation, the patient requires medical leave ` +
    `from ${data.fromDate} to ${data.toDate} (inclusive).`;

  addParagraph(doc, bodyEn);
  doc.moveDown(0.5);

  // Body text (Arabic)
  const bodyAr =
    `\u0646\u0641\u064a\u062f \u0628\u0623\u0646 \u0627\u0644\u0645\u0631\u064a\u0636/\u0629 ${patientDisplay}\u060c ` +
    `\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641: ${data.patient.mrn}\u060c ` +
    `\u0642\u062f \u0631\u0627\u062c\u0639/\u062a ${data.facility.nameAr || data.facility.name} ` +
    `\u0628\u062a\u0627\u0631\u064a\u062e ${data.excuseDate}. ` +
    `\u0648\u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0637\u0628\u064a\u060c ` +
    `\u064a\u062d\u062a\u0627\u062c/\u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u0625\u062c\u0627\u0632\u0629 \u0645\u0631\u0636\u064a\u0629 ` +
    `\u0645\u0646 ${data.fromDate} \u0625\u0644\u0649 ${data.toDate}.`;

  addParagraph(doc, bodyAr, { italic: true, color: COLOR_MUTED });
  doc.moveDown(0.5);

  // Reason (if provided)
  if (data.reason) {
    addSectionHeader(doc, 'Reason', '\u0627\u0644\u0633\u0628\u0628');
    addParagraph(doc, data.reason);
  }

  // Leave details
  addDivider(doc);
  addFieldRow(doc, 'Leave From', data.fromDate, '\u0645\u0646');
  addFieldRow(doc, 'Leave To', data.toDate, '\u0625\u0644\u0649');

  // Calculate days
  const from = new Date(data.fromDate);
  const to = new Date(data.toDate);
  if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
    const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    addFieldRow(doc, 'Total Days', `${days} day(s)`, '\u0639\u062f\u062f \u0627\u0644\u0623\u064a\u0627\u0645');
  }

  doc.moveDown(1);

  // Doctor info
  addDoctorInfoBlock(doc, data.doctor);

  // Signatures
  addSignatureLine(
    doc,
    'Physician Signature',
    '\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0637\u0628\u064a\u0628',
  );
  addSignatureLine(
    doc,
    'Official Stamp',
    '\u0627\u0644\u062e\u062a\u0645 \u0627\u0644\u0631\u0633\u0645\u064a',
  );

  addConfidentialityNotice(doc, lang);

  return pdfToBuffer(doc);
}

// ---------------------------------------------------------------------------
// 4. Lab Report PDF
// ---------------------------------------------------------------------------

export interface LabReportPdfData {
  patient: PatientInfo;
  facility: FacilityInfo;
  orderDate: string;
  reportDate: string;
  orderedBy: string;
  results: Array<{
    testName: string;
    testNameAr?: string;
    result: string;
    unit?: string;
    referenceRange?: string;
    flag?: 'H' | 'L' | 'HH' | 'LL' | 'N';
  }>;
  language?: 'ar' | 'en';
}

/**
 * Generate a laboratory report PDF.
 *
 * Features:
 *   - Color-coded flags: HH/LL in red (critical), H/L in orange (abnormal)
 *   - Results table with test name, result, unit, reference range, flag
 *   - Order date and report date displayed
 *   - Auto-pagination for long result lists
 */
export async function generateLabReportPdf(
  data: LabReportPdfData,
): Promise<Uint8Array> {
  const lang = data.language || 'en';

  const doc = await createPdfDocument({
    title: 'Laboratory Report',
    titleAr: '\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0645\u062e\u062a\u0628\u0631',
    facilityName: data.facility.name,
    facilityNameAr: data.facility.nameAr,
    headerDate: data.reportDate,
    language: lang,
  });

  // Patient info
  addPatientInfoBlock(doc, data.patient);

  // Order metadata
  addSectionHeader(
    doc,
    'Order Information',
    '\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0637\u0644\u0628',
  );
  addFieldRow(doc, 'Ordered By', data.orderedBy, '\u0637\u0628\u064a\u0628 \u0627\u0644\u0625\u062d\u0627\u0644\u0629');
  addFieldRow(doc, 'Order Date', data.orderDate, '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0637\u0644\u0628');
  addFieldRow(doc, 'Report Date', data.reportDate, '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0642\u0631\u064a\u0631');

  // Results table
  addSectionHeader(
    doc,
    'Results',
    '\u0627\u0644\u0646\u062a\u0627\u0626\u062c',
  );

  if (data.results.length === 0) {
    addParagraph(doc, 'No results available.', { italic: true, color: COLOR_MUTED });
  } else {
    // Build rows with flag indicators
    const headers = ['Test', 'Result', 'Unit', 'Reference', 'Flag'];
    const rows = data.results.map((r) => {
      const flagLabel = getFlagLabel(r.flag);
      const testDisplay = r.testNameAr
        ? `${r.testName} (${r.testNameAr})`
        : r.testName;
      return [testDisplay, r.result, r.unit || '', r.referenceRange || '', flagLabel];
    });

    addTable(doc, headers, rows, {
      columnWidths: [
        CONTENT_WIDTH * 0.32,
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.22,
        CONTENT_WIDTH * 0.16,
      ],
    });

    // Flag legend
    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(FONT_SMALL)
      .fillColor(COLOR_MUTED)
      .text(
        'Flag Legend: H = High, L = Low, HH = Critical High, LL = Critical Low, N = Normal',
        MARGIN,
        doc.y,
        { width: CONTENT_WIDTH },
      );
    doc.fillColor(COLOR_BLACK);
  }

  addConfidentialityNotice(doc, lang);

  return pdfToBuffer(doc);
}

// ---------------------------------------------------------------------------
// 5. Discharge Summary PDF
// ---------------------------------------------------------------------------

export interface DischargeSummaryPdfData {
  patient: PatientInfo;
  facility: FacilityInfo;
  admissionDate: string;
  dischargeDate: string;
  attendingDoctor: string;
  admissionDiagnosis: string;
  dischargeDiagnosis: string;
  procedures?: string[];
  dischargeMedications?: Array<{
    name: string;
    dose: string;
    frequency: string;
    duration: string;
  }>;
  followUpInstructions?: string;
  language?: 'ar' | 'en';
}

/**
 * Generate a discharge summary PDF.
 *
 * Includes admission/discharge dates, diagnoses, procedures performed,
 * discharge medications, and follow-up instructions.
 */
export async function generateDischargeSummaryPdf(
  data: DischargeSummaryPdfData,
): Promise<Uint8Array> {
  const lang = data.language || 'en';

  const doc = await createPdfDocument({
    title: 'Discharge Summary',
    titleAr: '\u0645\u0644\u062e\u0635 \u0627\u0644\u062e\u0631\u0648\u062c',
    facilityName: data.facility.name,
    facilityNameAr: data.facility.nameAr,
    headerDate: data.dischargeDate,
    language: lang,
  });

  // Patient info
  addPatientInfoBlock(doc, data.patient);

  // Admission details
  addSectionHeader(
    doc,
    'Admission Details',
    '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
  );
  addFieldRow(doc, 'Admission Date', data.admissionDate, '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062f\u062e\u0648\u0644');
  addFieldRow(doc, 'Discharge Date', data.dischargeDate, '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062e\u0631\u0648\u062c');
  addFieldRow(doc, 'Attending Doctor', data.attendingDoctor, '\u0627\u0644\u0637\u0628\u064a\u0628 \u0627\u0644\u0645\u0639\u0627\u0644\u062c');

  // Calculate length of stay
  const admDate = new Date(data.admissionDate);
  const disDate = new Date(data.dischargeDate);
  if (!isNaN(admDate.getTime()) && !isNaN(disDate.getTime())) {
    const los = Math.round(
      (disDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    addFieldRow(doc, 'Length of Stay', `${los} day(s)`, '\u0645\u062f\u0629 \u0627\u0644\u0625\u0642\u0627\u0645\u0629');
  }

  // Diagnoses
  addSectionHeader(
    doc,
    'Diagnoses',
    '\u0627\u0644\u062a\u0634\u062e\u064a\u0635\u0627\u062a',
  );
  addFieldRow(doc, 'Admission Diagnosis', data.admissionDiagnosis, '\u062a\u0634\u062e\u064a\u0635 \u0627\u0644\u062f\u062e\u0648\u0644');
  addFieldRow(doc, 'Discharge Diagnosis', data.dischargeDiagnosis, '\u062a\u0634\u062e\u064a\u0635 \u0627\u0644\u062e\u0631\u0648\u062c');

  // Procedures
  if (data.procedures && data.procedures.length > 0) {
    addSectionHeader(
      doc,
      'Procedures Performed',
      '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a',
    );
    const procRows = data.procedures.map((p, i) => [String(i + 1), p]);
    addTable(doc, ['#', 'Procedure'], procRows, {
      columnWidths: [CONTENT_WIDTH * 0.1, CONTENT_WIDTH * 0.9],
    });
  }

  // Discharge medications
  if (data.dischargeMedications && data.dischargeMedications.length > 0) {
    addSectionHeader(
      doc,
      'Discharge Medications',
      '\u0623\u062f\u0648\u064a\u0629 \u0627\u0644\u062e\u0631\u0648\u062c',
    );
    const medRows = data.dischargeMedications.map((m) => [
      m.name,
      m.dose,
      m.frequency,
      m.duration,
    ]);
    addTable(doc, ['Medication', 'Dose', 'Frequency', 'Duration'], medRows, {
      columnWidths: [
        CONTENT_WIDTH * 0.35,
        CONTENT_WIDTH * 0.2,
        CONTENT_WIDTH * 0.25,
        CONTENT_WIDTH * 0.2,
      ],
    });
  }

  // Follow-up instructions
  if (data.followUpInstructions) {
    addSectionHeader(
      doc,
      'Follow-up Instructions',
      '\u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629',
    );
    addParagraph(doc, data.followUpInstructions);
  }

  // Signature
  addSignatureLine(
    doc,
    'Attending Physician',
    '\u0627\u0644\u0637\u0628\u064a\u0628 \u0627\u0644\u0645\u0639\u0627\u0644\u062c',
  );

  addConfidentialityNotice(doc, lang);

  return pdfToBuffer(doc);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a flag code to a display label. */
function getFlagLabel(flag?: string): string {
  switch (flag) {
    case 'HH':
      return 'CRITICAL HIGH';
    case 'LL':
      return 'CRITICAL LOW';
    case 'H':
      return 'HIGH';
    case 'L':
      return 'LOW';
    case 'N':
      return 'Normal';
    default:
      return '';
  }
}
