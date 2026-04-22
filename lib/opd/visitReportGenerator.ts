// =============================================================================
// Smart Visit Report Generator — NEW FILE (no existing code modified)
// =============================================================================
// Compiles a comprehensive, structured visit report from all available data.

import { PrismaClient } from '@prisma/client';
import type { OpdVisitNote, PhysicalExam, OpdOrder, Attachment, LabResult, RadiologyReport, PatientMaster, EncounterCore } from '@prisma/client';

/** Extended visit note fields accessed from the SOAP note model */
interface VisitNoteFields {
  chiefComplaint?: string | null;
  hpi?: string | null;
  history?: string | null;
  historyOfPresentIllness?: string | null;
  examination?: string | null;
  physicalExam?: string | null;
  assessment?: string | null;
  diagnosis?: string | null;
  icdCodes?: DiagnosisEntry[] | null;
  diagnoses?: DiagnosisEntry[] | null;
  plan?: string | null;
  treatmentPlan?: string | null;
  followUp?: string | null;
  followUpPlan?: string | null;
  instructions?: string | null;
  patientInstructions?: string | null;
}

interface DiagnosisEntry {
  code?: string;
  icdCode?: string;
  description?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  name?: string;
}

/** Vitals data from PhysicalExam (stored in systems JSON) */
interface VitalsData {
  temperature?: number | null;
  heartRate?: number | null;
  bloodPressure?: string | null;
  systolic?: number | null;
  diastolic?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weight?: number | null;
  height?: number | null;
  bmi?: number | null;
}

/** Order fields accessed from OpdOrder */
interface OrderFields {
  orderType?: string | null;
  type?: string | null;
  name?: string | null;
  itemName?: string | null;
  medication?: string | null;
  nameAr?: string | null;
  itemNameAr?: string | null;
  label?: string | null;
  dose?: string | null;
  frequency?: string | null;
  route?: string | null;
  duration?: string | null;
  testName?: string | null;
  testNameAr?: string | null;
  studyName?: string | null;
  studyNameAr?: string | null;
  result?: string | null;
  findings?: string | null;
  impression?: string | null;
}

/** Attachment fields */
interface AttachmentFields {
  name?: string | null;
  fileName?: string | null;
  nameAr?: string | null;
  type?: string | null;
  mimeType?: string | null;
}

type VisitNote = OpdVisitNote & VisitNoteFields;
type VitalsRecord = PhysicalExam & VitalsData;
type OrderRecord = OpdOrder & OrderFields;
type AttachmentRecord = Attachment & AttachmentFields;
type LabRecord = LabResult & { testNameAr?: string | null; nameAr?: string | null; itemNameAr?: string | null; itemName?: string | null; name?: string | null; result?: string | null };
type RadRecord = RadiologyReport & { studyName?: string | null; studyNameAr?: string | null; nameAr?: string | null; itemNameAr?: string | null; itemName?: string | null; name?: string | null };

export interface VisitReportSection {
  key: string;
  titleAr: string;
  titleEn: string;
  content: string | null;
  contentAr: string | null;
  isEmpty: boolean;
  items?: Array<{ label: string; labelAr: string; value: string }>;
}

export interface VisitReportData {
  reportId: string;
  tenantId: string;
  encounterId: string;
  patient: {
    id: string;
    fullName: string;
    mrn: string;
    dob?: string;
    gender?: string;
    mobile?: string;
    nationality?: string;
    allergies?: string[];
  };
  visit: {
    date: string;
    department: string;
    doctor: string;
    doctorAr?: string;
    status: string;
    type: string;
    chiefComplaint?: string;
  };
  sections: VisitReportSection[];
  generatedAt: string;
  generatedBy?: string;
}

/**
 * Generate a comprehensive visit report by pulling from all sources
 */
