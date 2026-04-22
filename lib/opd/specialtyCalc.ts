// =============================================================================
// Specialty Medical Calculators — NEW FILE
// =============================================================================

// ── Pediatric Dosage Calculator ──────────────────────────────────────────────
export interface PedsDoseResult {
  dosePerKg: number;
  totalDose: number;
  unit: string;
  warning?: string;
}

export function calcPediatricDose(
  weightKg: number,
  dosePerKgMg: number,
  maxDoseMg?: number,
): PedsDoseResult {
  const total = weightKg * dosePerKgMg;
  const capped = maxDoseMg ? Math.min(total, maxDoseMg) : total;
  return {
    dosePerKg: dosePerKgMg,
    totalDose: Math.round(capped * 10) / 10,
    unit: 'mg',
    warning: maxDoseMg && total > maxDoseMg
      ? `Dose capped at max ${maxDoseMg}mg`
      : undefined,
  };
}

// ── Pregnancy Calculator (LMP → EDD & Gestational Age) ──────────────────────
export interface PregnancyCalcResult {
  edd: Date;
  eddFormatted: string;
  gestationalWeeks: number;
  gestationalDays: number;
  trimester: 1 | 2 | 3;
  daysRemaining: number;
}

export function calcPregnancy(lmpDate: Date, today = new Date()): PregnancyCalcResult {
  // Naegele's rule: EDD = LMP + 280 days
  const edd = new Date(lmpDate.getTime() + 280 * 86400000);
  const daysPassed = Math.floor((today.getTime() - lmpDate.getTime()) / 86400000);
  const gestWeeks = Math.floor(daysPassed / 7);
  const gestDays = daysPassed % 7;
  const trimester: 1 | 2 | 3 = daysPassed < 98 ? 1 : daysPassed < 182 ? 2 : 3;
  const daysRemaining = Math.max(0, Math.floor((edd.getTime() - today.getTime()) / 86400000));

  return {
    edd,
    eddFormatted: edd.toLocaleDateString('en-US'),
    gestationalWeeks: gestWeeks,
    gestationalDays: gestDays,
    trimester,
    daysRemaining,
  };
}

// ── BMI Calculator ───────────────────────────────────────────────────────────
export function calcBMI(weightKg: number, heightCm: number): {
  bmi: number;
  category: string;
  categoryAr: string;
} {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const rounded = Math.round(bmi * 10) / 10;

  if (bmi < 18.5) return { bmi: rounded, category: 'Underweight', categoryAr: 'نقص وزن' };
  if (bmi < 25) return { bmi: rounded, category: 'Normal', categoryAr: 'طبيعي' };
  if (bmi < 30) return { bmi: rounded, category: 'Overweight', categoryAr: 'زيادة وزن' };
  if (bmi < 35) return { bmi: rounded, category: 'Obese Class I', categoryAr: 'سمنة درجة 1' };
  if (bmi < 40) return { bmi: rounded, category: 'Obese Class II', categoryAr: 'سمنة درجة 2' };
  return { bmi: rounded, category: 'Morbid Obesity', categoryAr: 'سمنة مفرطة' };
}

// ── PHQ-9 Depression Screening ───────────────────────────────────────────────
export const PHQ9_QUESTIONS = [
  { id: 'q1', ar: 'القليل من الاهتمام أو المتعة في فعل الأشياء', en: 'Little interest or pleasure in doing things' },
  { id: 'q2', ar: 'الشعور بالإحباط أو الاكتئاب أو اليأس', en: 'Feeling down, depressed, or hopeless' },
  { id: 'q3', ar: 'صعوبة في النوم أو البقاء نائماً أو النوم الكثير', en: 'Trouble falling/staying asleep or sleeping too much' },
  { id: 'q4', ar: 'الشعور بالتعب أو قلة الطاقة', en: 'Feeling tired or having little energy' },
  { id: 'q5', ar: 'ضعف الشهية أو الإفراط في الأكل', en: 'Poor appetite or overeating' },
  { id: 'q6', ar: 'الشعور بأنك فاشل أو خذلت نفسك أو عائلتك', en: 'Feeling bad about yourself – a failure, letting yourself or family down' },
  { id: 'q7', ar: 'صعوبة في التركيز (القراءة، التلفاز، إلخ)', en: 'Trouble concentrating on things (reading, TV etc.)' },
  { id: 'q8', ar: 'التحرك أو الكلام ببطء ملحوظ، أو العكس', en: 'Moving/speaking slowly or being restless/fidgety' },
  { id: 'q9', ar: 'أفكار بأنك أحسن حالاً لو مت أو إيذاء نفسك', en: 'Thoughts of self-harm or being better off dead' },
];

export const PHQ9_OPTIONS = [
  { value: 0, ar: 'إطلاقاً', en: 'Not at all' },
  { value: 1, ar: 'عدة أيام', en: 'Several days' },
  { value: 2, ar: 'أكثر من نصف الأيام', en: 'More than half the days' },
  { value: 3, ar: 'كل يوم تقريباً', en: 'Nearly every day' },
];

export function interpretPHQ9(score: number): { severity: string; severityAr: string; recommendation: string } {
  if (score <= 4) return { severity: 'None-Minimal', severityAr: 'لا اكتئاب', recommendation: 'Monitor' };
  if (score <= 9) return { severity: 'Mild', severityAr: 'خفيف', recommendation: 'Watchful waiting' };
  if (score <= 14) return { severity: 'Moderate', severityAr: 'متوسط', recommendation: 'Treatment plan' };
  if (score <= 19) return { severity: 'Moderately Severe', severityAr: 'متوسط شديد', recommendation: 'Antidepressant + therapy' };
  return { severity: 'Severe', severityAr: 'شديد', recommendation: 'Immediate treatment + referral' };
}

