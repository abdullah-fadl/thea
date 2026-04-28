/**
 * Fall Risk Assessment Calculator
 * - Morse Fall Scale (adults ≥18)
 * - Humpty Dumpty Scale (children <18)
 * Auto-selects scale based on patient age.
 */

// ─── Morse Fall Scale (Adults) ───

export interface MorseFallInput {
  historyOfFalling: boolean;
  secondaryDiagnosis: boolean;
  ambulatoryAid: 'NONE' | 'CRUTCHES_CANE_WALKER' | 'FURNITURE';
  ivAccess: boolean;
  gait: 'NORMAL_BEDREST_WHEELCHAIR' | 'WEAK' | 'IMPAIRED';
  mentalStatus: 'ORIENTED' | 'OVERESTIMATES';
}

export interface MorseFallResult {
  scale: 'MORSE';
  totalScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  factors: MorseFactor[];
  interventionsAr: string[];
  interventionsEn: string[];
  colorClass: string;
  bgClass: string;
  labelAr: string;
  labelEn: string;
  wristbandColor: string;
}

export interface MorseFactor {
  key: string;
  labelAr: string;
  labelEn: string;
  value: string;
  valueAr: string;
  valueEn: string;
  score: number;
}

const MORSE_SCORES = {
  historyOfFalling: { false: 0, true: 25 },
  secondaryDiagnosis: { false: 0, true: 15 },
  ambulatoryAid: { NONE: 0, CRUTCHES_CANE_WALKER: 15, FURNITURE: 30 },
  ivAccess: { false: 0, true: 20 },
  gait: { NORMAL_BEDREST_WHEELCHAIR: 0, WEAK: 10, IMPAIRED: 20 },
  mentalStatus: { ORIENTED: 0, OVERESTIMATES: 15 },
} as const;