export async function generateVisitReport(
  prisma: PrismaClient,
  tenantId: string,
  encounterCoreId: string,
  generatedBy?: string,
): Promise<VisitReportData | null> {
  // 1. Fetch encounter
  const encounter = await prisma.encounterCore.findFirst({
    where: { id: encounterCoreId, tenantId },
    include: { patient: true },
  });

  if (!encounter) return null;

  const patient = encounter.patient;

  // 2. Fetch all data in parallel
  const [
    visitNotes,
    orders,
    vitals,
    attachments,
    labResults,
    radiologyReports,
  ] = await Promise.all([
    prisma.opdVisitNote.findMany({
      where: { tenantId, encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => []),

    prisma.opdOrder.findMany({
      where: { tenantId, encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }).catch(() => []),

    prisma.physicalExam.findMany({
      where: { tenantId, encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => []),

    prisma.attachment.findMany({
      where: { tenantId, entityType: 'ENCOUNTER', entityId: encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => []),

    prisma.labResult.findMany({
      where: { tenantId, encounterId: encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => []),

    prisma.radiologyReport.findMany({
      where: { tenantId, encounterId: encounterCoreId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => []),
  ]);

  // 3. Build sections
  const sections: VisitReportSection[] = [];

  // Chief Complaint
  const latestNote = visitNotes[0] as VisitNote | undefined;
  const cc = latestNote?.chiefComplaint || (encounter as EncounterCore & { chiefComplaint?: string }).chiefComplaint;
  sections.push({
    key: 'chief_complaint',
    titleAr: 'الشكوى الرئيسية',
    titleEn: 'Chief Complaint',
    content: cc || null,
    contentAr: cc || null,
    isEmpty: !cc,
  });

  // History of Present Illness
  const hpi = latestNote?.hpi || latestNote?.history || latestNote?.historyOfPresentIllness;
  sections.push({
    key: 'hpi',
    titleAr: 'تاريخ المرض الحالي',
    titleEn: 'History of Present Illness',
    content: hpi || null,
    contentAr: hpi || null,
    isEmpty: !hpi,
  });

  // Vitals
  const latestVitals = vitals[0] as VitalsRecord | undefined;
  if (latestVitals) {
    const vData = latestVitals;
    sections.push({
      key: 'vitals',
      titleAr: 'العلامات الحيوية',
      titleEn: 'Vital Signs',
      content: null,
      contentAr: null,
      isEmpty: false,
      items: [
        vData.temperature && { label: 'Temperature', labelAr: 'الحرارة', value: `${vData.temperature} °C` },
        vData.heartRate && { label: 'Heart Rate', labelAr: 'النبض', value: `${vData.heartRate} bpm` },
        vData.bloodPressure && { label: 'Blood Pressure', labelAr: 'ضغط الدم', value: vData.bloodPressure },
        vData.systolic && { label: 'Blood Pressure', labelAr: 'ضغط الدم', value: `${vData.systolic}/${vData.diastolic}` },
        vData.respiratoryRate && { label: 'Respiratory Rate', labelAr: 'التنفس', value: `${vData.respiratoryRate} /min` },
        vData.oxygenSaturation && { label: 'SpO2', labelAr: 'تشبع الأكسجين', value: `${vData.oxygenSaturation}%` },
        vData.weight && { label: 'Weight', labelAr: 'الوزن', value: `${vData.weight} kg` },
        vData.height && { label: 'Height', labelAr: 'الطول', value: `${vData.height} cm` },
        vData.bmi && { label: 'BMI', labelAr: 'كتلة الجسم', value: `${vData.bmi}` },
      ].filter(Boolean) as VisitReportSection['items'],
    });
  } else {
    sections.push({
      key: 'vitals',
      titleAr: 'العلامات الحيوية',
      titleEn: 'Vital Signs',
      content: null,
      contentAr: null,
      isEmpty: true,
    });
  }

  // Examination
  const exam = latestNote?.examination || latestNote?.physicalExam;
  sections.push({
    key: 'examination',
    titleAr: 'الفحص السريري',
    titleEn: 'Physical Examination',
    content: exam || null,
    contentAr: exam || null,
    isEmpty: !exam,
  });

  // Assessment / Diagnosis
  const assessment = latestNote?.assessment || latestNote?.diagnosis;
  const icdCodes = latestNote?.icdCodes || latestNote?.diagnoses;
  sections.push({
    key: 'assessment',
    titleAr: 'التشخيص',
    titleEn: 'Assessment & Diagnosis',
    content: assessment || null,
    contentAr: assessment || null,
    isEmpty: !assessment && !icdCodes,
    items: Array.isArray(icdCodes)
      ? icdCodes.map((d: DiagnosisEntry) => ({
          label: d.code || d.icdCode || '',
          labelAr: d.descriptionAr || d.code || '',
          value: d.description || d.name || d.descriptionEn || '',
        }))
      : undefined,
  });

  // Plan
  const plan = latestNote?.plan || latestNote?.treatmentPlan;
  sections.push({
    key: 'plan',
    titleAr: 'الخطة العلاجية',
    titleEn: 'Treatment Plan',
    content: plan || null,
    contentAr: plan || null,
    isEmpty: !plan,
  });

  // Orders (Medications)
  const typedOrders = orders as OrderRecord[];
  const meds = typedOrders.filter((o) => o.orderType === 'medication' || o.type === 'medication');
  if (meds.length > 0) {
    sections.push({
      key: 'medications',
      titleAr: 'الأدوية',
      titleEn: 'Medications',
      content: null,
      contentAr: null,
      isEmpty: false,
      items: meds.map((m) => ({
        label: m.name || m.itemName || m.medication || '',
        labelAr: m.nameAr || m.itemNameAr || m.label || '',
        value: [m.dose, m.frequency, m.route, m.duration].filter(Boolean).join(' — ') || 'As directed',
      })),
    });
  }

  // Orders (Labs)
  const labOrders = typedOrders.filter((o) => o.orderType === 'lab' || o.type === 'lab');
  const typedLabResults = labResults as LabRecord[];
  if (labOrders.length > 0 || typedLabResults.length > 0) {
    const labItems = labOrders.length > 0 ? labOrders : typedLabResults;
    sections.push({
      key: 'lab',
      titleAr: 'التحاليل المخبرية',
      titleEn: 'Laboratory',
      content: null,
      contentAr: null,
      isEmpty: false,
      items: labItems.map((l) => ({
        label: l.testName || l.name || ('itemName' in l ? l.itemName : '') || '',
        labelAr: l.testNameAr || ('nameAr' in l ? l.nameAr : '') || ('itemNameAr' in l ? l.itemNameAr : '') || '',
        value: ('result' in l ? l.result : null) || l.status || 'Ordered',
      })),
    });
  }

  // Radiology
  const radOrders = typedOrders.filter((o) => o.orderType === 'radiology' || o.type === 'radiology');
  const typedRadReports = radiologyReports as RadRecord[];
  if (radOrders.length > 0 || typedRadReports.length > 0) {
    const radItems = radOrders.length > 0 ? radOrders : typedRadReports;
    sections.push({
      key: 'radiology',
      titleAr: 'الأشعة',
      titleEn: 'Radiology',
      content: null,
      contentAr: null,
      isEmpty: false,
      items: radItems.map((r) => ({
        label: ('studyName' in r ? r.studyName : null) || r.name || ('itemName' in r ? r.itemName : null) || '',
        labelAr: ('studyNameAr' in r ? r.studyNameAr : null) || ('nameAr' in r ? r.nameAr : null) || ('itemNameAr' in r ? r.itemNameAr : null) || '',
        value: ('findings' in r ? r.findings : null) || ('impression' in r ? r.impression : null) || r.status || 'Ordered',
      })),
    });
  }

  // Follow Up
  const followUp = latestNote?.followUp || latestNote?.followUpPlan;
  sections.push({
    key: 'follow_up',
    titleAr: 'المتابعة',
    titleEn: 'Follow Up',
    content: followUp || null,
    contentAr: followUp || null,
    isEmpty: !followUp,
  });

  // Instructions
  const instructions = latestNote?.instructions || latestNote?.patientInstructions;
  sections.push({
    key: 'instructions',
    titleAr: 'تعليمات المريض',
    titleEn: 'Patient Instructions',
    content: instructions || null,
    contentAr: instructions || null,
    isEmpty: !instructions,
  });

  // Attachments
  if (attachments.length > 0) {
    sections.push({
      key: 'attachments',
      titleAr: 'المرفقات',
      titleEn: 'Attachments',
      content: `${attachments.length} file(s) attached`,
      contentAr: `${attachments.length} ملف مرفق`,
      isEmpty: false,
      items: (attachments as AttachmentRecord[]).map((a) => ({
        label: a.name || a.fileName || 'File',
        labelAr: a.nameAr || a.name || 'ملف',
        value: a.type || a.mimeType || '',
      })),
    });
  }

  return {
    reportId: `VR-${Date.now()}`,
    tenantId,
    encounterId: encounterCoreId,
    patient: {
      id: patient.id,
      fullName: patient.fullName || `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim(),
      mrn: patient.mrn || '',
      dob: patient.dob?.toISOString?.() || undefined,
      gender: patient.gender ?? undefined,
      mobile: patient.mobile ?? undefined,
      nationality: patient.nationality ?? undefined,
      allergies: Array.isArray(patient.knownAllergies) ? patient.knownAllergies as string[] : undefined,
    },
    visit: {
      date: encounter.createdAt?.toISOString?.() || new Date().toISOString(),
      department: encounter.department || 'OPD',
      doctor: (encounter as EncounterCore & { doctorName?: string }).doctorName || '',
      doctorAr: (encounter as EncounterCore & { doctorNameAr?: string }).doctorNameAr,
      status: encounter.status || '',
      type: encounter.encounterType || 'OPD',
      chiefComplaint: cc,
    },
    sections,
    generatedAt: new Date().toISOString(),
    generatedBy,
  };
}

export type ReportFormat = 'json' | 'html' | 'text';

/**
 * Render a report to HTML for printing
 */
export function renderReportToHtml(
  report: VisitReportData,
  lang: 'ar' | 'en' = 'en',
): string {
  const isRTL = lang === 'ar';
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const sectionsHtml = report.sections
    .filter(s => !s.isEmpty)
    .map(s => {
      const title = isRTL ? s.titleAr : s.titleEn;
      let body = '';

      if (s.items && s.items.length > 0) {
        body = `<table style="width:100%;border-collapse:collapse;margin-top:4px">
          ${s.items.map(it => `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:500">${isRTL ? it.labelAr : it.label}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${it.value}</td>
          </tr>`).join('')}
        </table>`;
      } else {
        body = `<p style="margin:4px 0;white-space:pre-wrap">${isRTL ? (s.contentAr || s.content) : s.content}</p>`;
      }

      return `<div style="margin-bottom:16px">
        <h3 style="margin:0 0 4px;font-size:14px;color:#1e40af;border-bottom:1px solid #dbeafe;padding-bottom:4px">${title}</h3>
        ${body}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${tr('تقرير الزيارة', 'Visit Report')}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1f2937; font-size: 13px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
    .logo { font-size: 20px; font-weight: bold; color: #1e40af; }
    .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .patient-info dt { font-weight: 600; color: #64748b; font-size: 11px; }
    .patient-info dd { margin: 0 0 4px; }
    .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Thea EHR</div>
    <div style="text-align:${isRTL ? 'left' : 'right'}">
      <div style="font-weight:600">${tr('تقرير الزيارة', 'Visit Report')}</div>
      <div style="font-size:11px;color:#64748b">${report.reportId}</div>
    </div>
  </div>

  <dl class="patient-info">
    <dt>${tr('اسم المريض', 'Patient Name')}</dt><dd>${report.patient.fullName}</dd>
    <dt>${tr('رقم الملف', 'MRN')}</dt><dd>${report.patient.mrn}</dd>
    <dt>${tr('تاريخ الزيارة', 'Visit Date')}</dt><dd>${new Date(report.visit.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</dd>
    <dt>${tr('الطبيب', 'Doctor')}</dt><dd>${isRTL ? (report.visit.doctorAr || report.visit.doctor) : report.visit.doctor}</dd>
    <dt>${tr('القسم', 'Department')}</dt><dd>${report.visit.department}</dd>
    <dt>${tr('الحالة', 'Status')}</dt><dd>${report.visit.status}</dd>
  </dl>

  ${sectionsHtml}

  <div class="footer">
    <span>${tr('تم إنشاؤه', 'Generated')}: ${new Date(report.generatedAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
    <span>Thea EHR — ${tr('سري', 'Confidential')}</span>
  </div>
</body>
</html>`;
}

/**
 * Render report as plain text
 */
export function renderReportToText(
  report: VisitReportData,
  lang: 'ar' | 'en' = 'en',
): string {
  const isRTL = lang === 'ar';
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const lines: string[] = [];

  lines.push(`${'='.repeat(60)}`);
  lines.push(`  ${tr('تقرير الزيارة', 'VISIT REPORT')} — ${report.reportId}`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  lines.push(`${tr('المريض', 'Patient')}: ${report.patient.fullName} (MRN: ${report.patient.mrn})`);
  lines.push(`${tr('التاريخ', 'Date')}: ${report.visit.date}`);
  lines.push(`${tr('الطبيب', 'Doctor')}: ${isRTL ? (report.visit.doctorAr || report.visit.doctor) : report.visit.doctor}`);
  lines.push(`${tr('القسم', 'Dept')}: ${report.visit.department}`);
  lines.push('');

  for (const section of report.sections) {
    if (section.isEmpty) continue;
    const title = isRTL ? section.titleAr : section.titleEn;
    lines.push(`--- ${title} ---`);

    if (section.items && section.items.length > 0) {
      for (const item of section.items) {
        lines.push(`  ${isRTL ? item.labelAr : item.label}: ${item.value}`);
      }
    } else {
      lines.push(`  ${isRTL ? (section.contentAr || section.content) : section.content}`);
    }
    lines.push('');
  }

  lines.push(`${'─'.repeat(60)}`);
  lines.push(`${tr('تم إنشاؤه', 'Generated')}: ${report.generatedAt}`);
  lines.push(`Thea EHR — ${tr('سري', 'Confidential')}`);

  return lines.join('\n');
}
