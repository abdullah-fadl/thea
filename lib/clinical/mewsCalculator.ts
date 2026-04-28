/**
 * NEWS2 (National Early Warning Score 2) Calculator
 * Based on Royal College of Physicians UK standard (2017)
 *
 * Calculates aggregate clinical risk score from vital signs.
 * Used across OPD, ER, IPD, and ICU nursing stations.
 */

export type ConsciousnessLevel = 'ALERT' | 'CONFUSION' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

export interface MEWSInput {
  rr?: number | null;
  spo2?: number | null;
  temp?: number | null;
  systolicBp?: number | null;
  hr?: number | null;
  consciousness?: ConsciousnessLevel | null;
  onSupplementalO2?: boolean | null;
}

export interface MEWSParameterScore {
  parameter: string;
  value: number | string | null;
  score: number;
  labelAr: string;
  labelEn: string;
}

export type MEWSRiskLevel = 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';

export interface MEWSResult {
  totalScore: number;
  riskLevel: MEWSRiskLevel;
  parameters: MEWSParameterScore[];
  hasSingleHighParameter: boolean;
  clinicalResponseAr: string;
  clinicalResponseEn: string;
  colorClass: string;
  bgClass: string;
  monitoringFrequencyAr: string;
  monitoringFrequencyEn: string;
  parametersCompleted: number;
  parametersTotal: number;
}

function scoreRR(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3; // ≥25
}

function scoreSpO2Scale1(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0; // ≥96
}

function scoreSupplementalO2(onO2: boolean): number {
  return onO2 ? 2 : 0;
}

function scoreTemp(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2; // ≥39.1
}

function scoreSystolicBP(sys: number): number {
  if (sys <= 90) return 3;
  if (sys <= 100) return 2;
  if (sys <= 110) return 1;
  if (sys <= 219) return 0;
  return 3; // ≥220
}

function scoreHR(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3; // ≥131
}

function scoreConsciousness(level: ConsciousnessLevel): number {
  return level === 'ALERT' ? 0 : 3;
}

function getRiskLevel(totalScore: number, hasSingle3: boolean): MEWSRiskLevel {
  if (totalScore >= 7) return 'HIGH';
  if (totalScore >= 5 || hasSingle3) return 'MEDIUM';
  if (totalScore >= 1) return 'LOW_MEDIUM';
  return 'LOW';
}

const RISK_CONFIG: Record<MEWSRiskLevel, {
  colorClass: string;
  bgClass: string;
  responseAr: string;
  responseEn: string;
  monitorAr: string;
  monitorEn: string;
}> = {
  LOW: {
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    responseAr: 'مراقبة روتينية',
    responseEn: 'Routine monitoring',
    monitorAr: 'كل 12 ساعة كحد أدنى',
    monitorEn: 'Minimum every 12 hours',
  },
  LOW_MEDIUM: {
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    responseAr: 'إبلاغ الممرض المسؤول — تقييم إضافي',
    responseEn: 'Inform registered nurse — additional assessment',
    monitorAr: 'كل 4–6 ساعات',
    monitorEn: 'Every 4–6 hours',
  },
  MEDIUM: {
    colorClass: 'text-orange-700',
    bgClass: 'bg-orange-50',
    responseAr: 'استجابة عاجلة — إبلاغ الطبيب فوراً',
    responseEn: 'Urgent response — notify doctor immediately',
    monitorAr: 'كل ساعة على الأقل',
    monitorEn: 'At least every hour',
  },
  HIGH: {
    colorClass: 'text-red-700',
    bgClass: 'bg-red-50',
    responseAr: 'استجابة طارئة — تفعيل فريق الاستجابة السريعة (RRT)',
    responseEn: 'Emergency response — activate Rapid Response Team (RRT)',
    monitorAr: 'مراقبة مستمرة',
    monitorEn: 'Continuous monitoring',
  },
};