export function calculateMorseFall(input: MorseFallInput): MorseFallResult {
  const factors: MorseFactor[] = [
    {
      key: 'historyOfFalling',
      labelAr: 'تاريخ سقوط (خلال 3 أشهر)',
      labelEn: 'History of falling (past 3 months)',
      value: String(input.historyOfFalling),
      valueAr: input.historyOfFalling ? 'نعم' : 'لا',
      valueEn: input.historyOfFalling ? 'Yes' : 'No',
      score: input.historyOfFalling ? 25 : 0,
    },
    {
      key: 'secondaryDiagnosis',
      labelAr: 'تشخيص ثانوي (أكثر من تشخيص)',
      labelEn: 'Secondary diagnosis',
      value: String(input.secondaryDiagnosis),
      valueAr: input.secondaryDiagnosis ? 'نعم' : 'لا',
      valueEn: input.secondaryDiagnosis ? 'Yes' : 'No',
      score: input.secondaryDiagnosis ? 15 : 0,
    },
    {
      key: 'ambulatoryAid',
      labelAr: 'مساعد مشي',
      labelEn: 'Ambulatory aid',
      value: input.ambulatoryAid,
      valueAr: input.ambulatoryAid === 'NONE' ? 'لا شيء / طريح الفراش / كرسي متحرك'
        : input.ambulatoryAid === 'CRUTCHES_CANE_WALKER' ? 'عكاز / عصا / مشّاية'
        : 'يتمسك بالأثاث',
      valueEn: input.ambulatoryAid === 'NONE' ? 'None / Bed rest / Wheelchair'
        : input.ambulatoryAid === 'CRUTCHES_CANE_WALKER' ? 'Crutches / Cane / Walker'
        : 'Furniture',
      score: MORSE_SCORES.ambulatoryAid[input.ambulatoryAid],
    },
    {
      key: 'ivAccess',
      labelAr: 'محاليل وريدية / قسطرة',
      labelEn: 'IV access / Heparin lock',
      value: String(input.ivAccess),
      valueAr: input.ivAccess ? 'نعم' : 'لا',
      valueEn: input.ivAccess ? 'Yes' : 'No',
      score: input.ivAccess ? 20 : 0,
    },
    {
      key: 'gait',
      labelAr: 'طريقة المشي',
      labelEn: 'Gait',
      value: input.gait,
      valueAr: input.gait === 'NORMAL_BEDREST_WHEELCHAIR' ? 'طبيعي / طريح الفراش / كرسي متحرك'
        : input.gait === 'WEAK' ? 'ضعيف'
        : 'مضطرب / غير مستقر',
      valueEn: input.gait === 'NORMAL_BEDREST_WHEELCHAIR' ? 'Normal / Bed rest / Wheelchair'
        : input.gait === 'WEAK' ? 'Weak'
        : 'Impaired / Unsteady',
      score: MORSE_SCORES.gait[input.gait],
    },
    {
      key: 'mentalStatus',
      labelAr: 'الحالة الذهنية',
      labelEn: 'Mental status',
      value: input.mentalStatus,
      valueAr: input.mentalStatus === 'ORIENTED' ? 'يعرف قدراته' : 'يبالغ في تقدير قدراته / ينسى',
      valueEn: input.mentalStatus === 'ORIENTED' ? 'Oriented to own ability' : 'Overestimates / Forgets limitations',
      score: input.mentalStatus === 'OVERESTIMATES' ? 15 : 0,
    },
  ];

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  if (totalScore >= 45) riskLevel = 'HIGH';
  else if (totalScore >= 25) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  const lowInterventionsAr = ['توعية المريض والأهل بخطر السقوط', 'حذاء مانع للانزلاق', 'فرامل السرير مقفلة', 'جرس النداء في متناول اليد'];
  const lowInterventionsEn = ['Educate patient & family about fall risk', 'Non-slip footwear', 'Bed brakes locked', 'Call bell within reach'];
  const modInterventionsAr = [...lowInterventionsAr, 'سوار تعريف أصفر', 'علامة تحذير على الباب', 'إعادة تقييم كل شفت', 'مرافقة عند المشي'];
  const modInterventionsEn = [...lowInterventionsEn, 'Yellow identification wristband', 'Warning sign on door', 'Reassess every shift', 'Assist with ambulation'];
  const highInterventionsAr = [...modInterventionsAr, 'حواجز السرير مرفوعة', 'مرافق بشكل مستمر', 'تقريب الأغراض الشخصية', 'إضاءة ليلية', 'إعادة تقييم كل 4 ساعات', 'إشعار المشرف'];
  const highInterventionsEn = [...modInterventionsEn, 'Bed rails raised', 'Continuous sitter/companion', 'Personal items within reach', 'Night light on', 'Reassess every 4 hours', 'Notify charge nurse'];

  const config = {
    LOW: { colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', labelAr: 'خطر منخفض', labelEn: 'Low Risk', wristbandColor: 'green', interventionsAr: lowInterventionsAr, interventionsEn: lowInterventionsEn },
    MODERATE: { colorClass: 'text-amber-700', bgClass: 'bg-amber-50', labelAr: 'خطر متوسط', labelEn: 'Moderate Risk', wristbandColor: 'yellow', interventionsAr: modInterventionsAr, interventionsEn: modInterventionsEn },
    HIGH: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelAr: 'خطر مرتفع', labelEn: 'High Risk', wristbandColor: 'red', interventionsAr: highInterventionsAr, interventionsEn: highInterventionsEn },
  };

  const c = config[riskLevel];
  return { scale: 'MORSE', totalScore, riskLevel, factors, ...c };
}

// ─── Humpty Dumpty Scale (Children <18) ───

export interface HumptyDumptyInput {
  age: 'LT_3' | '3_TO_6' | '7_TO_12' | 'GTE_13';
  gender: 'MALE' | 'FEMALE';
  diagnosis: 'NEUROLOGICAL' | 'OXYGENATION' | 'WEAKNESS' | 'OTHER';
  cognitiveImpairment: 'UNAWARE' | 'FORGETS' | 'ORIENTED';
  environmentalFactors: 'FALL_HISTORY_AND_DEVICES' | 'DEVICES_ONLY' | 'FALL_HISTORY_ONLY' | 'NONE';
  surgeryMedication: 'WITHIN_24H' | 'WITHIN_48H' | 'MORE_OR_NONE';
}

