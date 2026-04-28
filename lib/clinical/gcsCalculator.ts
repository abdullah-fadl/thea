/**
 * Glasgow Coma Scale (GCS) Calculator
 * Standard neurological assessment tool (Teasdale & Jennett, 1974)
 *
 * Measures three components:
 * - Eye Opening (E): 1–4
 * - Verbal Response (V): 1–5
 * - Motor Response (M): 1–6
 * Total: 3–15
 *
 * Also supports pediatric GCS for children <2 years (modified verbal scale).
 */

export type GCSCategory = 'MILD' | 'MODERATE' | 'SEVERE';

export interface GCSInput {
  eye: number;    // 1–4
  verbal: number; // 1–5
  motor: number;  // 1–6
}

export interface GCSParameterScore {
  parameter: 'eye' | 'verbal' | 'motor';
  value: number;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface GCSResult {
  totalScore: number;
  eye: number;
  verbal: number;
  motor: number;
  category: GCSCategory;
  labelAr: string;
  labelEn: string;
  parameters: GCSParameterScore[];
  colorClass: string;
  bgClass: string;
  clinicalResponseAr: string;
  clinicalResponseEn: string;
  intubated: boolean;
  isPediatric: boolean;
}

const EYE_DESCRIPTIONS: Record<number, { ar: string; en: string }> = {
  4: { ar: 'يفتح العين تلقائياً', en: 'Spontaneous' },
  3: { ar: 'يفتح العين بالصوت', en: 'To voice/command' },
  2: { ar: 'يفتح العين بالألم', en: 'To pressure/pain' },
  1: { ar: 'لا يفتح العين', en: 'None' },
};

const VERBAL_DESCRIPTIONS: Record<number, { ar: string; en: string }> = {
  5: { ar: 'واعي ومتجاوب بكلام واضح', en: 'Oriented' },
  4: { ar: 'كلام مشوّش', en: 'Confused' },
  3: { ar: 'كلمات غير مفهومة', en: 'Inappropriate words' },
  2: { ar: 'أصوات غير مفهومة', en: 'Incomprehensible sounds' },
  1: { ar: 'لا يتكلم', en: 'None' },
};

const VERBAL_PEDIATRIC_DESCRIPTIONS: Record<number, { ar: string; en: string }> = {
  5: { ar: 'يبتسم، يتابع بالعين، يصدر أصوات', en: 'Smiles, oriented to sounds, follows objects' },
  4: { ar: 'بكاء لكن يمكن تهدئته', en: 'Crying but consolable' },
  3: { ar: 'بكاء مستمر غير مناسب', en: 'Persistently irritable, inconsolable' },
  2: { ar: 'أصوات غير مفهومة / تأوّه', en: 'Moans / incomprehensible sounds' },
  1: { ar: 'لا يصدر أصوات', en: 'None' },
};

const MOTOR_DESCRIPTIONS: Record<number, { ar: string; en: string }> = {
  6: { ar: 'يطيع الأوامر', en: 'Obeys commands' },
  5: { ar: 'يحدد مكان الألم', en: 'Localizing pain' },
  4: { ar: 'انسحاب من الألم', en: 'Normal flexion / withdrawal' },
  3: { ar: 'استجابة انثنائية غير طبيعية', en: 'Abnormal flexion (decorticate)' },
  2: { ar: 'استجابة بسطية (تمدد)', en: 'Extension (decerebrate)' },
  1: { ar: 'لا يستجيب', en: 'None' },
};

function getCategory(total: number): GCSCategory {
  if (total >= 13) return 'MILD';
  if (total >= 9) return 'MODERATE';
  return 'SEVERE';
}

const CATEGORY_CONFIG: Record<GCSCategory, {
  colorClass: string;
  bgClass: string;
  labelAr: string;
  labelEn: string;
  responseAr: string;
  responseEn: string;
}> = {
  MILD: {
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    labelAr: 'خفيف',
    labelEn: 'Mild',
    responseAr: 'مراقبة عصبية روتينية — كل 4 ساعات',
    responseEn: 'Routine neuro monitoring — every 4 hours',
  },
  MODERATE: {
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    labelAr: 'متوسط',
    labelEn: 'Moderate',
    responseAr: 'مراقبة عصبية مكثفة — كل ساعة — إبلاغ الطبيب',
    responseEn: 'Intensive neuro monitoring — every hour — notify physician',
  },
  SEVERE: {
    colorClass: 'text-red-700',
    bgClass: 'bg-red-50',
    labelAr: 'شديد — تأمين مجرى الهواء — إبلاغ فوري',
    labelEn: 'Severe — secure airway — immediate notification',
    responseAr: 'حالة طارئة — تأمين مجرى الهواء — فريق الاستجابة السريعة',
    responseEn: 'Emergency — secure airway — activate Rapid Response Team',
  },
};

export function calculateGCS(input: GCSInput, options?: { intubated?: boolean; isPediatric?: boolean }): GCSResult {
  const eye = Math.max(1, Math.min(4, Math.round(input.eye)));
  const verbal = Math.max(1, Math.min(5, Math.round(input.verbal)));
  const motor = Math.max(1, Math.min(6, Math.round(input.motor)));
  const totalScore = eye + verbal + motor;
  const category = getCategory(totalScore);
  const config = CATEGORY_CONFIG[category];
  const intubated = options?.intubated ?? false;
  const isPediatric = options?.isPediatric ?? false;

  const verbalDesc = isPediatric ? VERBAL_PEDIATRIC_DESCRIPTIONS : VERBAL_DESCRIPTIONS;

  const parameters: GCSParameterScore[] = [
    {
      parameter: 'eye',
      value: eye,
      labelAr: 'فتح العين (E)',
      labelEn: 'Eye Opening (E)',
      descriptionAr: EYE_DESCRIPTIONS[eye]?.ar || '',
      descriptionEn: EYE_DESCRIPTIONS[eye]?.en || '',
    },
    {
      parameter: 'verbal',
      value: verbal,
      labelAr: isPediatric ? 'الاستجابة اللفظية — أطفال (V)' : 'الاستجابة اللفظية (V)',
      labelEn: isPediatric ? 'Verbal Response — Pediatric (V)' : 'Verbal Response (V)',
      descriptionAr: intubated ? 'أنبوب حنجري (T)' : (verbalDesc[verbal]?.ar || ''),
      descriptionEn: intubated ? 'Intubated (T)' : (verbalDesc[verbal]?.en || ''),
    },
    {
      parameter: 'motor',
      value: motor,
      labelAr: 'الاستجابة الحركية (M)',
      labelEn: 'Motor Response (M)',
      descriptionAr: MOTOR_DESCRIPTIONS[motor]?.ar || '',
      descriptionEn: MOTOR_DESCRIPTIONS[motor]?.en || '',
    },
  ];

  return {
    totalScore,
    eye,
    verbal,
    motor,
    category,
    labelAr: config.labelAr,
    labelEn: config.labelEn,
    parameters,
    colorClass: config.colorClass,
    bgClass: config.bgClass,
    clinicalResponseAr: config.responseAr,
    clinicalResponseEn: config.responseEn,
    intubated,
    isPediatric,
  };
}

export const GCS_EYE_OPTIONS: { value: number; labelAr: string; labelEn: string }[] = [
  { value: 4, labelAr: '٤ — يفتح تلقائياً', labelEn: '4 — Spontaneous' },
  { value: 3, labelAr: '٣ — بالصوت', labelEn: '3 — To voice' },
  { value: 2, labelAr: '٢ — بالألم', labelEn: '2 — To pressure' },
  { value: 1, labelAr: '١ — لا يفتح', labelEn: '1 — None' },
];

export const GCS_VERBAL_OPTIONS: { value: number; labelAr: string; labelEn: string }[] = [
  { value: 5, labelAr: '٥ — واعي ومتجاوب', labelEn: '5 — Oriented' },
  { value: 4, labelAr: '٤ — مشوّش', labelEn: '4 — Confused' },
  { value: 3, labelAr: '٣ — كلمات غير مفهومة', labelEn: '3 — Inappropriate words' },
  { value: 2, labelAr: '٢ — أصوات فقط', labelEn: '2 — Incomprehensible sounds' },
  { value: 1, labelAr: '١ — لا يتكلم', labelEn: '1 — None' },
];

export const GCS_VERBAL_PEDIATRIC_OPTIONS: { value: number; labelAr: string; labelEn: string }[] = [
  { value: 5, labelAr: '٥ — يبتسم ويتابع', labelEn: '5 — Smiles, follows objects' },
  { value: 4, labelAr: '٤ — بكاء يمكن تهدئته', labelEn: '4 — Crying but consolable' },
  { value: 3, labelAr: '٣ — بكاء مستمر', labelEn: '3 — Persistently irritable' },
  { value: 2, labelAr: '٢ — أصوات / تأوّه', labelEn: '2 — Moans' },
  { value: 1, labelAr: '١ — صامت', labelEn: '1 — None' },
];

export const GCS_MOTOR_OPTIONS: { value: number; labelAr: string; labelEn: string }[] = [
  { value: 6, labelAr: '٦ — يطيع الأوامر', labelEn: '6 — Obeys commands' },
  { value: 5, labelAr: '٥ — يحدد الألم', labelEn: '5 — Localizing pain' },
  { value: 4, labelAr: '٤ — انسحاب', labelEn: '4 — Withdrawal' },
  { value: 3, labelAr: '٣ — انثناء غير طبيعي', labelEn: '3 — Abnormal flexion' },
  { value: 2, labelAr: '٢ — تمدد', labelEn: '2 — Extension' },
  { value: 1, labelAr: '١ — لا يستجيب', labelEn: '1 — None' },
];

export const DEFAULT_GCS: GCSInput = { eye: 4, verbal: 5, motor: 6 };
