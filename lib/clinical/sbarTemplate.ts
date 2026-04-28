/**
 * SBAR (Situation-Background-Assessment-Recommendation)
 * Standardized communication framework for clinical handoffs.
 * Required by CBAHI/JCI for nurse-to-doctor and shift handover communication.
 *
 * Can auto-populate from existing nursing data (vitals, MEWS, GCS, fall risk).
 */

export type SBARUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENT';

export interface SBARData {
  situation: {
    patientIdentifier: string;
    location: string;
    reason: string;
    onsetTime: string;
    currentStatus: string;
  };
  background: {
    admissionReason: string;
    relevantHistory: string;
    currentMedications: string;
    allergies: string;
    recentChanges: string;
    recentProcedures: string;
  };
  assessment: {
    currentVitals: string;
    clinicalImpression: string;
    changesFromBaseline: string;
    concernLevel: string;
    relevantScores: string;
  };
  recommendation: {
    requestedAction: string;
    timeframe: string;
    additionalTests: string;
    nursingPlan: string;
  };
  meta: {
    urgency: SBARUrgency;
    createdAt: string;
    completedAt: string | null;
    recipientRole: string;
    recipientName: string;
    method: 'VERBAL' | 'PHONE' | 'WRITTEN' | 'ELECTRONIC';
    readBackConfirmed: boolean;
  };
}

export const DEFAULT_SBAR: SBARData = {
  situation: {
    patientIdentifier: '',
    location: '',
    reason: '',
    onsetTime: '',
    currentStatus: '',
  },
  background: {
    admissionReason: '',
    relevantHistory: '',
    currentMedications: '',
    allergies: '',
    recentChanges: '',
    recentProcedures: '',
  },
  assessment: {
    currentVitals: '',
    clinicalImpression: '',
    changesFromBaseline: '',
    concernLevel: '',
    relevantScores: '',
  },
  recommendation: {
    requestedAction: '',
    timeframe: '',
    additionalTests: '',
    nursingPlan: '',
  },
  meta: {
    urgency: 'ROUTINE',
    createdAt: '',
    completedAt: null,
    recipientRole: '',
    recipientName: '',
    method: 'VERBAL',
    readBackConfirmed: false,
  },
};

export interface AutoPopulateContext {
  patient?: { fullName?: string; mrn?: string; dob?: string; gender?: string };
  clinicName?: string;
  vitals?: Record<string, any>;
  mewsResult?: { totalScore: number; riskLevel: string };
  gcsResult?: { totalScore: number; category: string };
  fallRiskResult?: { totalScore: number; riskLevel: string; scale: string };
  chiefComplaint?: string;
  allergies?: string;
  medications?: string;
  nursingNote?: string;
}

export function autoPopulateSBAR(ctx: AutoPopulateContext): Partial<SBARData> {
  const parts: Partial<SBARData> = {};

  if (ctx.patient || ctx.clinicName) {
    const id = [ctx.patient?.fullName, ctx.patient?.mrn ? `MRN: ${ctx.patient.mrn}` : ''].filter(Boolean).join(' — ');
    parts.situation = {
      ...DEFAULT_SBAR.situation,
      patientIdentifier: id,
      location: ctx.clinicName || '',
      reason: ctx.chiefComplaint || '',
    };
  }

  if (ctx.allergies || ctx.medications) {
    parts.background = {
      ...DEFAULT_SBAR.background,
      allergies: ctx.allergies || '',
      currentMedications: ctx.medications || '',
    };
  }

  if (ctx.vitals || ctx.mewsResult || ctx.gcsResult || ctx.fallRiskResult) {
    const vitalsSummary: string[] = [];
    if (ctx.vitals) {
      if (ctx.vitals.bp) vitalsSummary.push(`BP: ${ctx.vitals.bp}`);
      if (ctx.vitals.hr) vitalsSummary.push(`HR: ${ctx.vitals.hr}`);
      if (ctx.vitals.temp) vitalsSummary.push(`T: ${ctx.vitals.temp}°C`);
      if (ctx.vitals.rr) vitalsSummary.push(`RR: ${ctx.vitals.rr}`);
      if (ctx.vitals.spo2) vitalsSummary.push(`SpO2: ${ctx.vitals.spo2}%`);
    }

    const scores: string[] = [];
    if (ctx.mewsResult) scores.push(`NEWS2: ${ctx.mewsResult.totalScore} (${ctx.mewsResult.riskLevel})`);
    if (ctx.gcsResult) scores.push(`GCS: ${ctx.gcsResult.totalScore}/15 (${ctx.gcsResult.category})`);
    if (ctx.fallRiskResult) scores.push(`Fall Risk (${ctx.fallRiskResult.scale}): ${ctx.fallRiskResult.totalScore} (${ctx.fallRiskResult.riskLevel})`);

    parts.assessment = {
      ...DEFAULT_SBAR.assessment,
      currentVitals: vitalsSummary.join('  |  '),
      relevantScores: scores.join('  |  '),
    };
  }

  return parts;
}

