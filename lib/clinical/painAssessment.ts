/**
 * Pain Assessment Intelligence
 * Supports multiple validated pain scales:
 * - NRS (Numeric Rating Scale) 0–10: Adults
 * - Wong-Baker FACES: Children 3–7, cognitively impaired
 * - FLACC: Non-verbal children <3, sedated patients
 * - CPOT: ICU/intubated patients
 *
 * Includes body region mapping, pain characteristics, and intervention tracking.
 */

export type PainScale = 'NRS' | 'WONG_BAKER' | 'FLACC' | 'CPOT';
export type PainSeverity = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
export type PainCharacter = 'SHARP' | 'DULL' | 'BURNING' | 'THROBBING' | 'STABBING' | 'ACHING' | 'CRAMPING' | 'PRESSURE' | 'TINGLING' | 'OTHER';

export interface BodyRegion {
  id: string;
  labelAr: string;
  labelEn: string;
}

export interface PainEntry {
  score: number;
  scale: PainScale;
  severity: PainSeverity;
  regions: string[];
  character: PainCharacter[];
  onset: string;
  duration: string;
  aggravatingFactors: string;
  relievingFactors: string;
  radiating: boolean;
  radiatingTo: string;
  interventions: PainIntervention[];
  reassessmentScore: number | null;
  reassessmentTime: string | null;
  notes: string;
}

export interface PainIntervention {
  type: 'PHARMACOLOGICAL' | 'NON_PHARMACOLOGICAL';
  description: string;
  time: string;
  effective: boolean | null;
}

export const DEFAULT_PAIN_ENTRY: PainEntry = {
  score: 0,
  scale: 'NRS',
  severity: 'NONE',
  regions: [],
  character: [],
  onset: '',
  duration: '',
  aggravatingFactors: '',
  relievingFactors: '',
  radiating: false,
  radiatingTo: '',
  interventions: [],
  reassessmentScore: null,
  reassessmentTime: null,
  notes: '',
};

export function getScoreFromSeverity(score: number): PainSeverity {
  if (score === 0) return 'NONE';
  if (score <= 3) return 'MILD';
  if (score <= 6) return 'MODERATE';
  return 'SEVERE';
}

export const SEVERITY_CONFIG: Record<PainSeverity, { colorClass: string; bgClass: string; labelAr: string; labelEn: string; actionAr: string; actionEn: string }> = {
  NONE: { colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', labelAr: 'لا ألم', labelEn: 'No Pain', actionAr: '', actionEn: '' },
  MILD: { colorClass: 'text-amber-600', bgClass: 'bg-amber-50', labelAr: 'خفيف', labelEn: 'Mild', actionAr: 'تدخلات غير دوائية — إعادة تقييم بعد ساعة', actionEn: 'Non-pharmacological — reassess in 1 hour' },
  MODERATE: { colorClass: 'text-orange-700', bgClass: 'bg-orange-50', labelAr: 'متوسط', labelEn: 'Moderate', actionAr: 'مسكن حسب الوصفة — إعادة تقييم بعد 30 دقيقة', actionEn: 'Analgesic per order — reassess in 30 min' },
  SEVERE: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelAr: 'شديد', labelEn: 'Severe', actionAr: 'إبلاغ الطبيب فوراً — مسكن عاجل — إعادة تقييم بعد 15 دقيقة', actionEn: 'Notify physician immediately — urgent analgesic — reassess in 15 min' },
};

export const NRS_FACES: { score: number; emoji: string; labelAr: string; labelEn: string }[] = [
  { score: 0, emoji: 'smile', labelAr: 'لا ألم', labelEn: 'No pain' },
  { score: 1, emoji: 'smile', labelAr: 'خفيف جداً', labelEn: 'Very mild' },
  { score: 2, emoji: 'meh', labelAr: 'خفيف', labelEn: 'Mild' },
  { score: 3, emoji: 'frown', labelAr: 'خفيف-متوسط', labelEn: 'Mild-moderate' },
  { score: 4, emoji: 'frown', labelAr: 'متوسط', labelEn: 'Moderate' },
  { score: 5, emoji: 'annoyed', labelAr: 'متوسط-شديد', labelEn: 'Moderate-severe' },
  { score: 6, emoji: 'annoyed', labelAr: 'شديد', labelEn: 'Severe' },
  { score: 7, emoji: 'angry', labelAr: 'شديد جداً', labelEn: 'Very severe' },
  { score: 8, emoji: 'angry', labelAr: 'شديد للغاية', labelEn: 'Extremely severe' },
  { score: 9, emoji: 'alert-triangle', labelAr: 'أسوأ ألم ممكن', labelEn: 'Worst possible' },
  { score: 10, emoji: 'alert-octagon', labelAr: 'لا يُحتمل', labelEn: 'Unbearable' },
];