// ── GAD-7 Anxiety Screening ───────────────────────────────────────────────────
export const GAD7_QUESTIONS = [
  { id: 'q1', ar: 'الشعور بالتوتر أو القلق أو الانهيار', en: 'Feeling nervous, anxious or on edge' },
  { id: 'q2', ar: 'عدم القدرة على التوقف عن القلق أو السيطرة عليه', en: 'Not being able to stop or control worrying' },
  { id: 'q3', ar: 'القلق الزائد بشأن أشياء مختلفة', en: 'Worrying too much about different things' },
  { id: 'q4', ar: 'صعوبة في الاسترخاء', en: 'Trouble relaxing' },
  { id: 'q5', ar: 'الاضطراب الشديد بحيث يصعب الجلوس بهدوء', en: 'Being so restless that it is hard to sit still' },
  { id: 'q6', ar: 'سهولة التضايق أو الانزعاج', en: 'Becoming easily annoyed or irritable' },
  { id: 'q7', ar: 'الشعور بالخوف كأن شيئاً فظيعاً سيحدث', en: 'Feeling afraid, as if something awful might happen' },
];

export function interpretGAD7(score: number): { severity: string; severityAr: string } {
  if (score <= 4) return { severity: 'Minimal', severityAr: 'لا قلق' };
  if (score <= 9) return { severity: 'Mild', severityAr: 'خفيف' };
  if (score <= 14) return { severity: 'Moderate', severityAr: 'متوسط' };
  return { severity: 'Severe', severityAr: 'شديد' };
}

// ── GCS Calculator ────────────────────────────────────────────────────────────
export interface GCSInput { eye: number; verbal: number; motor: number; }

export function calcGCS(input: GCSInput): {
  total: number;
  severity: string;
  severityAr: string;
} {
  const total = input.eye + input.verbal + input.motor;
  if (total >= 13) return { total, severity: 'Mild TBI / Normal', severityAr: 'خفيف / طبيعي' };
  if (total >= 9) return { total, severity: 'Moderate TBI', severityAr: 'متوسط' };
  return { total, severity: 'Severe TBI', severityAr: 'شديد' };
}

export const GCS_EYE = [
  { score: 4, en: 'Spontaneous', ar: 'تلقائي' },
  { score: 3, en: 'To voice', ar: 'للصوت' },
  { score: 2, en: 'To pain', ar: 'للألم' },
  { score: 1, en: 'None', ar: 'لا يستجيب' },
];

export const GCS_VERBAL = [
  { score: 5, en: 'Oriented', ar: 'متوجه' },
  { score: 4, en: 'Confused', ar: 'مشوش' },
  { score: 3, en: 'Words', ar: 'كلمات' },
  { score: 2, en: 'Sounds', ar: 'أصوات' },
  { score: 1, en: 'None', ar: 'لا يستجيب' },
];

export const GCS_MOTOR = [
  { score: 6, en: 'Obeys commands', ar: 'يطيع الأوامر' },
  { score: 5, en: 'Localizes pain', ar: 'يحدد الألم' },
  { score: 4, en: 'Withdraws', ar: 'يتراجع' },
  { score: 3, en: 'Flexion (abnormal)', ar: 'ثني مرضي' },
  { score: 2, en: 'Extension', ar: 'بسط' },
  { score: 1, en: 'None', ar: 'لا يستجيب' },
];

// ── IPSS Prostate Score ───────────────────────────────────────────────────────
export const IPSS_QUESTIONS = [
  { id: 'incomplete', ar: 'هل شعرت بعدم إفراغ المثانة تماماً؟', en: 'Incomplete emptying' },
  { id: 'frequency', ar: 'هل احتجت للتبول في غضون ساعتين؟', en: 'Frequency' },
  { id: 'intermittency', ar: 'هل توقف التبول ثم عاد عدة مرات؟', en: 'Intermittency' },
  { id: 'urgency', ar: 'هل صعب عليك تأجيل التبول؟', en: 'Urgency' },
  { id: 'weak_stream', ar: 'هل كان تيار البول ضعيفاً؟', en: 'Weak stream' },
  { id: 'straining', ar: 'هل احتجت للجهد لبدء التبول؟', en: 'Straining' },
  { id: 'nocturia', ar: 'كم مرة تبولت ليلاً؟', en: 'Nocturia (0-5 times)' },
];

export function interpretIPSS(score: number): { severity: string; severityAr: string } {
  if (score <= 7) return { severity: 'Mild', severityAr: 'خفيف' };
  if (score <= 19) return { severity: 'Moderate', severityAr: 'متوسط' };
  return { severity: 'Severe', severityAr: 'شديد' };
}

// ── CHA₂DS₂-VASc (AF Stroke Risk) ────────────────────────────────────────────
export interface CHADSInput {
  chf: boolean; hypertension: boolean; age75: boolean;
  diabetes: boolean; stroke: boolean; vascular: boolean;
  age65to74: boolean; female: boolean;
}

export function calcCHADSVASc(input: CHADSInput): {
  score: number; recommendation: string; recommendationAr: string;
} {
  const score =
    (input.chf ? 1 : 0) + (input.hypertension ? 1 : 0) +
    (input.age75 ? 2 : 0) + (input.diabetes ? 1 : 0) +
    (input.stroke ? 2 : 0) + (input.vascular ? 1 : 0) +
    (input.age65to74 ? 1 : 0) + (input.female ? 1 : 0);

  if (score === 0) return { score, recommendation: 'No anticoagulation', recommendationAr: 'لا يحتاج مضاد تخثر' };
  if (score === 1) return { score, recommendation: 'Consider anticoagulation', recommendationAr: 'يُفضَّل مضاد التخثر' };
  return { score, recommendation: 'Anticoagulation recommended', recommendationAr: 'مضاد التخثر موصى به' };
}

// ── Centor Score (Tonsillitis / Strep) ────────────────────────────────────────
export interface CentorInput {
  tonsillarExudate: boolean;
  tenderAnteriorCervicalNodes: boolean;
  feverHistory: boolean;
  noCough: boolean;
  age3to14?: boolean;
  age15to44?: boolean;
}

