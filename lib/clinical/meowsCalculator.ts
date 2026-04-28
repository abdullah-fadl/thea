/**
 * MEOWS — Modified Early Obstetric Warning Score
 * Based on RCOG (Royal College of Obstetricians and Gynaecologists) guidelines.
 *
 * Specifically adapted for pregnant and postpartum patients.
 * Normal physiological ranges differ from the general NEWS2 scoring.
 * Used in ObGyn ward, antenatal/postnatal clinics, and labor units.
 */

export type MEOWSConsciousness = 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
export type MEOWSProteinuria = 'NONE' | 'TRACE' | 'PLUS1' | 'PLUS2_OR_MORE';

export interface MEOWSInput {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  hr?: number | null;
  rr?: number | null;
  temp?: number | null;
  spo2?: number | null;
  consciousness?: MEOWSConsciousness | null;
  proteinuria?: MEOWSProteinuria | null;
  lochia?: 'NORMAL' | 'HEAVY' | 'ABSENT' | null; // postpartum
}

export interface MEOWSParameterScore {
  parameter: string;
  value: number | string | null;
  score: number;
  labelAr: string;
  labelEn: string;
}

export type MEOWSRiskLevel = 'NORMAL' | 'CAUTION' | 'URGENT' | 'EMERGENCY';

export interface MEOWSResult {
  totalScore: number;
  riskLevel: MEOWSRiskLevel;
  parameters: MEOWSParameterScore[];
  hasSingleTrigger: boolean; // any single parameter ≥ 2 triggers escalation
  clinicalResponseAr: string;
  clinicalResponseEn: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  monitoringFrequencyAr: string;
  monitoringFrequencyEn: string;
  parametersCompleted: number;
  parametersTotal: number;
}

// ── Scoring Functions (obstetric-specific thresholds) ─────────────────────────

function scoreSystolicBP(sys: number): number {
  if (sys >= 200) return 3;
  if (sys >= 160) return 2;
  if (sys >= 150) return 1;
  if (sys >= 100) return 0; // normal obstetric range
  if (sys >= 90) return 1;
  return 3; // <90 → critical
}

function scoreDiastolicBP(dias: number): number {
  if (dias >= 110) return 3;
  if (dias >= 100) return 2;
  if (dias >= 90) return 1;
  return 0;
}

function scoreHR(hr: number): number {
  if (hr >= 130) return 3;
  if (hr >= 110) return 2;
  if (hr >= 100) return 1;
  if (hr >= 50) return 0; // normal in pregnancy is slightly elevated (60-100)
  if (hr >= 40) return 1;
  return 3; // <40
}

function scoreRR(rr: number): number {
  if (rr >= 30) return 3;
  if (rr >= 25) return 2;
  if (rr >= 21) return 1;
  if (rr >= 11) return 0;
  return 2; // ≤10 (hypoventilation)
}

function scoreTemp(temp: number): number {
  if (temp >= 39.0) return 2;
  if (temp >= 38.0) return 1;
  if (temp >= 36.0) return 0;
  if (temp >= 35.0) return 1;
  return 3; // <35 → hypothermia
}

function scoreSpO2(spo2: number): number {
  if (spo2 < 90) return 3;
  if (spo2 < 93) return 2;
  if (spo2 < 95) return 1;
  return 0; // ≥95
}

function scoreConsciousness(level: MEOWSConsciousness): number {
  switch (level) {
    case 'ALERT': return 0;
    case 'VOICE': return 2;
    case 'PAIN': return 3;
    case 'UNRESPONSIVE': return 3;
  }
}

function scoreProteinuria(p: MEOWSProteinuria): number {
  switch (p) {
    case 'NONE': return 0;
    case 'TRACE': return 0;
    case 'PLUS1': return 1;
    case 'PLUS2_OR_MORE': return 2;
  }
}

function scoreLochia(l: 'NORMAL' | 'HEAVY' | 'ABSENT'): number {
  if (l === 'HEAVY') return 2;
  if (l === 'ABSENT') return 1;
  return 0;
}

// ── Risk Level → Clinical Config ──────────────────────────────────────────────

function getRiskLevel(totalScore: number, hasSingleTrigger: boolean): MEOWSRiskLevel {
  if (totalScore >= 5 || hasSingleTrigger) return 'EMERGENCY';
  if (totalScore >= 3) return 'URGENT';
  if (totalScore >= 1) return 'CAUTION';
  return 'NORMAL';
}

const RISK_CONFIG: Record<MEOWSRiskLevel, {
  colorClass: string;
  bgClass: string;
  borderClass: string;
  responseAr: string;
  responseEn: string;
  monitorAr: string;
  monitorEn: string;
}> = {
  NORMAL: {
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    responseAr: 'مراقبة اعتيادية',
    responseEn: 'Routine monitoring',
    monitorAr: 'كل 4 ساعات',
    monitorEn: 'Every 4 hours',
  },
  CAUTION: {
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    responseAr: 'إبلاغ القابلة / الممرضة المسؤولة',
    responseEn: 'Inform midwife / responsible nurse',
    monitorAr: 'كل ساعة',
    monitorEn: 'Hourly',
  },
  URGENT: {
    colorClass: 'text-orange-700',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    responseAr: 'إخطار الطبيب فوراً — تقييم عاجل',
    responseEn: 'Notify doctor immediately — urgent review',
    monitorAr: 'مستمر أو كل 30 دقيقة',
    monitorEn: 'Continuous or every 30 minutes',
  },
  EMERGENCY: {
    colorClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    responseAr: 'استجابة طارئة — تفعيل فريق الطوارئ التوليدية',
    responseEn: 'Emergency response — activate obstetric emergency team',
    monitorAr: 'مراقبة مستمرة',
    monitorEn: 'Continuous monitoring',
  },
};