export interface HumptyDumptyResult {
  scale: 'HUMPTY_DUMPTY';
  totalScore: number;
  riskLevel: 'LOW' | 'HIGH';
  factors: MorseFactor[];
  interventionsAr: string[];
  interventionsEn: string[];
  colorClass: string;
  bgClass: string;
  labelAr: string;
  labelEn: string;
  wristbandColor: string;
}

export function calculateHumptyDumpty(input: HumptyDumptyInput): HumptyDumptyResult {
  const ageScore = input.age === 'LT_3' ? 4 : input.age === '3_TO_6' ? 3 : input.age === '7_TO_12' ? 2 : 1;
  const genderScore = input.gender === 'MALE' ? 2 : 1;
  const diagScore = input.diagnosis === 'NEUROLOGICAL' ? 4 : input.diagnosis === 'OXYGENATION' ? 3 : input.diagnosis === 'WEAKNESS' ? 2 : 1;
  const cogScore = input.cognitiveImpairment === 'UNAWARE' ? 3 : input.cognitiveImpairment === 'FORGETS' ? 2 : 1;
  const envScore = input.environmentalFactors === 'FALL_HISTORY_AND_DEVICES' ? 4 : input.environmentalFactors === 'DEVICES_ONLY' ? 3 : input.environmentalFactors === 'FALL_HISTORY_ONLY' ? 2 : 1;
  const medScore = input.surgeryMedication === 'WITHIN_24H' ? 3 : input.surgeryMedication === 'WITHIN_48H' ? 2 : 1;

  const factors: MorseFactor[] = [
    {
      key: 'age', labelAr: 'العمر', labelEn: 'Age',
      value: input.age,
      valueAr: input.age === 'LT_3' ? 'أقل من 3 سنوات' : input.age === '3_TO_6' ? '3–6 سنوات' : input.age === '7_TO_12' ? '7–12 سنة' : '13+ سنة',
      valueEn: input.age === 'LT_3' ? '< 3 years' : input.age === '3_TO_6' ? '3–6 years' : input.age === '7_TO_12' ? '7–12 years' : '≥ 13 years',
      score: ageScore,
    },
    {
      key: 'gender', labelAr: 'الجنس', labelEn: 'Gender',
      value: input.gender,
      valueAr: input.gender === 'MALE' ? 'ذكر' : 'أنثى',
      valueEn: input.gender === 'MALE' ? 'Male' : 'Female',
      score: genderScore,
    },
    {
      key: 'diagnosis', labelAr: 'التشخيص', labelEn: 'Diagnosis',
      value: input.diagnosis,
      valueAr: input.diagnosis === 'NEUROLOGICAL' ? 'عصبي' : input.diagnosis === 'OXYGENATION' ? 'اضطراب أكسجة' : input.diagnosis === 'WEAKNESS' ? 'ضعف عام / تعب' : 'أخرى',
      valueEn: input.diagnosis === 'NEUROLOGICAL' ? 'Neurological' : input.diagnosis === 'OXYGENATION' ? 'Oxygenation disorder' : input.diagnosis === 'WEAKNESS' ? 'Weakness / Fatigue' : 'Other',
      score: diagScore,
    },
    {
      key: 'cognitiveImpairment', labelAr: 'القصور الذهني', labelEn: 'Cognitive impairment',
      value: input.cognitiveImpairment,
      valueAr: input.cognitiveImpairment === 'UNAWARE' ? 'لا يدرك حدوده' : input.cognitiveImpairment === 'FORGETS' ? 'ينسى القيود' : 'يعرف قدراته',
      valueEn: input.cognitiveImpairment === 'UNAWARE' ? 'Unaware of limitations' : input.cognitiveImpairment === 'FORGETS' ? 'Forgets limitations' : 'Oriented to own ability',
      score: cogScore,
    },
    {
      key: 'environmentalFactors', labelAr: 'عوامل بيئية', labelEn: 'Environmental factors',
      value: input.environmentalFactors,
      valueAr: input.environmentalFactors === 'FALL_HISTORY_AND_DEVICES' ? 'تاريخ سقوط + أجهزة طبية' : input.environmentalFactors === 'DEVICES_ONLY' ? 'أجهزة طبية فقط' : input.environmentalFactors === 'FALL_HISTORY_ONLY' ? 'تاريخ سقوط فقط' : 'لا شيء',
      valueEn: input.environmentalFactors === 'FALL_HISTORY_AND_DEVICES' ? 'Fall history + Medical devices' : input.environmentalFactors === 'DEVICES_ONLY' ? 'Medical devices only' : input.environmentalFactors === 'FALL_HISTORY_ONLY' ? 'Fall history only' : 'None',
      score: envScore,
    },
    {
      key: 'surgeryMedication', labelAr: 'جراحة / أدوية مؤثرة', labelEn: 'Surgery / Sedation medication',
      value: input.surgeryMedication,
      valueAr: input.surgeryMedication === 'WITHIN_24H' ? 'خلال 24 ساعة' : input.surgeryMedication === 'WITHIN_48H' ? 'خلال 48 ساعة' : 'أكثر من 48 ساعة أو لا أدوية',
      valueEn: input.surgeryMedication === 'WITHIN_24H' ? 'Within 24 hours' : input.surgeryMedication === 'WITHIN_48H' ? 'Within 48 hours' : '> 48 hours or no medication',
      score: medScore,
    },
  ];

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const riskLevel: 'LOW' | 'HIGH' = totalScore >= 12 ? 'HIGH' : 'LOW';

  const lowInterventionsAr = ['توعية الأهل', 'حواجز سرير مرفوعة', 'أرضية غير زلقة', 'جرس النداء في متناول اليد'];
  const lowInterventionsEn = ['Educate family', 'Bed rails up', 'Non-slip floor', 'Call bell within reach'];
  const highInterventionsAr = [...lowInterventionsAr, 'سوار تعريف أصفر', 'علامة تحذير على السرير', 'مرافق مستمر (أحد الوالدين)', 'إبعاد الأشياء الخطرة', 'إعادة تقييم كل 4 ساعات', 'إشعار المشرف'];
  const highInterventionsEn = [...lowInterventionsEn, 'Yellow wristband', 'Warning sign on bed', 'Continuous companion (parent)', 'Remove hazardous objects', 'Reassess every 4 hours', 'Notify charge nurse'];

  const config = {
    LOW: { colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', labelAr: 'خطر منخفض', labelEn: 'Low Risk', wristbandColor: 'green', interventionsAr: lowInterventionsAr, interventionsEn: lowInterventionsEn },
    HIGH: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelAr: 'خطر مرتفع', labelEn: 'High Risk', wristbandColor: 'red', interventionsAr: highInterventionsAr, interventionsEn: highInterventionsEn },
  };

  const c = config[riskLevel];
  return { scale: 'HUMPTY_DUMPTY', totalScore, riskLevel, factors, ...c };
}