export function calculateMEWS(input: MEWSInput): MEWSResult {
  const parameters: MEWSParameterScore[] = [];
  let totalScore = 0;
  let hasSingle3 = false;
  let completed = 0;
  const total = 6;

  if (input.rr != null) {
    const s = scoreRR(input.rr);
    parameters.push({ parameter: 'rr', value: input.rr, score: s, labelAr: 'معدل التنفس', labelEn: 'Respiratory Rate' });
    totalScore += s;
    if (s === 3) hasSingle3 = true;
    completed++;
  }

  if (input.spo2 != null) {
    const s = scoreSpO2Scale1(input.spo2);
    parameters.push({ parameter: 'spo2', value: input.spo2, score: s, labelAr: 'تشبع الأكسجين', labelEn: 'SpO2' });
    totalScore += s;
    if (s === 3) hasSingle3 = true;
    completed++;
  }

  if (input.onSupplementalO2 != null) {
    const s = scoreSupplementalO2(input.onSupplementalO2);
    parameters.push({ parameter: 'supplementalO2', value: input.onSupplementalO2 ? 'Yes' : 'No', score: s, labelAr: 'أكسجين إضافي', labelEn: 'Supplemental O₂' });
    totalScore += s;
  }

  if (input.temp != null) {
    const s = scoreTemp(input.temp);
    parameters.push({ parameter: 'temp', value: input.temp, score: s, labelAr: 'الحرارة', labelEn: 'Temperature' });
    totalScore += s;
    if (s === 3) hasSingle3 = true;
    completed++;
  }

  if (input.systolicBp != null) {
    const s = scoreSystolicBP(input.systolicBp);
    parameters.push({ parameter: 'systolicBp', value: input.systolicBp, score: s, labelAr: 'ضغط الدم الانقباضي', labelEn: 'Systolic BP' });
    totalScore += s;
    if (s === 3) hasSingle3 = true;
    completed++;
  }

  if (input.hr != null) {
    const s = scoreHR(input.hr);
    parameters.push({ parameter: 'hr', value: input.hr, score: s, labelAr: 'نبض القلب', labelEn: 'Heart Rate' });
    totalScore += s;
    if (s === 3) hasSingle3 = true;
    completed++;
  }

  if (input.consciousness != null) {
    const s = scoreConsciousness(input.consciousness);
    parameters.push({ parameter: 'consciousness', value: input.consciousness, score: s, labelAr: 'مستوى الوعي', labelEn: 'Consciousness' });
    totalScore += s;
    if (s === 3) hasSingle3 = true;
    completed++;
  }

  const riskLevel = getRiskLevel(totalScore, hasSingle3);
  const config = RISK_CONFIG[riskLevel];

  return {
    totalScore,
    riskLevel,
    parameters,
    hasSingleHighParameter: hasSingle3,
    clinicalResponseAr: config.responseAr,
    clinicalResponseEn: config.responseEn,
    colorClass: config.colorClass,
    bgClass: config.bgClass,
    monitoringFrequencyAr: config.monitorAr,
    monitoringFrequencyEn: config.monitorEn,
    parametersCompleted: completed,
    parametersTotal: total,
  };
}

/**
 * Extract MEWS input from raw vitals object (as stored in nursing entries)
 */
export function vitalsToMEWSInput(vitals: Record<string, any>, consciousness?: ConsciousnessLevel | null, onSupplementalO2?: boolean | null): MEWSInput {
  let systolicBp: number | null = null;
  if (vitals.bp) {
    const sys = Number(String(vitals.bp).split('/')[0]);
    if (!Number.isNaN(sys)) systolicBp = sys;
  }

  return {
    rr: vitals.rr != null ? Number(vitals.rr) || null : null,
    spo2: vitals.spo2 != null ? Number(vitals.spo2) || null : null,
    temp: vitals.temp != null ? Number(vitals.temp) || null : null,
    systolicBp,
    hr: vitals.hr != null ? Number(vitals.hr) || null : null,
    consciousness: consciousness || null,
    onSupplementalO2: onSupplementalO2 || null,
  };
}

export const CONSCIOUSNESS_OPTIONS: { value: ConsciousnessLevel; labelAr: string; labelEn: string; description: string }[] = [
  { value: 'ALERT', labelAr: 'واعي ومتجاوب', labelEn: 'Alert', description: 'A' },
  { value: 'CONFUSION', labelAr: 'تشوّش ذهني', labelEn: 'New Confusion', description: 'C' },
  { value: 'VOICE', labelAr: 'يستجيب للصوت', labelEn: 'Voice', description: 'V' },
  { value: 'PAIN', labelAr: 'يستجيب للألم', labelEn: 'Pain', description: 'P' },
  { value: 'UNRESPONSIVE', labelAr: 'لا يستجيب', labelEn: 'Unresponsive', description: 'U' },
];