export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', labelAr: 'الرأس', labelEn: 'Head' },
  { id: 'neck', labelAr: 'الرقبة', labelEn: 'Neck' },
  { id: 'chest', labelAr: 'الصدر', labelEn: 'Chest' },
  { id: 'abdomen_upper', labelAr: 'البطن العلوي', labelEn: 'Upper Abdomen' },
  { id: 'abdomen_lower', labelAr: 'البطن السفلي', labelEn: 'Lower Abdomen' },
  { id: 'back_upper', labelAr: 'أعلى الظهر', labelEn: 'Upper Back' },
  { id: 'back_lower', labelAr: 'أسفل الظهر', labelEn: 'Lower Back' },
  { id: 'shoulder_r', labelAr: 'الكتف الأيمن', labelEn: 'Right Shoulder' },
  { id: 'shoulder_l', labelAr: 'الكتف الأيسر', labelEn: 'Left Shoulder' },
  { id: 'arm_r', labelAr: 'الذراع الأيمن', labelEn: 'Right Arm' },
  { id: 'arm_l', labelAr: 'الذراع الأيسر', labelEn: 'Left Arm' },
  { id: 'hand_r', labelAr: 'اليد اليمنى', labelEn: 'Right Hand' },
  { id: 'hand_l', labelAr: 'اليد اليسرى', labelEn: 'Left Hand' },
  { id: 'hip_r', labelAr: 'الورك الأيمن', labelEn: 'Right Hip' },
  { id: 'hip_l', labelAr: 'الورك الأيسر', labelEn: 'Left Hip' },
  { id: 'leg_r', labelAr: 'الساق اليمنى', labelEn: 'Right Leg' },
  { id: 'leg_l', labelAr: 'الساق اليسرى', labelEn: 'Left Leg' },
  { id: 'knee_r', labelAr: 'الركبة اليمنى', labelEn: 'Right Knee' },
  { id: 'knee_l', labelAr: 'الركبة اليسرى', labelEn: 'Left Knee' },
  { id: 'foot_r', labelAr: 'القدم اليمنى', labelEn: 'Right Foot' },
  { id: 'foot_l', labelAr: 'القدم اليسرى', labelEn: 'Left Foot' },
  { id: 'pelvis', labelAr: 'الحوض', labelEn: 'Pelvis' },
  { id: 'generalized', labelAr: 'ألم عام', labelEn: 'Generalized' },
];

export const PAIN_CHARACTERS: { value: PainCharacter; labelAr: string; labelEn: string }[] = [
  { value: 'SHARP', labelAr: 'حاد', labelEn: 'Sharp' },
  { value: 'DULL', labelAr: 'كليل / خفيف', labelEn: 'Dull' },
  { value: 'BURNING', labelAr: 'حارق', labelEn: 'Burning' },
  { value: 'THROBBING', labelAr: 'نابض', labelEn: 'Throbbing' },
  { value: 'STABBING', labelAr: 'طعني', labelEn: 'Stabbing' },
  { value: 'ACHING', labelAr: 'موجع', labelEn: 'Aching' },
  { value: 'CRAMPING', labelAr: 'تقلصي', labelEn: 'Cramping' },
  { value: 'PRESSURE', labelAr: 'ضاغط', labelEn: 'Pressure' },
  { value: 'TINGLING', labelAr: 'تنميل', labelEn: 'Tingling' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

export const NON_PHARM_INTERVENTIONS: { labelAr: string; labelEn: string }[] = [
  { labelAr: 'كمادات باردة', labelEn: 'Cold compress' },
  { labelAr: 'كمادات دافئة', labelEn: 'Warm compress' },
  { labelAr: 'تغيير وضعية', labelEn: 'Repositioning' },
  { labelAr: 'تمارين تنفس', labelEn: 'Breathing exercises' },
  { labelAr: 'تشتيت الانتباه', labelEn: 'Distraction' },
  { labelAr: 'تدليك', labelEn: 'Massage' },
  { labelAr: 'رفع الطرف', labelEn: 'Elevation' },
  { labelAr: 'إراحة', labelEn: 'Rest' },
];

export function getRecommendedScale(ageYears: number | null, isIntubated?: boolean): PainScale {
  if (isIntubated) return 'CPOT';
  if (ageYears !== null && ageYears < 3) return 'FLACC';
  if (ageYears !== null && ageYears < 8) return 'WONG_BAKER';
  return 'NRS';
}