export function calcCentor(input: CentorInput): {
  score: number;
  recommendation: string;
  recommendationAr: string;
} {
  let score =
    (input.tonsillarExudate ? 1 : 0) +
    (input.tenderAnteriorCervicalNodes ? 1 : 0) +
    (input.feverHistory ? 1 : 0) +
    (input.noCough ? 1 : 0);

  if (input.age3to14) score += 1;
  if (input.age15to44) score += 0;

  if (score <= 1) return { score, recommendation: 'No antibiotics (low strep risk)', recommendationAr: 'لا مضاد حيوي — خطر منخفض' };
  if (score <= 2) return { score, recommendation: 'Consider culture / rapid test', recommendationAr: 'يُفضَّل مسحة للثقافة' };
  return { score, recommendation: 'Empirical antibiotics appropriate', recommendationAr: 'يُنصَح بالمضاد الحيوي' };
}

// ── Bishop Score (Cervical Ripening for Labor) ────────────────────────────────
export interface BishopInput {
  dilation: 0 | 1 | 2 | 3;       // cervical dilation cm: 0→0, 1-2→1, 3-4→2, ≥5→3
  effacement: 0 | 1 | 2 | 3;     // effacement %: 0-30→0, 40-50→1, 60-70→2, ≥80→3
  station: 0 | 1 | 2 | 3;        // fetal station: -3→0, -2→1, -1/0→2, +1/+2→3
  consistency: 0 | 1 | 2;        // cervical consistency: firm→0, medium→1, soft→2
  position: 0 | 1 | 2;           // cervical position: posterior→0, mid→1, anterior→2
}

export const BISHOP_DILATION_OPTIONS = [
  { score: 0 as const, labelEn: 'Closed (0 cm)', labelAr: 'مغلق (0 سم)' },
  { score: 1 as const, labelEn: '1–2 cm', labelAr: '1–2 سم' },
  { score: 2 as const, labelEn: '3–4 cm', labelAr: '3–4 سم' },
  { score: 3 as const, labelEn: '≥5 cm', labelAr: '5 سم فأكثر' },
];

export const BISHOP_EFFACEMENT_OPTIONS = [
  { score: 0 as const, labelEn: '0–30%', labelAr: '0–30%' },
  { score: 1 as const, labelEn: '40–50%', labelAr: '40–50%' },
  { score: 2 as const, labelEn: '60–70%', labelAr: '60–70%' },
  { score: 3 as const, labelEn: '≥80%', labelAr: '80% فأكثر' },
];

export const BISHOP_STATION_OPTIONS = [
  { score: 0 as const, labelEn: '-3', labelAr: '-3' },
  { score: 1 as const, labelEn: '-2', labelAr: '-2' },
  { score: 2 as const, labelEn: '-1 / 0', labelAr: '-1 / 0' },
  { score: 3 as const, labelEn: '+1 / +2', labelAr: '+1 / +2' },
];

export const BISHOP_CONSISTENCY_OPTIONS = [
  { score: 0 as const, labelEn: 'Firm', labelAr: 'صلب' },
  { score: 1 as const, labelEn: 'Medium', labelAr: 'متوسط' },
  { score: 2 as const, labelEn: 'Soft', labelAr: 'طري' },
];

export const BISHOP_POSITION_OPTIONS = [
  { score: 0 as const, labelEn: 'Posterior', labelAr: 'خلفي' },
  { score: 1 as const, labelEn: 'Mid', labelAr: 'متوسط' },
  { score: 2 as const, labelEn: 'Anterior', labelAr: 'أمامي' },
];

export function calcBishop(input: BishopInput): {
  score: number;
  interpretation: string;
  interpretationAr: string;
  recommendation: string;
  recommendationAr: string;
} {
  const score = input.dilation + input.effacement + input.station + input.consistency + input.position;
  if (score >= 8) return {
    score,
    interpretation: 'Favorable (≥8)',
    interpretationAr: 'ملائم (≥8)',
    recommendation: 'Induction likely to succeed',
    recommendationAr: 'الحث على الولادة مرجّح النجاح',
  };
  if (score >= 6) return {
    score,
    interpretation: 'Intermediate (6–7)',
    interpretationAr: 'متوسط (6–7)',
    recommendation: 'Consider cervical ripening before induction',
    recommendationAr: 'يُنصح بتنضيج عنق الرحم قبل الحث',
  };
  return {
    score,
    interpretation: 'Unfavorable (<6)',
    interpretationAr: 'غير ملائم (<6)',
    recommendation: 'Cervical ripening required before induction',
    recommendationAr: 'مطلوب تنضيج عنق الرحم أولاً',
  };
}

// ── NIHSS — NIH Stroke Scale ──────────────────────────────────────────────────
export const NIHSS_ITEMS = [
  { id: 'loc', labelEn: '1a. Level of Consciousness', labelAr: 'مستوى الوعي', max: 3 },
  { id: 'locQuestions', labelEn: '1b. LOC Questions', labelAr: 'أسئلة الوعي', max: 2 },
  { id: 'locCommands', labelEn: '1c. LOC Commands', labelAr: 'أوامر الوعي', max: 2 },
  { id: 'bestGaze', labelEn: '2. Best Gaze', labelAr: 'أفضل نظرة', max: 2 },
  { id: 'visual', labelEn: '3. Visual Fields', labelAr: 'المجال البصري', max: 3 },
  { id: 'facialPalsy', labelEn: '4. Facial Palsy', labelAr: 'شلل الوجه', max: 3 },
  { id: 'motorArmLeft', labelEn: '5a. Motor Arm — Left', labelAr: 'حركة اليد — اليسار', max: 4 },
  { id: 'motorArmRight', labelEn: '5b. Motor Arm — Right', labelAr: 'حركة اليد — اليمين', max: 4 },
  { id: 'motorLegLeft', labelEn: '6a. Motor Leg — Left', labelAr: 'حركة الساق — اليسار', max: 4 },
  { id: 'motorLegRight', labelEn: '6b. Motor Leg — Right', labelAr: 'حركة الساق — اليمين', max: 4 },
  { id: 'limbAtaxia', labelEn: '7. Limb Ataxia', labelAr: 'ترنح الأطراف', max: 2 },
  { id: 'sensory', labelEn: '8. Sensory', labelAr: 'الحس', max: 2 },
  { id: 'bestLanguage', labelEn: '9. Best Language', labelAr: 'اللغة', max: 3 },
  { id: 'dysarthria', labelEn: '10. Dysarthria', labelAr: 'عسر التلفظ', max: 2 },
  { id: 'extinction', labelEn: '11. Extinction/Inattention', labelAr: 'الإهمال والانطفاء', max: 2 },
];

