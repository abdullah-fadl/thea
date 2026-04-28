/**
 * Braden Scale for Predicting Pressure Sore Risk
 * Validated tool used worldwide (Bergstrom et al., 1987).
 * 6 subscales scored 1–4 (except Friction/Shear: 1–3). Total: 6–23.
 * Lower score = higher risk.
 */

export type BradenRisk = 'SEVERE' | 'HIGH' | 'MODERATE' | 'MILD' | 'NO_RISK';

export interface BradenInput {
  sensoryPerception: number; // 1-4
  moisture: number;          // 1-4
  activity: number;          // 1-4
  mobility: number;          // 1-4
  nutrition: number;         // 1-4
  frictionShear: number;     // 1-3
}

export interface BradenResult {
  input: BradenInput;
  totalScore: number;
  risk: BradenRisk;
  recommendations: string[];
}

export const DEFAULT_BRADEN: BradenInput = {
  sensoryPerception: 4,
  moisture: 4,
  activity: 4,
  mobility: 4,
  nutrition: 4,
  frictionShear: 3,
};

export function getRisk(score: number): BradenRisk {
  if (score <= 9) return 'SEVERE';
  if (score <= 12) return 'HIGH';
  if (score <= 14) return 'MODERATE';
  if (score <= 18) return 'MILD';
  return 'NO_RISK';
}

export function calculateBraden(input: BradenInput): BradenResult {
  const totalScore = input.sensoryPerception + input.moisture + input.activity
    + input.mobility + input.nutrition + input.frictionShear;
  const risk = getRisk(totalScore);

  const recommendations: string[] = [];
  if (risk === 'SEVERE' || risk === 'HIGH') {
    recommendations.push('REPOSITION_Q2H', 'PRESSURE_RELIEF_DEVICE', 'SKIN_ASSESSMENT_EVERY_SHIFT', 'NUTRITION_CONSULT', 'MOISTURE_BARRIER');
  } else if (risk === 'MODERATE') {
    recommendations.push('REPOSITION_Q2H', 'SKIN_ASSESSMENT_DAILY', 'NUTRITION_MONITOR');
  } else if (risk === 'MILD') {
    recommendations.push('REPOSITION_Q4H', 'SKIN_ASSESSMENT_DAILY');
  }
  if (input.moisture <= 2) recommendations.push('MOISTURE_MANAGEMENT');
  if (input.nutrition <= 2) recommendations.push('DIETARY_SUPPLEMENT');
  if (input.frictionShear === 1) recommendations.push('LIFT_SHEET_USE');

  return { input, totalScore, risk, recommendations: [...new Set(recommendations)] };
}

export const RISK_CONFIG: Record<BradenRisk, { colorClass: string; bgClass: string; labelAr: string; labelEn: string }> = {
  SEVERE: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelAr: 'شديد الخطورة', labelEn: 'Severe Risk' },
  HIGH: { colorClass: 'text-orange-700', bgClass: 'bg-orange-50', labelAr: 'خطورة عالية', labelEn: 'High Risk' },
  MODERATE: { colorClass: 'text-amber-700', bgClass: 'bg-amber-50', labelAr: 'خطورة متوسطة', labelEn: 'Moderate Risk' },
  MILD: { colorClass: 'text-yellow-700', bgClass: 'bg-yellow-50', labelAr: 'خطورة خفيفة', labelEn: 'Mild Risk' },
  NO_RISK: { colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', labelAr: 'لا خطورة', labelEn: 'No Risk' },
};

