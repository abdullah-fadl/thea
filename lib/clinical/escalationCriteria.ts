// ─────────────────────────────────────────────────────────────────────────────
// ICU/CCU Escalation & Step-Down Criteria — Bilingual constants and utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface EscalationReason {
  key: string;
  labelEn: string;
  labelAr: string;
  category: 'vitals' | 'respiratory' | 'neurological' | 'cardiac' | 'other';
}

// ── Reasons to escalate from ward to ICU/CCU ────────────────────────────────

export const ESCALATION_REASONS: EscalationReason[] = [
  { key: 'hemodynamic_instability', labelEn: 'Hemodynamic Instability', labelAr: 'عدم استقرار ديناميكي', category: 'cardiac' },
  { key: 'respiratory_failure', labelEn: 'Respiratory Failure', labelAr: 'فشل تنفسي', category: 'respiratory' },
  { key: 'decreased_consciousness', labelEn: 'Decreased Level of Consciousness', labelAr: 'انخفاض مستوى الوعي', category: 'neurological' },
  { key: 'vasopressor_requirement', labelEn: 'Vasopressor Requirement', labelAr: 'حاجة لأدوية ضاغطة للأوعية', category: 'cardiac' },
  { key: 'ventilator_requirement', labelEn: 'Mechanical Ventilation Required', labelAr: 'حاجة للتنفس الاصطناعي', category: 'respiratory' },
  { key: 'acute_organ_failure', labelEn: 'Acute Organ Failure', labelAr: 'فشل عضوي حاد', category: 'other' },
  { key: 'post_cardiac_arrest', labelEn: 'Post Cardiac Arrest', labelAr: 'ما بعد توقف القلب', category: 'cardiac' },
  { key: 'septic_shock', labelEn: 'Septic Shock', labelAr: 'صدمة إنتانية', category: 'other' },
  { key: 'high_mews_score', labelEn: 'High MEWS/NEWS Score (≥7)', labelAr: 'ارتفاع مقياس الإنذار المبكر (≥7)', category: 'vitals' },
  { key: 'post_operative_monitoring', labelEn: 'Post-Operative Monitoring Required', labelAr: 'مراقبة ما بعد العملية مطلوبة', category: 'other' },
];

// ── Reasons to step down from ICU/CCU to ward ───────────────────────────────

export const STEP_DOWN_REASONS: EscalationReason[] = [
  { key: 'hemodynamic_stability', labelEn: 'Hemodynamically Stable >24h', labelAr: 'استقرار ديناميكي >24 ساعة', category: 'cardiac' },
  { key: 'weaned_from_ventilator', labelEn: 'Successfully Weaned from Ventilator', labelAr: 'فطام ناجح عن جهاز التنفس', category: 'respiratory' },
  { key: 'vasopressors_weaned', labelEn: 'Vasopressors Weaned', labelAr: 'فطام عن الأدوية الضاغطة', category: 'cardiac' },
  { key: 'improved_consciousness', labelEn: 'Improved Level of Consciousness', labelAr: 'تحسن مستوى الوعي', category: 'neurological' },
  { key: 'no_organ_support', labelEn: 'No Organ Support Required', labelAr: 'لا حاجة لدعم الأعضاء', category: 'other' },
  { key: 'low_sofa_score', labelEn: 'Low SOFA Score (<6)', labelAr: 'انخفاض مقياس SOFA (<6)', category: 'vitals' },
];

// ── Auto-suggest escalation based on acuity data ────────────────────────────

export interface AcuityInput {
  mewsScore?: number;
  sofaTotal?: number;
  gcsScore?: number;
}

export function suggestEscalation(acuity: AcuityInput): { suggest: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (acuity.mewsScore !== undefined && acuity.mewsScore >= 7) {
    reasons.push('high_mews_score');
  }
  if (acuity.sofaTotal !== undefined && acuity.sofaTotal >= 10) {
    reasons.push('acute_organ_failure');
  }
  if (acuity.gcsScore !== undefined && acuity.gcsScore <= 8) {
    reasons.push('decreased_consciousness');
  }

  return { suggest: reasons.length > 0, reasons };
}

// ── Helper to get reason label by key ───────────────────────────────────────

export function getReasonLabel(
  key: string,
  language: 'ar' | 'en',
  type: 'escalation' | 'step_down' = 'escalation',
): string {
  const list = type === 'step_down' ? STEP_DOWN_REASONS : ESCALATION_REASONS;
  const reason = list.find((r) => r.key === key);
  if (!reason) return key;
  return language === 'ar' ? reason.labelAr : reason.labelEn;
}