// ── Main Calculator ───────────────────────────────────────────────────────────

export function calculateMEOWS(input: MEOWSInput): MEOWSResult {
  const parameters: MEOWSParameterScore[] = [];
  let totalScore = 0;
  let hasSingleTrigger = false; // any parameter scoring ≥ 3
  let completed = 0;
  const totalParams = 7; // systolic, diastolic, HR, RR, temp, SpO2, consciousness

  if (input.systolicBp != null) {
    const s = scoreSystolicBP(input.systolicBp);
    parameters.push({ parameter: 'systolicBp', value: input.systolicBp, score: s, labelAr: 'ضغط الدم الانقباضي', labelEn: 'Systolic BP' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    completed++;
  }

  if (input.diastolicBp != null) {
    const s = scoreDiastolicBP(input.diastolicBp);
    parameters.push({ parameter: 'diastolicBp', value: input.diastolicBp, score: s, labelAr: 'ضغط الدم الانبساطي', labelEn: 'Diastolic BP' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    // not counted in completeness (paired with systolic)
  }

  if (input.hr != null) {
    const s = scoreHR(input.hr);
    parameters.push({ parameter: 'hr', value: input.hr, score: s, labelAr: 'معدل القلب', labelEn: 'Heart Rate' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    completed++;
  }

  if (input.rr != null) {
    const s = scoreRR(input.rr);
    parameters.push({ parameter: 'rr', value: input.rr, score: s, labelAr: 'معدل التنفس', labelEn: 'Respiratory Rate' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    completed++;
  }

  if (input.temp != null) {
    const s = scoreTemp(input.temp);
    parameters.push({ parameter: 'temp', value: input.temp, score: s, labelAr: 'الحرارة', labelEn: 'Temperature' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    completed++;
  }

  if (input.spo2 != null) {
    const s = scoreSpO2(input.spo2);
    parameters.push({ parameter: 'spo2', value: input.spo2, score: s, labelAr: 'تشبع الأكسجين', labelEn: 'SpO₂' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    completed++;
  }

  if (input.consciousness != null) {
    const s = scoreConsciousness(input.consciousness);
    parameters.push({ parameter: 'consciousness', value: input.consciousness, score: s, labelAr: 'مستوى الوعي', labelEn: 'Consciousness' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
    completed++;
  }

  // Optional parameters (bonus)
  if (input.proteinuria != null && input.proteinuria !== 'NONE' && input.proteinuria !== 'TRACE') {
    const s = scoreProteinuria(input.proteinuria);
    parameters.push({ parameter: 'proteinuria', value: input.proteinuria, score: s, labelAr: 'البروتين في البول', labelEn: 'Proteinuria' });
    totalScore += s;
  }

  if (input.lochia != null && input.lochia !== 'NORMAL') {
    const s = scoreLochia(input.lochia);
    parameters.push({ parameter: 'lochia', value: input.lochia, score: s, labelAr: 'النفاس', labelEn: 'Lochia' });
    totalScore += s;
    if (s >= 3) hasSingleTrigger = true;
  }

  const riskLevel = getRiskLevel(totalScore, hasSingleTrigger);
  const config = RISK_CONFIG[riskLevel];

  return {
    totalScore,
    riskLevel,
    parameters,
    hasSingleTrigger,
    clinicalResponseAr: config.responseAr,
    clinicalResponseEn: config.responseEn,
    colorClass: config.colorClass,
    bgClass: config.bgClass,
    borderClass: config.borderClass,
    monitoringFrequencyAr: config.monitorAr,
    monitoringFrequencyEn: config.monitorEn,
    parametersCompleted: completed,
    parametersTotal: totalParams,
  };
}

// ── AVPU Consciousness Options ────────────────────────────────────────────────

export const MEOWS_CONSCIOUSNESS_OPTIONS: {
  value: MEOWSConsciousness;
  labelAr: string;
  labelEn: string;
}[] = [
  { value: 'ALERT', labelAr: 'واعية ومتيقظة', labelEn: 'Alert' },
  { value: 'VOICE', labelAr: 'تستجيب للصوت', labelEn: 'Responds to Voice' },
  { value: 'PAIN', labelAr: 'تستجيب للألم', labelEn: 'Responds to Pain' },
  { value: 'UNRESPONSIVE', labelAr: 'لا تستجيب', labelEn: 'Unresponsive' },
];

export const MEOWS_PROTEINURIA_OPTIONS: {
  value: MEOWSProteinuria;
  labelAr: string;
  labelEn: string;
}[] = [
  { value: 'NONE', labelAr: 'سالب', labelEn: 'None (-)' },
  { value: 'TRACE', labelAr: 'أثر', labelEn: 'Trace (±)' },
  { value: 'PLUS1', labelAr: '(+)', labelEn: '+1' },
  { value: 'PLUS2_OR_MORE', labelAr: '(++) أو أكثر', labelEn: '++ or more' },
];