export function interpretNIHSS(score: number): { severity: string; severityAr: string; recommendation: string; recommendationAr: string } {
  if (score === 0) return { severity: 'No stroke', severityAr: 'لا سكتة', recommendation: 'No deficit', recommendationAr: 'لا عجز' };
  if (score <= 4) return { severity: 'Minor stroke', severityAr: 'سكتة خفيفة', recommendation: 'Consider thrombolysis if within window', recommendationAr: 'النظر في الإذابة الوريدية' };
  if (score <= 15) return { severity: 'Moderate stroke', severityAr: 'سكتة متوسطة', recommendation: 'Thrombolysis / thrombectomy evaluation', recommendationAr: 'تقييم الإذابة والتدخل الميكانيكي' };
  if (score <= 20) return { severity: 'Moderate-severe', severityAr: 'متوسطة-شديدة', recommendation: 'Urgent thrombectomy if eligible', recommendationAr: 'تدخل ميكانيكي عاجل إن أمكن' };
  return { severity: 'Severe stroke', severityAr: 'سكتة شديدة', recommendation: 'ICU / supportive care / palliative discussion', recommendationAr: 'عناية مركزة / علاج داعم' };
}

// ── Wells Score for PE (Adults) ───────────────────────────────────────────────
export interface WellsPEInput {
  dvtSignsSymptoms: boolean;         // +3
  alternativeDiagnosisLessLikely: boolean; // +3
  hrOver100: boolean;                 // +1.5
  immobilizationOrSurgery: boolean;   // +1.5
  previousDvtOrPe: boolean;           // +1.5
  hemoptysis: boolean;                // +1
  malignancy: boolean;                // +1
}

export function calcWellsPE(input: WellsPEInput): { score: number; probability: string; probabilityAr: string; recommendation: string; recommendationAr: string } {
  const score =
    (input.dvtSignsSymptoms ? 3 : 0) +
    (input.alternativeDiagnosisLessLikely ? 3 : 0) +
    (input.hrOver100 ? 1.5 : 0) +
    (input.immobilizationOrSurgery ? 1.5 : 0) +
    (input.previousDvtOrPe ? 1.5 : 0) +
    (input.hemoptysis ? 1 : 0) +
    (input.malignancy ? 1 : 0);

  if (score <= 1) return { score, probability: 'Low (PE unlikely)', probabilityAr: 'احتمال منخفض', recommendation: 'D-dimer → CT-PA only if elevated', recommendationAr: 'D-dimer ثم CT-PA إذا ارتفع' };
  if (score <= 6) return { score, probability: 'Moderate', probabilityAr: 'احتمال متوسط', recommendation: 'CT pulmonary angiography', recommendationAr: 'تصوير الأوعية الرئوية بالـ CT' };
  return { score, probability: 'High (PE likely)', probabilityAr: 'احتمال مرتفع', recommendation: 'CT-PA immediately; consider empirical anticoagulation', recommendationAr: 'CT-PA فوراً وبدء مضاد التخثر' };
}

// ── GRACE Score — ACS Risk ───────────────────────────────────────────────────
// Simplified version: age + HR + BP + Creatinine + Killip + risk factors
export function interpretGRACE(score: number): { risk: string; riskAr: string; mortalityEstimate: string; recommendation: string; recommendationAr: string } {
  if (score < 109) return {
    risk: 'Low', riskAr: 'منخفض',
    mortalityEstimate: '<1% in-hospital mortality',
    recommendation: 'Medical management; early discharge possible',
    recommendationAr: 'علاج دوائي؛ خروج مبكر ممكن',
  };
  if (score <= 140) return {
    risk: 'Intermediate', riskAr: 'متوسط',
    mortalityEstimate: '1–3% in-hospital mortality',
    recommendation: 'Angiography within 72 hours',
    recommendationAr: 'قسطرة تشخيصية خلال 72 ساعة',
  };
  return {
    risk: 'High', riskAr: 'مرتفع',
    mortalityEstimate: '>3% in-hospital mortality',
    recommendation: 'Early invasive strategy (angiography within 24h)',
    recommendationAr: 'تدخل جراحي مبكر — قسطرة خلال 24 ساعة',
  };
}

// ── PEWS — Pediatric Early Warning Score ─────────────────────────────────────
export const PEWS_BEHAVIOR = [
  { score: 0, labelEn: 'Playing / appropriate', labelAr: 'يلعب / طبيعي' },
  { score: 1, labelEn: 'Sleeping', labelAr: 'نائم' },
  { score: 2, labelEn: 'Irritable', labelAr: 'متهيج' },
  { score: 3, labelEn: 'Lethargic / reduced response', labelAr: 'خمول / استجابة مقللة' },
];

export const PEWS_CARDIOVASCULAR = [
  { score: 0, labelEn: 'Pink or capillary refill 1–2s', labelAr: 'لون طبيعي، إعادة تعبئة 1–2 ثانية' },
  { score: 1, labelEn: 'Pale or capillary refill 3s', labelAr: 'شاحب، إعادة تعبئة 3 ثانية' },
  { score: 2, labelEn: 'Gray or capillary refill 4s', labelAr: 'رمادي، إعادة تعبئة 4 ثانية' },
  { score: 3, labelEn: 'Gray and mottled or capillary refill ≥5s', labelAr: 'رمادي ومرقط، إعادة تعبئة ≥5 ثانية' },
];

