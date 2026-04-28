/**
 * Deterioration Predictor
 * Rule-based early warning system that combines multiple clinical scores
 * and vital sign trends to predict patient deterioration risk.
 */

export type DeteriorationRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface DeteriorationFactor {
  source: string;
  finding: string;
  weight: number; // 0-3
  labelAr: string;
  labelEn: string;
}

export interface DeteriorationResult {
  riskLevel: DeteriorationRisk;
  totalScore: number;
  maxScore: number;
  factors: DeteriorationFactor[];
  recommendation: { labelAr: string; labelEn: string };
}

export interface DeteriorationInput {
  mewsScore?: number | null;
  mewsRiskLevel?: string | null;
  gcsScore?: number | null;
  bradenScore?: number | null;
  fallRiskLevel?: string | null;
  painScore?: number | null;
  spo2?: number | null;
  hr?: number | null;
  sbp?: number | null;
  temp?: number | null;
  rr?: number | null;
  ageYears?: number | null;
  consciousness?: string | null;
}

export function predictDeterioration(input: DeteriorationInput): DeteriorationResult {
  const factors: DeteriorationFactor[] = [];

  // MEWS
  if (input.mewsScore != null) {
    if (input.mewsScore >= 7) factors.push({ source: 'MEWS', finding: `Score ${input.mewsScore}`, weight: 3, labelAr: 'MEWS حرج ≥7', labelEn: 'Critical MEWS ≥7' });
    else if (input.mewsScore >= 5) factors.push({ source: 'MEWS', finding: `Score ${input.mewsScore}`, weight: 2, labelAr: 'MEWS مرتفع 5-6', labelEn: 'High MEWS 5-6' });
    else if (input.mewsScore >= 3) factors.push({ source: 'MEWS', finding: `Score ${input.mewsScore}`, weight: 1, labelAr: 'MEWS متوسط 3-4', labelEn: 'Moderate MEWS 3-4' });
  }

  // GCS
  if (input.gcsScore != null) {
    if (input.gcsScore <= 8) factors.push({ source: 'GCS', finding: `Score ${input.gcsScore}`, weight: 3, labelAr: 'GCS شديد ≤8', labelEn: 'Severe GCS ≤8' });
    else if (input.gcsScore <= 12) factors.push({ source: 'GCS', finding: `Score ${input.gcsScore}`, weight: 2, labelAr: 'GCS متوسط 9-12', labelEn: 'Moderate GCS 9-12' });
  }

  // SpO2
  if (input.spo2 != null) {
    if (input.spo2 <= 90) factors.push({ source: 'SpO2', finding: `${input.spo2}%`, weight: 3, labelAr: 'تشبع أكسجين حرج ≤90%', labelEn: 'Critical SpO2 ≤90%' });
    else if (input.spo2 <= 93) factors.push({ source: 'SpO2', finding: `${input.spo2}%`, weight: 2, labelAr: 'تشبع أكسجين منخفض ≤93%', labelEn: 'Low SpO2 ≤93%' });
  }

  // Heart Rate
  if (input.hr != null) {
    if (input.hr >= 140 || input.hr <= 40) factors.push({ source: 'HR', finding: `${input.hr}`, weight: 3, labelAr: `معدل نبض حرج: ${input.hr}`, labelEn: `Critical HR: ${input.hr}` });
    else if (input.hr >= 120 || input.hr <= 50) factors.push({ source: 'HR', finding: `${input.hr}`, weight: 2, labelAr: `معدل نبض غير طبيعي: ${input.hr}`, labelEn: `Abnormal HR: ${input.hr}` });
  }

  // Blood Pressure
  if (input.sbp != null) {
    if (input.sbp >= 200 || input.sbp <= 80) factors.push({ source: 'BP', finding: `SBP ${input.sbp}`, weight: 3, labelAr: `ضغط دم حرج: ${input.sbp}`, labelEn: `Critical BP: ${input.sbp}` });
    else if (input.sbp >= 180 || input.sbp <= 90) factors.push({ source: 'BP', finding: `SBP ${input.sbp}`, weight: 2, labelAr: `ضغط دم غير طبيعي: ${input.sbp}`, labelEn: `Abnormal BP: ${input.sbp}` });
  }

  // Temperature
  if (input.temp != null) {
    if (input.temp >= 40 || input.temp <= 34) factors.push({ source: 'Temp', finding: `${input.temp}°C`, weight: 3, labelAr: `حرارة حرجة: ${input.temp}°C`, labelEn: `Critical temp: ${input.temp}°C` });
    else if (input.temp >= 38.5 || input.temp <= 35.5) factors.push({ source: 'Temp', finding: `${input.temp}°C`, weight: 1, labelAr: `حرارة غير طبيعية: ${input.temp}°C`, labelEn: `Abnormal temp: ${input.temp}°C` });
  }

  // RR
  if (input.rr != null) {
    if (input.rr >= 30 || input.rr <= 8) factors.push({ source: 'RR', finding: `${input.rr}`, weight: 3, labelAr: `معدل تنفس حرج: ${input.rr}`, labelEn: `Critical RR: ${input.rr}` });
    else if (input.rr >= 25 || input.rr <= 10) factors.push({ source: 'RR', finding: `${input.rr}`, weight: 1, labelAr: `معدل تنفس غير طبيعي: ${input.rr}`, labelEn: `Abnormal RR: ${input.rr}` });
  }

  // Pain
  if (input.painScore != null && input.painScore >= 8) {
    factors.push({ source: 'Pain', finding: `${input.painScore}/10`, weight: 1, labelAr: `ألم شديد: ${input.painScore}/10`, labelEn: `Severe pain: ${input.painScore}/10` });
  }

  // Consciousness
  if (input.consciousness && input.consciousness !== 'ALERT') {
    const w = input.consciousness === 'UNRESPONSIVE' ? 3 : input.consciousness === 'PAIN' ? 2 : 1;
    factors.push({ source: 'Consciousness', finding: input.consciousness, weight: w, labelAr: `مستوى وعي: ${input.consciousness}`, labelEn: `Consciousness: ${input.consciousness}` });
  }

  // Age factor
  if (input.ageYears != null && (input.ageYears > 75 || input.ageYears < 1)) {
    factors.push({ source: 'Age', finding: `${input.ageYears}y`, weight: 1, labelAr: 'فئة عمرية عالية الخطورة', labelEn: 'High-risk age group' });
  }

  const totalScore = factors.reduce((s, f) => s + f.weight, 0);
  const maxScore = factors.length * 3;

  let riskLevel: DeteriorationRisk = 'LOW';
  if (totalScore >= 8 || factors.some(f => f.weight === 3)) riskLevel = 'CRITICAL';
  else if (totalScore >= 5) riskLevel = 'HIGH';
  else if (totalScore >= 3) riskLevel = 'MODERATE';

  const RECOMMENDATIONS: Record<DeteriorationRisk, { labelAr: string; labelEn: string }> = {
    LOW: { labelAr: 'استمرار المراقبة الروتينية', labelEn: 'Continue routine monitoring' },
    MODERATE: { labelAr: 'زيادة تكرار المراقبة — إبلاغ الممرض المسؤول', labelEn: 'Increase monitoring frequency — notify charge nurse' },
    HIGH: { labelAr: 'إبلاغ الطبيب فوراً — تقييم عاجل مطلوب', labelEn: 'Notify physician immediately — urgent assessment needed' },
    CRITICAL: { labelAr: 'تفعيل فريق الاستجابة السريعة (RRT) — تدخل فوري', labelEn: 'Activate Rapid Response Team (RRT) — immediate intervention' },
  };

  return { riskLevel, totalScore, maxScore, factors, recommendation: RECOMMENDATIONS[riskLevel] };
}

export const RISK_CFG: Record<DeteriorationRisk, { bg: string; text: string; border: string; labelAr: string; labelEn: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', labelAr: 'خطر منخفض', labelEn: 'Low Risk' },
  MODERATE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', labelAr: 'خطر متوسط', labelEn: 'Moderate Risk' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', labelAr: 'خطر عالي', labelEn: 'High Risk' },
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', labelAr: 'خطر حرج', labelEn: 'Critical Risk' },
};