export const RECOMMENDATION_LABELS: Record<string, { labelAr: string; labelEn: string }> = {
  REPOSITION_Q2H: { labelAr: 'تغيير الوضعية كل ساعتين', labelEn: 'Reposition every 2 hours' },
  REPOSITION_Q4H: { labelAr: 'تغيير الوضعية كل 4 ساعات', labelEn: 'Reposition every 4 hours' },
  PRESSURE_RELIEF_DEVICE: { labelAr: 'استخدام فرشة تخفيف الضغط', labelEn: 'Use pressure relief mattress' },
  SKIN_ASSESSMENT_EVERY_SHIFT: { labelAr: 'فحص الجلد كل وردية', labelEn: 'Skin assessment every shift' },
  SKIN_ASSESSMENT_DAILY: { labelAr: 'فحص الجلد يومياً', labelEn: 'Daily skin assessment' },
  NUTRITION_CONSULT: { labelAr: 'استشارة تغذية', labelEn: 'Nutrition consult' },
  NUTRITION_MONITOR: { labelAr: 'مراقبة التغذية', labelEn: 'Monitor nutrition' },
  MOISTURE_BARRIER: { labelAr: 'كريم حاجز للرطوبة', labelEn: 'Apply moisture barrier cream' },
  MOISTURE_MANAGEMENT: { labelAr: 'إدارة الرطوبة (تغيير متكرر)', labelEn: 'Moisture management (frequent changes)' },
  DIETARY_SUPPLEMENT: { labelAr: 'مكملات غذائية', labelEn: 'Dietary supplements' },
  LIFT_SHEET_USE: { labelAr: 'استخدام ملاءة رفع عند النقل', labelEn: 'Use lift sheet during transfers' },
};

export interface BradenSubscale {
  key: keyof BradenInput;
  labelAr: string;
  labelEn: string;
  maxScore: number;
  options: { score: number; labelAr: string; labelEn: string }[];
}

export const BRADEN_SUBSCALES: BradenSubscale[] = [
  {
    key: 'sensoryPerception', labelAr: 'الإدراك الحسي', labelEn: 'Sensory Perception', maxScore: 4,
    options: [
      { score: 1, labelAr: 'محدود تماماً', labelEn: 'Completely Limited' },
      { score: 2, labelAr: 'محدود جداً', labelEn: 'Very Limited' },
      { score: 3, labelAr: 'محدود قليلاً', labelEn: 'Slightly Limited' },
      { score: 4, labelAr: 'لا ضعف', labelEn: 'No Impairment' },
    ],
  },
  {
    key: 'moisture', labelAr: 'الرطوبة', labelEn: 'Moisture', maxScore: 4,
    options: [
      { score: 1, labelAr: 'رطب باستمرار', labelEn: 'Constantly Moist' },
      { score: 2, labelAr: 'رطب غالباً', labelEn: 'Very Moist' },
      { score: 3, labelAr: 'رطب أحياناً', labelEn: 'Occasionally Moist' },
      { score: 4, labelAr: 'نادراً رطب', labelEn: 'Rarely Moist' },
    ],
  },
  {
    key: 'activity', labelAr: 'النشاط', labelEn: 'Activity', maxScore: 4,
    options: [
      { score: 1, labelAr: 'ملازم للسرير', labelEn: 'Bedfast' },
      { score: 2, labelAr: 'ملازم للكرسي', labelEn: 'Chairfast' },
      { score: 3, labelAr: 'يمشي أحياناً', labelEn: 'Walks Occasionally' },
      { score: 4, labelAr: 'يمشي بشكل متكرر', labelEn: 'Walks Frequently' },
    ],
  },
  {
    key: 'mobility', labelAr: 'الحركة', labelEn: 'Mobility', maxScore: 4,
    options: [
      { score: 1, labelAr: 'لا يتحرك', labelEn: 'Completely Immobile' },
      { score: 2, labelAr: 'محدود جداً', labelEn: 'Very Limited' },
      { score: 3, labelAr: 'محدود قليلاً', labelEn: 'Slightly Limited' },
      { score: 4, labelAr: 'لا قيود', labelEn: 'No Limitations' },
    ],
  },
  {
    key: 'nutrition', labelAr: 'التغذية', labelEn: 'Nutrition', maxScore: 4,
    options: [
      { score: 1, labelAr: 'سيئة جداً', labelEn: 'Very Poor' },
      { score: 2, labelAr: 'غير كافية', labelEn: 'Probably Inadequate' },
      { score: 3, labelAr: 'كافية', labelEn: 'Adequate' },
      { score: 4, labelAr: 'ممتازة', labelEn: 'Excellent' },
    ],
  },
  {
    key: 'frictionShear', labelAr: 'الاحتكاك والقص', labelEn: 'Friction & Shear', maxScore: 3,
    options: [
      { score: 1, labelAr: 'مشكلة', labelEn: 'Problem' },
      { score: 2, labelAr: 'مشكلة محتملة', labelEn: 'Potential Problem' },
      { score: 3, labelAr: 'لا مشكلة ظاهرة', labelEn: 'No Apparent Problem' },
    ],
  },
];