export const PEWS_RESPIRATORY = [
  { score: 0, labelEn: 'Within normal parameters', labelAr: 'طبيعي' },
  { score: 1, labelEn: '>10 above normal / using accessory muscles / 30–40% FiO₂', labelAr: 'أكثر من 10 فوق الطبيعي / عضلات مساعدة' },
  { score: 2, labelEn: '>20 above normal / sternal recession / >40% FiO₂', labelAr: 'أكثر من 20 فوق الطبيعي / تراجع قصي' },
  { score: 3, labelEn: '5 below normal with recession and grunting', labelAr: 'أقل من 5 مع تراجع وأنين' },
];

export function interpretPEWS(score: number): { severity: string; severityAr: string; action: string; actionAr: string } {
  if (score === 0) return { severity: 'Normal', severityAr: 'طبيعي', action: 'Routine monitoring', actionAr: 'مراقبة اعتيادية' };
  if (score <= 2) return { severity: 'Low concern', severityAr: 'قلق منخفض', action: 'Increase observation', actionAr: 'زيادة المراقبة' };
  if (score <= 4) return { severity: 'Medium concern', severityAr: 'قلق متوسط', action: 'Inform doctor — review within 30 min', actionAr: 'إخطار الطبيب — مراجعة خلال 30 دقيقة' };
  return { severity: 'High concern', severityAr: 'قلق مرتفع', action: 'Emergency response — activate team', actionAr: 'استجابة طارئة — تفعيل الفريق' };
}

// ── VAS — Visual Analogue Scale (Pain) ───────────────────────────────────────
export function interpretVAS(score: number): { severity: string; severityAr: string; management: string; managementAr: string } {
  if (score === 0) return { severity: 'No pain', severityAr: 'لا ألم', management: 'No intervention required', managementAr: 'لا تدخل مطلوب' };
  if (score <= 3) return { severity: 'Mild', severityAr: 'خفيف', management: 'Non-opioid analgesia', managementAr: 'مسكن غير أفيوني' };
  if (score <= 6) return { severity: 'Moderate', severityAr: 'متوسط', management: 'Multimodal analgesia', managementAr: 'مسكن متعدد' };
  if (score <= 9) return { severity: 'Severe', severityAr: 'شديد', management: 'Strong opioid + adjuvant', managementAr: 'أفيوني قوي + مساعد' };
  return { severity: 'Worst possible', severityAr: 'أشد ما يكون', management: 'Urgent pain management review', managementAr: 'مراجعة طارئة لإدارة الألم' };
}

// ── MMSE — Mini-Mental State Examination ─────────────────────────────────────
export const MMSE_DOMAINS = [
  { id: 'orientation_time', labelEn: 'Orientation to Time (year, season, month, date, day)', labelAr: 'التوجه الزمني (سنة، فصل، شهر، تاريخ، يوم)', max: 5 },
  { id: 'orientation_place', labelEn: 'Orientation to Place (country, region, city, hospital, floor)', labelAr: 'التوجه المكاني (دولة، منطقة، مدينة، مستشفى، طابق)', max: 5 },
  { id: 'registration', labelEn: 'Registration (3 objects repeated)', labelAr: 'التسجيل (تكرار 3 أشياء)', max: 3 },
  { id: 'attention', labelEn: 'Attention & Calculation (serial 7s or WORLD backwards)', labelAr: 'الانتباه والحساب (طرح 7 أو WORLD عكسياً)', max: 5 },
  { id: 'recall', labelEn: 'Recall (3 objects from registration)', labelAr: 'الاسترجاع (3 أشياء من التسجيل)', max: 3 },
  { id: 'language', labelEn: 'Language (naming, repetition, commands, reading, writing, copying)', labelAr: 'اللغة (التسمية، التكرار، الأوامر، القراءة، الكتابة، النسخ)', max: 9 },
];

export function interpretMMSE(score: number): { severity: string; severityAr: string; recommendation: string; recommendationAr: string } {
  if (score >= 27) return { severity: 'Normal cognition', severityAr: 'معرفة طبيعية', recommendation: 'No impairment', recommendationAr: 'لا ضعف' };
  if (score >= 24) return { severity: 'Possible MCI', severityAr: 'ضعف معرفي محتمل خفيف', recommendation: 'Follow-up testing in 6–12 months', recommendationAr: 'متابعة خلال 6–12 شهراً' };
  if (score >= 18) return { severity: 'Mild dementia', severityAr: 'خرف خفيف', recommendation: 'Neuropsychological evaluation; consider medications', recommendationAr: 'تقييم نفس-عصبي' };
  if (score >= 10) return { severity: 'Moderate dementia', severityAr: 'خرف متوسط', recommendation: 'Dementia workup; caregiver support', recommendationAr: 'تقييم الخرف ودعم مقدم الرعاية' };
  return { severity: 'Severe dementia', severityAr: 'خرف شديد', recommendation: 'Supportive care; advanced care planning', recommendationAr: 'رعاية داعمة وتخطيط مسبق' };
}

// ── MoCA — Montreal Cognitive Assessment ─────────────────────────────────────
export const MOCA_DOMAINS = [
  { id: 'visuospatial', labelEn: 'Visuospatial / Executive (trail, cube, clock)', labelAr: 'البصري/التنفيذي (مسار، مكعب، ساعة)', max: 5 },
  { id: 'naming', labelEn: 'Naming (lion, rhino, camel)', labelAr: 'التسمية (أسد، وحيد قرن، جمل)', max: 3 },
  { id: 'memory', labelEn: 'Memory — delayed recall (5 words)', labelAr: 'الذاكرة — استرجاع مؤجل (5 كلمات)', max: 5 },
  { id: 'attention', labelEn: 'Attention (forward/backward digit span, serial 7s, vigilance)', labelAr: 'الانتباه (أرقام، حساب، يقظة)', max: 6 },
  { id: 'language', labelEn: 'Language (sentence repeat, word fluency)', labelAr: 'اللغة (تكرار جملة، طلاقة كلمات)', max: 3 },
  { id: 'abstraction', labelEn: 'Abstraction (similarities)', labelAr: 'التجريد (تشابهات)', max: 2 },
  { id: 'orientation', labelEn: 'Orientation (date, month, year, day, place, city)', labelAr: 'التوجه (تاريخ، شهر، سنة، يوم، مكان، مدينة)', max: 6 },
];