// ─── Auto-select scale based on age ───

export type FallRiskResult = MorseFallResult | HumptyDumptyResult;

export function getPatientAgeYears(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

export function getRecommendedScale(ageYears: number | null): 'MORSE' | 'HUMPTY_DUMPTY' {
  if (ageYears === null) return 'MORSE';
  return ageYears < 18 ? 'HUMPTY_DUMPTY' : 'MORSE';
}

export function getHumptyDumptyAgeCategory(ageYears: number): HumptyDumptyInput['age'] {
  if (ageYears < 3) return 'LT_3';
  if (ageYears <= 6) return '3_TO_6';
  if (ageYears <= 12) return '7_TO_12';
  return 'GTE_13';
}

// ─── Default inputs ───

export const DEFAULT_MORSE: MorseFallInput = {
  historyOfFalling: false,
  secondaryDiagnosis: false,
  ambulatoryAid: 'NONE',
  ivAccess: false,
  gait: 'NORMAL_BEDREST_WHEELCHAIR',
  mentalStatus: 'ORIENTED',
};

export const DEFAULT_HUMPTY_DUMPTY: HumptyDumptyInput = {
  age: 'GTE_13',
  gender: 'MALE',
  diagnosis: 'OTHER',
  cognitiveImpairment: 'ORIENTED',
  environmentalFactors: 'NONE',
  surgeryMedication: 'MORE_OR_NONE',
};

// ─── Morse option configs for UI ───

export const MORSE_OPTIONS = {
  ambulatoryAid: [
    { value: 'NONE' as const, labelAr: 'لا شيء / طريح الفراش / كرسي متحرك', labelEn: 'None / Bed rest / Wheelchair', score: 0 },
    { value: 'CRUTCHES_CANE_WALKER' as const, labelAr: 'عكاز / عصا / مشّاية', labelEn: 'Crutches / Cane / Walker', score: 15 },
    { value: 'FURNITURE' as const, labelAr: 'يتمسك بالأثاث', labelEn: 'Furniture', score: 30 },
  ],
  gait: [
    { value: 'NORMAL_BEDREST_WHEELCHAIR' as const, labelAr: 'طبيعي / فراش / كرسي', labelEn: 'Normal / Bed rest / Wheelchair', score: 0 },
    { value: 'WEAK' as const, labelAr: 'ضعيف', labelEn: 'Weak', score: 10 },
    { value: 'IMPAIRED' as const, labelAr: 'مضطرب / غير مستقر', labelEn: 'Impaired / Unsteady', score: 20 },
  ],
  mentalStatus: [
    { value: 'ORIENTED' as const, labelAr: 'يعرف قدراته', labelEn: 'Oriented to own ability', score: 0 },
    { value: 'OVERESTIMATES' as const, labelAr: 'يبالغ / ينسى حدوده', labelEn: 'Overestimates / Forgets', score: 15 },
  ],
};

export const HUMPTY_DUMPTY_OPTIONS = {
  diagnosis: [
    { value: 'NEUROLOGICAL' as const, labelAr: 'عصبي', labelEn: 'Neurological', score: 4 },
    { value: 'OXYGENATION' as const, labelAr: 'اضطراب أكسجة', labelEn: 'Oxygenation', score: 3 },
    { value: 'WEAKNESS' as const, labelAr: 'ضعف / تعب', labelEn: 'Weakness / Fatigue', score: 2 },
    { value: 'OTHER' as const, labelAr: 'أخرى', labelEn: 'Other', score: 1 },
  ],
  cognitiveImpairment: [
    { value: 'UNAWARE' as const, labelAr: 'لا يدرك حدوده', labelEn: 'Unaware of limitations', score: 3 },
    { value: 'FORGETS' as const, labelAr: 'ينسى القيود', labelEn: 'Forgets limitations', score: 2 },
    { value: 'ORIENTED' as const, labelAr: 'يعرف قدراته', labelEn: 'Oriented', score: 1 },
  ],
  environmentalFactors: [
    { value: 'FALL_HISTORY_AND_DEVICES' as const, labelAr: 'تاريخ سقوط + أجهزة', labelEn: 'Fall history + Devices', score: 4 },
    { value: 'DEVICES_ONLY' as const, labelAr: 'أجهزة طبية فقط', labelEn: 'Devices only', score: 3 },
    { value: 'FALL_HISTORY_ONLY' as const, labelAr: 'تاريخ سقوط فقط', labelEn: 'Fall history only', score: 2 },
    { value: 'NONE' as const, labelAr: 'لا شيء', labelEn: 'None', score: 1 },
  ],
  surgeryMedication: [
    { value: 'WITHIN_24H' as const, labelAr: 'خلال 24 ساعة', labelEn: 'Within 24 hours', score: 3 },
    { value: 'WITHIN_48H' as const, labelAr: 'خلال 48 ساعة', labelEn: 'Within 48 hours', score: 2 },
    { value: 'MORE_OR_NONE' as const, labelAr: 'أكثر أو لا أدوية', labelEn: '> 48h or no medication', score: 1 },
  ],
};