export function calculateSBARCompleteness(sbar: SBARData): { completed: number; total: number; percent: number; sections: Record<string, boolean> } {
  const check = (val: string) => Boolean(val?.trim());

  const sComplete = check(sbar.situation.reason) && check(sbar.situation.currentStatus);
  const bComplete = check(sbar.background.relevantHistory) || check(sbar.background.admissionReason);
  const aComplete = check(sbar.assessment.clinicalImpression) || check(sbar.assessment.currentVitals);
  const rComplete = check(sbar.recommendation.requestedAction);

  const sections = { situation: sComplete, background: bComplete, assessment: aComplete, recommendation: rComplete };
  const completed = Object.values(sections).filter(Boolean).length;
  return { completed, total: 4, percent: Math.round((completed / 4) * 100), sections };
}

export const SBAR_URGENCY_OPTIONS: { value: SBARUrgency; labelAr: string; labelEn: string; colorClass: string }[] = [
  { value: 'ROUTINE', labelAr: 'روتيني', labelEn: 'Routine', colorClass: 'text-emerald-700 bg-emerald-50' },
  { value: 'URGENT', labelAr: 'عاجل', labelEn: 'Urgent', colorClass: 'text-amber-700 bg-amber-50' },
  { value: 'EMERGENT', labelAr: 'طارئ', labelEn: 'Emergent', colorClass: 'text-red-700 bg-red-50' },
];

export const SBAR_METHOD_OPTIONS: { value: SBARData['meta']['method']; labelAr: string; labelEn: string }[] = [
  { value: 'VERBAL', labelAr: 'شفهي مباشر', labelEn: 'Verbal (in person)' },
  { value: 'PHONE', labelAr: 'هاتفي', labelEn: 'Phone call' },
  { value: 'WRITTEN', labelAr: 'مكتوب', labelEn: 'Written' },
  { value: 'ELECTRONIC', labelAr: 'إلكتروني', labelEn: 'Electronic' },
];

export const SBAR_RECIPIENT_ROLES: { value: string; labelAr: string; labelEn: string }[] = [
  { value: 'ATTENDING_PHYSICIAN', labelAr: 'الطبيب المعالج', labelEn: 'Attending Physician' },
  { value: 'ON_CALL_PHYSICIAN', labelAr: 'طبيب المناوبة', labelEn: 'On-call Physician' },
  { value: 'SPECIALIST', labelAr: 'الاستشاري', labelEn: 'Specialist / Consultant' },
  { value: 'CHARGE_NURSE', labelAr: 'ممرض/ة مشرف/ة', labelEn: 'Charge Nurse' },
  { value: 'RAPID_RESPONSE', labelAr: 'فريق الاستجابة السريعة', labelEn: 'Rapid Response Team' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];