export function interpretMoCA(score: number): { severity: string; severityAr: string; recommendation: string; recommendationAr: string } {
  const adjusted = score; // +1 if education ≤12 years (handled in UI)
  if (adjusted >= 26) return { severity: 'Normal', severityAr: 'طبيعي', recommendation: 'No cognitive impairment detected', recommendationAr: 'لا ضعف معرفي' };
  if (adjusted >= 18) return { severity: 'Mild MCI', severityAr: 'ضعف معرفي خفيف', recommendation: 'Neuropsychological follow-up', recommendationAr: 'متابعة نفس-عصبية' };
  if (adjusted >= 10) return { severity: 'Moderate cognitive impairment', severityAr: 'ضعف معرفي متوسط', recommendation: 'Dementia evaluation', recommendationAr: 'تقييم الخرف' };
  return { severity: 'Severe cognitive impairment', severityAr: 'ضعف معرفي شديد', recommendation: 'Comprehensive dementia workup', recommendationAr: 'تقييم شامل للخرف' };
}

// ── CAT — COPD Assessment Test ────────────────────────────────────────────────
export const CAT_QUESTIONS = [
  { id: 'cough', labelEn: 'Cough (never → always)', labelAr: 'السعال (لا أبداً ← دائماً)' },
  { id: 'phlegm', labelEn: 'Phlegm (none → lots)', labelAr: 'البلغم (لا شيء ← كثير)' },
  { id: 'chestTightness', labelEn: 'Chest tightness (none → very tight)', labelAr: 'ضيق الصدر (لا شيء ← شديد)' },
  { id: 'breathless', labelEn: 'Breathlessness going uphill/stairs', labelAr: 'ضيق تنفس عند الصعود' },
  { id: 'activities', labelEn: 'Activity limitation at home (none → very limited)', labelAr: 'تقييد النشاط المنزلي' },
  { id: 'confidence', labelEn: 'Confidence leaving home (confident → not at all)', labelAr: 'الثقة بالخروج من المنزل' },
  { id: 'sleep', labelEn: 'Sleep quality (good → very poor)', labelAr: 'جودة النوم (جيد ← سيء جداً)' },
  { id: 'energy', labelEn: 'Energy level (lots → none)', labelAr: 'مستوى الطاقة (كثير ← لا شيء)' },
];

export function interpretCAT(score: number): { impact: string; impactAr: string; recommendation: string; recommendationAr: string } {
  if (score <= 9) return { impact: 'Low impact', impactAr: 'تأثير منخفض', recommendation: 'Encourage physical activity; smoking cessation', recommendationAr: 'تشجيع النشاط البدني والإقلاع عن التدخين' };
  if (score <= 20) return { impact: 'Medium impact', impactAr: 'تأثير متوسط', recommendation: 'Review inhaler technique; consider pulmonary rehab', recommendationAr: 'مراجعة تقنية الاستنشاق وإعادة التأهيل' };
  if (score <= 30) return { impact: 'High impact', impactAr: 'تأثير مرتفع', recommendation: 'Specialist review; consider combination therapy', recommendationAr: 'مراجعة متخصص ودمج العلاج' };
  return { impact: 'Very high impact', impactAr: 'تأثير مرتفع جداً', recommendation: 'Urgent specialist review; palliative consideration', recommendationAr: 'مراجعة عاجلة ورعاية تلطيفية محتملة' };
}

// ── FINDRISC — Diabetes Risk Score ───────────────────────────────────────────
export const FINDRISC_QUESTIONS = [
  {
    id: 'age',
    labelEn: 'Age',
    labelAr: 'العمر',
    options: [
      { value: 0, labelEn: '<45 years', labelAr: 'أقل من 45' },
      { value: 2, labelEn: '45–54 years', labelAr: '45–54 سنة' },
      { value: 3, labelEn: '55–64 years', labelAr: '55–64 سنة' },
      { value: 4, labelEn: '≥65 years', labelAr: '65 سنة فأكثر' },
    ],
  },
  {
    id: 'bmi',
    labelEn: 'BMI',
    labelAr: 'مؤشر كتلة الجسم',
    options: [
      { value: 0, labelEn: '<25 kg/m²', labelAr: 'أقل من 25' },
      { value: 1, labelEn: '25–30 kg/m²', labelAr: '25–30' },
      { value: 3, labelEn: '>30 kg/m²', labelAr: 'أكثر من 30' },
    ],
  },
  {
    id: 'waist',
    labelEn: 'Waist circumference (for men / women)',
    labelAr: 'محيط الخصر (رجل / امرأة)',
    options: [
      { value: 0, labelEn: '<94 cm / <80 cm', labelAr: 'أقل من 94 / 80 سم' },
      { value: 3, labelEn: '94–102 cm / 80–88 cm', labelAr: '94–102 / 80–88 سم' },
      { value: 4, labelEn: '>102 cm / >88 cm', labelAr: 'أكثر من 102 / 88 سم' },
    ],
  },
  {
    id: 'activity',
    labelEn: 'Physical activity ≥30 min daily',
    labelAr: 'نشاط بدني ≥30 دقيقة يومياً',
    options: [
      { value: 0, labelEn: 'Yes', labelAr: 'نعم' },
      { value: 2, labelEn: 'No', labelAr: 'لا' },
    ],
  },
  {
    id: 'vegetables',
    labelEn: 'Daily vegetables / fruits',
    labelAr: 'الخضار والفواكه يومياً',
    options: [
      { value: 0, labelEn: 'Yes, every day', labelAr: 'نعم، يومياً' },
      { value: 1, labelEn: 'Not every day', labelAr: 'ليس يومياً' },
    ],
  },
  {
    id: 'bpMeds',
    labelEn: 'Blood pressure medication',
    labelAr: 'أدوية ضغط الدم',
    options: [
      { value: 0, labelEn: 'No', labelAr: 'لا' },
      { value: 2, labelEn: 'Yes', labelAr: 'نعم' },
    ],
  },
  {
    id: 'highGlucose',
    labelEn: 'High blood glucose history',
    labelAr: 'تاريخ ارتفاع السكر',
    options: [
      { value: 0, labelEn: 'Never', labelAr: 'لا' },
      { value: 5, labelEn: 'Yes (pregnancy, illness, etc.)', labelAr: 'نعم (حمل، مرض، إلخ)' },
    ],
  },
  {
    id: 'family',
    labelEn: 'Family history of diabetes',
    labelAr: 'تاريخ عائلي للسكري',
    options: [
      { value: 0, labelEn: 'No', labelAr: 'لا' },
      { value: 3, labelEn: 'Yes (2nd-degree relative)', labelAr: 'نعم (قريب من الدرجة الثانية)' },
      { value: 5, labelEn: 'Yes (parent, sibling, or child)', labelAr: 'نعم (والد أو أخ أو ابن)' },
    ],
  },
];

export function interpretFINDRISC(score: number): { risk: string; riskAr: string; tenYearRisk: string; recommendation: string; recommendationAr: string } {
  if (score <= 7) return { risk: 'Low', riskAr: 'منخفض', tenYearRisk: '1%', recommendation: 'Healthy lifestyle advice', recommendationAr: 'نصائح النمط الصحي' };
  if (score <= 11) return { risk: 'Slightly elevated', riskAr: 'مرتفع قليلاً', tenYearRisk: '4%', recommendation: 'Lifestyle modification', recommendationAr: 'تعديل نمط الحياة' };
  if (score <= 14) return { risk: 'Moderate', riskAr: 'متوسط', tenYearRisk: '17%', recommendation: 'Lifestyle + fasting glucose test', recommendationAr: 'نمط حياة + سكر صيام' };
  if (score <= 20) return { risk: 'High', riskAr: 'مرتفع', tenYearRisk: '33%', recommendation: 'Oral glucose tolerance test; preventive program', recommendationAr: 'اختبار تحمل الغلوكوز; برنامج وقائي' };
  return { risk: 'Very high', riskAr: 'مرتفع جداً', tenYearRisk: '50%', recommendation: 'Immediate diabetes screening + lifestyle intervention', recommendationAr: 'فحص فوري وتدخل مكثف' };
}

// ── Wells Score for DVT — Pediatric ──────────────────────────────────────────
export interface WellsChildInput {
  activeOrRecentCancer: boolean;       // +1
  bedridden3DaysOrMajorSurgery: boolean; // +1
  calf3cmLargerThanOther: boolean;     // +1
  collateralSuperficialVeins: boolean; // +1
  entireLegSwollen: boolean;           // +1
  localizedTenderness: boolean;        // +1
  pittingEdema: boolean;               // +1
  paralysisOrRecentPlaster: boolean;   // +1
  previousDvtDocumented: boolean;      // +1
  alternativeDiagnosisAsLikely: boolean; // -2 (negative criterion)
}

export function calcWellsChild(input: WellsChildInput): { score: number; probability: string; probabilityAr: string; recommendation: string; recommendationAr: string } {
  const score =
    (input.activeOrRecentCancer ? 1 : 0) +
    (input.bedridden3DaysOrMajorSurgery ? 1 : 0) +
    (input.calf3cmLargerThanOther ? 1 : 0) +
    (input.collateralSuperficialVeins ? 1 : 0) +
    (input.entireLegSwollen ? 1 : 0) +
    (input.localizedTenderness ? 1 : 0) +
    (input.pittingEdema ? 1 : 0) +
    (input.paralysisOrRecentPlaster ? 1 : 0) +
    (input.previousDvtDocumented ? 1 : 0) +
    (input.alternativeDiagnosisAsLikely ? -2 : 0);

  if (score <= 0) return { score, probability: 'Low DVT probability', probabilityAr: 'احتمال DVT منخفض', recommendation: 'D-dimer; if negative, no further testing', recommendationAr: 'D-dimer؛ إذا سلبي لا حاجة لمزيد' };
  if (score <= 2) return { score, probability: 'Moderate DVT probability', probabilityAr: 'احتمال متوسط', recommendation: 'Duplex ultrasound recommended', recommendationAr: 'تصوير Duplex موصى به' };
  return { score, probability: 'High DVT probability', probabilityAr: 'احتمال مرتفع', recommendation: 'Duplex ultrasound; if negative, repeat or venography', recommendationAr: 'Duplex، وإذا سلبي كرر أو venography' };
}

// ── KOOS — Knee Injury & Osteoarthritis Outcome Score (Simplified) ────────────
// 5 subscales, each 0-100 (higher = better)
export const KOOS_SUBSCALES = [
  { id: 'symptoms', labelEn: 'Symptoms (stiffness, swelling, grinding)', labelAr: 'الأعراض (تصلب، تورم، احتكاك)', max: 100 },
  { id: 'pain', labelEn: 'Pain (frequency and severity)', labelAr: 'الألم (تكرار وشدة)', max: 100 },
  { id: 'adl', labelEn: 'Activities of Daily Living (ADL)', labelAr: 'أنشطة الحياة اليومية', max: 100 },
  { id: 'sport', labelEn: 'Sport & Recreation', labelAr: 'الرياضة والترفيه', max: 100 },
  { id: 'qol', labelEn: 'Knee-related Quality of Life', labelAr: 'جودة الحياة المرتبطة بالركبة', max: 100 },
];

export function interpretKOOS(scores: Record<string, number>): { average: number; interpretation: string; interpretationAr: string } {
  const vals = Object.values(scores).filter(v => v >= 0 && v <= 100);
  if (vals.length === 0) return { average: 0, interpretation: 'Incomplete', interpretationAr: 'غير مكتمل' };
  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  if (avg >= 75) return { average: avg, interpretation: 'Mild limitation', interpretationAr: 'تقييد خفيف' };
  if (avg >= 50) return { average: avg, interpretation: 'Moderate limitation', interpretationAr: 'تقييد متوسط' };
  if (avg >= 25) return { average: avg, interpretation: 'Severe limitation', interpretationAr: 'تقييد شديد' };
  return { average: avg, interpretation: 'Extreme limitation', interpretationAr: 'تقييد شديد جداً' };
}

// ── P-POSSUM — Physiological & Operative Severity Score ──────────────────────
export const POSSUM_PHYSIOLOGICAL = [
  { id: 'age', labelEn: 'Age', labelAr: 'العمر', options: [{ value: 1, labelEn: '<60', labelAr: '<60' }, { value: 2, labelEn: '61–70', labelAr: '61–70' }, { value: 4, labelEn: '>70', labelAr: '>70' }] },
  { id: 'cardiacHistory', labelEn: 'Cardiac history', labelAr: 'تاريخ قلبي', options: [{ value: 1, labelEn: 'No failure', labelAr: 'لا قصور' }, { value: 2, labelEn: 'Diuretic / digoxin / anti-anginal / hypertension Rx', labelAr: 'أدوية قلبية' }, { value: 4, labelEn: 'Peripheral edema / warfarin', labelAr: 'وذمة / وارفرين' }, { value: 8, labelEn: 'Cardiomegaly on CXR', labelAr: 'تضخم قلب بالأشعة' }] },
  { id: 'respiratoryHistory', labelEn: 'Respiratory history', labelAr: 'تاريخ تنفسي', options: [{ value: 1, labelEn: 'No dyspnea', labelAr: 'لا ضيق' }, { value: 2, labelEn: 'Dyspnea on exertion / mild COPD', labelAr: 'ضيق مجهود / COPD خفيف' }, { value: 4, labelEn: 'Limiting dyspnea / moderate COPD', labelAr: 'ضيق محدود / COPD متوسط' }, { value: 8, labelEn: 'Dyspnea at rest / fibrosing alveolitis', labelAr: 'ضيق راحة / تليف' }] },
  { id: 'ecg', labelEn: 'ECG', labelAr: 'تخطيط القلب', options: [{ value: 1, labelEn: 'Normal', labelAr: 'طبيعي' }, { value: 4, labelEn: 'AF (rate 60–90)', labelAr: 'رجفان أذيني' }, { value: 8, labelEn: 'Any other change', labelAr: 'أي تغيير آخر' }] },
  { id: 'systolicBp', labelEn: 'Systolic BP', labelAr: 'ضغط انقباضي', options: [{ value: 1, labelEn: '110–130', labelAr: '110–130' }, { value: 2, labelEn: '131–170 or 100–109', labelAr: '131–170 أو 100–109' }, { value: 4, labelEn: '≥171 or 90–99', labelAr: '≥171 أو 90–99' }, { value: 8, labelEn: '≤89', labelAr: '≤89' }] },
  { id: 'hr', labelEn: 'Heart rate', labelAr: 'معدل القلب', options: [{ value: 1, labelEn: '50–80', labelAr: '50–80' }, { value: 2, labelEn: '81–100 or 40–49', labelAr: '81–100 أو 40–49' }, { value: 4, labelEn: '101–120 or <40', labelAr: '101–120 أو <40' }, { value: 8, labelEn: '>120', labelAr: '>120' }] },
];

export const POSSUM_OPERATIVE = [
  { id: 'operativeUrgency', labelEn: 'Operative urgency', labelAr: 'درجة الاستعجال', options: [{ value: 1, labelEn: 'Elective', labelAr: 'مخطط' }, { value: 2, labelEn: 'Urgent (24–72h)', labelAr: 'عاجل (24–72 ساعة)' }, { value: 4, labelEn: 'Immediate (<24h)', labelAr: 'فوري (<24 ساعة)' }] },
  { id: 'operativeScope', labelEn: 'Operative scope', labelAr: 'نطاق العملية', options: [{ value: 1, labelEn: 'Minor (e.g., endoscopy)', labelAr: 'بسيطة (تنظير)' }, { value: 2, labelEn: 'Intermediate', labelAr: 'متوسطة' }, { value: 4, labelEn: 'Major', labelAr: 'كبيرة' }, { value: 8, labelEn: 'Major+ (e.g., Whipple, oesophagectomy)', labelAr: 'كبيرة جداً' }] },
  { id: 'peritonealSoiling', labelEn: 'Peritoneal soiling', labelAr: 'تلوث بريتوني', options: [{ value: 1, labelEn: 'None', labelAr: 'لا' }, { value: 2, labelEn: 'Minor (serous fluid)', labelAr: 'بسيط' }, { value: 4, labelEn: 'Local pus', labelAr: 'صديد محلي' }, { value: 8, labelEn: 'Free bowel content, pus, or blood', labelAr: 'محتوى أمعاء حر أو صديد أو دم' }] },
];

export function interpretPOSSUM(physScore: number, opScore: number): { mortalityRisk: number; morbidityRisk: number; interpretation: string; interpretationAr: string } {
  // P-POSSUM formulae (Portsmouth modification)
  const logMortality = -7.04 + 0.13 * physScore + 0.16 * opScore;
  const logMorbidity = -5.91 + 0.16 * physScore + 0.19 * opScore;
  const mortalityRisk = Math.round((Math.exp(logMortality) / (1 + Math.exp(logMortality))) * 100 * 10) / 10;
  const morbidityRisk = Math.round((Math.exp(logMorbidity) / (1 + Math.exp(logMorbidity))) * 100 * 10) / 10;
  const interp = mortalityRisk < 5 ? 'Low risk' : mortalityRisk < 15 ? 'Intermediate risk' : 'High risk';
  const interpAr = mortalityRisk < 5 ? 'خطر منخفض' : mortalityRisk < 15 ? 'خطر متوسط' : 'خطر مرتفع';
  return { mortalityRisk, morbidityRisk, interpretation: interp, interpretationAr: interpAr };
}
