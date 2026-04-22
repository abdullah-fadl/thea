/**
 * VTE (Venous Thromboembolism) Risk Assessment
 *
 * Implements two validated scoring systems:
 * 1. Padua Prediction Score — for MEDICAL patients (Barbar et al., J Thromb Haemost 2010)
 * 2. Caprini Score — for SURGICAL patients (Caprini, Clin Appl Thromb Hemost 2004)
 *
 * Includes bleeding risk contraindication checking before recommending
 * pharmacological prophylaxis (ACCP/CHEST Guidelines).
 */

// ---------------------------------------------------------------------------
// Caprini Factor Keys — exhaustive list
// ---------------------------------------------------------------------------

/** 1-point Caprini risk factors */
export const CAPRINI_1PT_FACTORS = [
  'age_41_60',
  'minor_surgery',
  'bmi_gt_25',
  'swollen_legs',
  'varicose_veins',
  'pregnancy_postpartum',
  'unexplained_stillborn',
  'oral_contraceptives_hrt',
  'sepsis_lt_1mo',
  'serious_lung_disease',
  'abnormal_pfts',
  'acute_mi',
  'chf',
  'ibd',
  'bed_confined_medical',
] as const;

/** 2-point Caprini risk factors */
export const CAPRINI_2PT_FACTORS = [
  'age_61_74',
  'arthroscopic_surgery',
  'major_open_surgery_gt_45min',
  'malignancy',
  'confined_bed_gt_72h',
  'plaster_cast',
  'central_venous_access',
] as const;

/** 3-point Caprini risk factors */
export const CAPRINI_3PT_FACTORS = [
  'age_gte_75',
  'history_vte',
  'family_history_vte',
  'factor_v_leiden',
  'prothrombin_20210a',
  'lupus_anticoagulant',
  'anticardiolipin_antibodies',
  'elevated_homocysteine',
  'hit',
  'other_thrombophilia',
] as const;

/** 5-point Caprini risk factors */
export const CAPRINI_5PT_FACTORS = [
  'stroke_lt_1mo',
  'elective_arthroplasty',
  'hip_pelvis_leg_fracture',
  'acute_spinal_cord_injury_lt_1mo',
] as const;

export type CapriniFactorKey =
  | (typeof CAPRINI_1PT_FACTORS)[number]
  | (typeof CAPRINI_2PT_FACTORS)[number]
  | (typeof CAPRINI_3PT_FACTORS)[number]
  | (typeof CAPRINI_5PT_FACTORS)[number];

// ---------------------------------------------------------------------------
// Caprini factor labels (bilingual)
// ---------------------------------------------------------------------------

const CAPRINI_FACTOR_LABELS: Record<CapriniFactorKey, { en: string; ar: string; points: number }> = {
  // 1-point
  age_41_60: { en: 'Age 41-60', ar: 'العمر 41-60', points: 1 },
  minor_surgery: { en: 'Minor surgery', ar: 'جراحة صغيرة', points: 1 },
  bmi_gt_25: { en: 'BMI > 25', ar: 'مؤشر كتلة الجسم > 25', points: 1 },
  swollen_legs: { en: 'Swollen legs (current)', ar: 'تورم الساقين (حالي)', points: 1 },
  varicose_veins: { en: 'Varicose veins', ar: 'دوالي الأوردة', points: 1 },
  pregnancy_postpartum: { en: 'Pregnancy or postpartum', ar: 'حمل أو ما بعد الولادة', points: 1 },
  unexplained_stillborn: { en: 'History of unexplained stillborn', ar: 'تاريخ ولادة ميتة غير مبررة', points: 1 },
  oral_contraceptives_hrt: { en: 'Oral contraceptives or HRT', ar: 'موانع حمل فموية أو علاج هرموني بديل', points: 1 },
  sepsis_lt_1mo: { en: 'Sepsis (< 1 month)', ar: 'إنتان (< شهر)', points: 1 },
  serious_lung_disease: { en: 'Serious lung disease (inc. pneumonia < 1 month)', ar: 'مرض رئوي خطير (يشمل التهاب رئوي < شهر)', points: 1 },
  abnormal_pfts: { en: 'Abnormal pulmonary function tests', ar: 'اختبارات وظائف رئة غير طبيعية', points: 1 },
  acute_mi: { en: 'Acute myocardial infarction', ar: 'احتشاء عضلة القلب الحاد', points: 1 },
  chf: { en: 'Congestive heart failure', ar: 'قصور القلب الاحتقاني', points: 1 },
  ibd: { en: 'Inflammatory bowel disease', ar: 'مرض التهاب الأمعاء', points: 1 },
  bed_confined_medical: { en: 'Medical patient currently at bed rest', ar: 'مريض طبي حالياً طريح الفراش', points: 1 },

  // 2-point
  age_61_74: { en: 'Age 61-74', ar: 'العمر 61-74', points: 2 },
  arthroscopic_surgery: { en: 'Arthroscopic surgery', ar: 'جراحة بالمنظار المفصلي', points: 2 },
  major_open_surgery_gt_45min: { en: 'Major open surgery (> 45 min)', ar: 'جراحة مفتوحة كبرى (> 45 دقيقة)', points: 2 },
  malignancy: { en: 'Malignancy (present or previous)', ar: 'ورم خبيث (حالي أو سابق)', points: 2 },
  confined_bed_gt_72h: { en: 'Confined to bed > 72 hours', ar: 'طريح الفراش > 72 ساعة', points: 2 },
  plaster_cast: { en: 'Immobilizing plaster cast', ar: 'جبس تثبيت', points: 2 },
  central_venous_access: { en: 'Central venous access', ar: 'قسطرة وريدية مركزية', points: 2 },

  // 3-point
  age_gte_75: { en: 'Age >= 75', ar: 'العمر >= 75', points: 3 },
  history_vte: { en: 'History of DVT/PE', ar: 'تاريخ خثار وريدي عميق/انسداد رئوي', points: 3 },
  family_history_vte: { en: 'Family history of VTE', ar: 'تاريخ عائلي للخثار الوريدي', points: 3 },
  factor_v_leiden: { en: 'Factor V Leiden', ar: 'عامل V لايدن', points: 3 },
  prothrombin_20210a: { en: 'Prothrombin 20210A', ar: 'بروثرومبين 20210A', points: 3 },
  lupus_anticoagulant: { en: 'Lupus anticoagulant', ar: 'مضاد التخثر الذئبي', points: 3 },
  anticardiolipin_antibodies: { en: 'Anticardiolipin antibodies', ar: 'أجسام مضادة للكارديوليبين', points: 3 },
  elevated_homocysteine: { en: 'Elevated serum homocysteine', ar: 'ارتفاع الهوموسيستين في الدم', points: 3 },
  hit: { en: 'Heparin-induced thrombocytopenia (HIT)', ar: 'نقص الصفيحات المحدث بالهيبارين (HIT)', points: 3 },
  other_thrombophilia: { en: 'Other congenital or acquired thrombophilia', ar: 'أهبة تخثر وراثية أو مكتسبة أخرى', points: 3 },

  // 5-point
  stroke_lt_1mo: { en: 'Stroke (< 1 month)', ar: 'سكتة دماغية (< شهر)', points: 5 },
  elective_arthroplasty: { en: 'Elective major lower extremity arthroplasty', ar: 'تبديل مفصل كبير اختياري للطرف السفلي', points: 5 },
  hip_pelvis_leg_fracture: { en: 'Hip, pelvis, or leg fracture', ar: 'كسر في الورك أو الحوض أو الساق', points: 5 },
  acute_spinal_cord_injury_lt_1mo: { en: 'Acute spinal cord injury (< 1 month)', ar: 'إصابة حادة في النخاع الشوكي (< شهر)', points: 5 },
};

// ---------------------------------------------------------------------------
// Padua factor labels (bilingual)
// ---------------------------------------------------------------------------

interface PaduaFactorDef {
  key: string;
  en: string;
  ar: string;
  points: number;
}

const PADUA_FACTORS: PaduaFactorDef[] = [
  { key: 'activeCancer', en: 'Active cancer', ar: 'ورم خبيث نشط', points: 3 },
  { key: 'previousVte', en: 'Previous VTE (excluding superficial vein thrombosis)', ar: 'خثار وريدي سابق (باستثناء خثار الوريد السطحي)', points: 3 },
  { key: 'reducedMobility', en: 'Reduced mobility (>= 3 days bed rest)', ar: 'انخفاض الحركة (>= 3 أيام راحة بالسرير)', points: 3 },
  { key: 'thrombophilicCondition', en: 'Already known thrombophilic condition', ar: 'حالة أهبة تخثر معروفة مسبقاً', points: 3 },
  { key: 'recentTraumaSurgery', en: 'Recent (<= 1 month) trauma and/or surgery', ar: 'إصابة و/أو جراحة حديثة (<= شهر)', points: 2 },
  { key: 'age', en: 'Age >= 70 years', ar: 'العمر >= 70 سنة', points: 1 },
  { key: 'heartRespiratoryFailure', en: 'Heart and/or respiratory failure', ar: 'قصور قلبي و/أو تنفسي', points: 1 },
  { key: 'acuteMiStroke', en: 'Acute MI or ischemic stroke', ar: 'احتشاء حاد أو سكتة إقفارية', points: 1 },
  { key: 'acuteInfection', en: 'Acute infection and/or rheumatologic disorder', ar: 'عدوى حادة و/أو اضطراب روماتيزمي', points: 1 },
  { key: 'obesity', en: 'Obesity (BMI >= 30)', ar: 'سمنة (مؤشر كتلة الجسم >= 30)', points: 1 },
  { key: 'ongoingHormones', en: 'Ongoing hormonal treatment', ar: 'علاج هرموني مستمر', points: 1 },
];

// ---------------------------------------------------------------------------
// Input / Output Types
// ---------------------------------------------------------------------------

export interface VteRiskInput {
  // Padua factors
  activeCancer: boolean;
  previousVte: boolean;
  reducedMobility: boolean;
  thrombophilicCondition: boolean;
  recentTraumaSurgery: boolean;
  age: number;
  heartRespiratoryFailure: boolean;
  acuteMiStroke: boolean;
  acuteInfection: boolean;
  bmi: number;
  ongoingHormones: boolean;

  // Bleeding risk
  activeBleeding: boolean;
  plateletCount?: number;
  gfr?: number;
  recentIntracranialHemorrhage: boolean;
  epiduralCatheter: boolean;

  // Patient type determines which scoring model
  patientType: 'medical' | 'surgical';

  // Caprini additional factors (only evaluated for surgical patients)
  capriniFactors?: Partial<Record<CapriniFactorKey, boolean>>;
}

export type VteRiskLevel = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH';

export interface VteRiskResult {
  score: number;
  scoreName: string; // 'Padua Prediction Score' or 'Caprini Score'
  riskLevel: VteRiskLevel;
  prophylaxisRecommendation: string;
  prophylaxisRecommendationAr: string;
  bleedingContraindications: string[];
  bleedingContraindicationsAr: string[];
  canReceivePharmacological: boolean;
  recommendations: string[];
  recommendationsAr: string[];
  riskFactorsPresent: { factor: string; factorAr: string; points: number }[];
}

// ---------------------------------------------------------------------------
// Padua Score Calculator (Medical Patients)
// ---------------------------------------------------------------------------

function calculatePaduaScore(input: VteRiskInput): {
  score: number;
  riskFactorsPresent: VteRiskResult['riskFactorsPresent'];
} {
  const riskFactorsPresent: VteRiskResult['riskFactorsPresent'] = [];
  let score = 0;

  const boolFactors: Record<string, boolean> = {
    activeCancer: input.activeCancer,
    previousVte: input.previousVte,
    reducedMobility: input.reducedMobility,
    thrombophilicCondition: input.thrombophilicCondition,
    recentTraumaSurgery: input.recentTraumaSurgery,
    heartRespiratoryFailure: input.heartRespiratoryFailure,
    acuteMiStroke: input.acuteMiStroke,
    acuteInfection: input.acuteInfection,
    ongoingHormones: input.ongoingHormones,
  };

  for (const def of PADUA_FACTORS) {
    let met = false;

    if (def.key === 'age') {
      met = input.age >= 70;
    } else if (def.key === 'obesity') {
      met = input.bmi >= 30;
    } else {
      met = boolFactors[def.key] ?? false;
    }

    if (met) {
      score += def.points;
      riskFactorsPresent.push({
        factor: def.en,
        factorAr: def.ar,
        points: def.points,
      });
    }
  }

  return { score, riskFactorsPresent };
}

function paduaRiskLevel(score: number): VteRiskLevel {
  // Padua: < 4 = Low risk, >= 4 = High risk
  // We map to 4-tier for consistency
  if (score >= 4) return 'HIGH';
  if (score >= 3) return 'MODERATE';
  if (score >= 1) return 'LOW';
  return 'VERY_LOW';
}

// ---------------------------------------------------------------------------
// Caprini Score Calculator (Surgical Patients)
// ---------------------------------------------------------------------------

function calculateCapriniScore(input: VteRiskInput): {
  score: number;
  riskFactorsPresent: VteRiskResult['riskFactorsPresent'];
} {
  const riskFactorsPresent: VteRiskResult['riskFactorsPresent'] = [];
  let score = 0;
  const factors = input.capriniFactors ?? {};

  // Auto-derive age-based factors from input.age if not explicitly set
  const effectiveFactors: Partial<Record<CapriniFactorKey, boolean>> = { ...factors };

  // Auto-set age-bracket factors based on patient age
  if (input.age >= 75 && effectiveFactors.age_gte_75 === undefined) {
    effectiveFactors.age_gte_75 = true;
  } else if (input.age >= 61 && input.age <= 74 && effectiveFactors.age_61_74 === undefined) {
    effectiveFactors.age_61_74 = true;
  } else if (input.age >= 41 && input.age <= 60 && effectiveFactors.age_41_60 === undefined) {
    effectiveFactors.age_41_60 = true;
  }

  // Auto-set BMI-related factor
  if (input.bmi > 25 && effectiveFactors.bmi_gt_25 === undefined) {
    effectiveFactors.bmi_gt_25 = true;
  }

  // Auto-set cancer factor
  if (input.activeCancer && effectiveFactors.malignancy === undefined) {
    effectiveFactors.malignancy = true;
  }

  // Auto-set VTE history
  if (input.previousVte && effectiveFactors.history_vte === undefined) {
    effectiveFactors.history_vte = true;
  }

  // Auto-set thrombophilia
  if (input.thrombophilicCondition && effectiveFactors.other_thrombophilia === undefined) {
    effectiveFactors.other_thrombophilia = true;
  }

  // Score all factor groups
  const allFactorGroups: { factors: readonly CapriniFactorKey[]; points: number }[] = [
    { factors: CAPRINI_1PT_FACTORS, points: 1 },
    { factors: CAPRINI_2PT_FACTORS, points: 2 },
    { factors: CAPRINI_3PT_FACTORS, points: 3 },
    { factors: CAPRINI_5PT_FACTORS, points: 5 },
  ];

  for (const group of allFactorGroups) {
    for (const key of group.factors) {
      if (effectiveFactors[key]) {
        const label = CAPRINI_FACTOR_LABELS[key];
        score += group.points;
        riskFactorsPresent.push({
          factor: label.en,
          factorAr: label.ar,
          points: group.points,
        });
      }
    }
  }

  return { score, riskFactorsPresent };
}

function capriniRiskLevel(score: number): VteRiskLevel {
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MODERATE';
  if (score === 2) return 'LOW';
  return 'VERY_LOW'; // 0-1
}

// ---------------------------------------------------------------------------
// Bleeding Contraindication Check
// ---------------------------------------------------------------------------

function checkBleedingContraindications(input: VteRiskInput): {
  contraindications: string[];
  contraindicationsAr: string[];
  canReceivePharmacological: boolean;
} {
  const contraindications: string[] = [];
  const contraindicationsAr: string[] = [];

  if (input.activeBleeding) {
    contraindications.push('Active bleeding');
    contraindicationsAr.push('نزيف نشط');
  }

  if (input.plateletCount != null && input.plateletCount < 50000) {
    contraindications.push(`Platelet count < 50,000/\u00B5L (value: ${input.plateletCount.toLocaleString()})`);
    contraindicationsAr.push(`الصفيحات < 50,000/\u00B5L (القيمة: ${input.plateletCount.toLocaleString()})`);
  }

  if (input.gfr != null && input.gfr < 30) {
    contraindications.push(`Severe renal impairment — GFR < 30 mL/min (value: ${input.gfr}) — dose-adjust or avoid enoxaparin`);
    contraindicationsAr.push(`قصور كلوي شديد — معدل الترشيح الكبيبي < 30 مل/دقيقة (القيمة: ${input.gfr}) — تعديل الجرعة أو تجنب إينوكسابارين`);
  }

  if (input.recentIntracranialHemorrhage) {
    contraindications.push('Recent intracranial hemorrhage');
    contraindicationsAr.push('نزيف داخل القحف حديث');
  }

  if (input.epiduralCatheter) {
    contraindications.push('Epidural/spinal catheter in situ — risk of epidural hematoma');
    contraindicationsAr.push('قسطرة فوق الجافية/شوكية موضوعة — خطر ورم دموي فوق الجافية');
  }

  const canReceivePharmacological = contraindications.length === 0;

  return { contraindications, contraindicationsAr, canReceivePharmacological };
}

// ---------------------------------------------------------------------------
// Prophylaxis Recommendations
// ---------------------------------------------------------------------------

interface ProphylaxisText {
  en: string;
  ar: string;
}

function getPaduaProphylaxis(riskLevel: VteRiskLevel, canPharmaco: boolean): ProphylaxisText {
  if (riskLevel === 'HIGH') {
    if (canPharmaco) {
      return {
        en: 'Pharmacological prophylaxis recommended (e.g., enoxaparin 40mg SC daily or UFH 5000 units SC BID/TID). Continue throughout hospitalization. Add mechanical prophylaxis (IPC) if feasible.',
        ar: 'الوقاية الدوائية موصى بها (مثال: إينوكسابارين 40 ملغ تحت الجلد يومياً أو هيبارين غير مجزأ 5000 وحدة تحت الجلد مرتين/ثلاث مرات يومياً). الاستمرار طوال فترة الإقامة. إضافة وقاية ميكانيكية (IPC) إن أمكن.',
      };
    }
    return {
      en: 'Pharmacological prophylaxis contraindicated due to bleeding risk. Use MECHANICAL prophylaxis only: intermittent pneumatic compression (IPC) and/or graduated compression stockings (GCS). Reassess bleeding risk daily.',
      ar: 'الوقاية الدوائية ممنوعة بسبب خطر النزيف. استخدام الوقاية الميكانيكية فقط: ضغط هوائي متقطع (IPC) و/أو جوارب ضاغطة متدرجة (GCS). إعادة تقييم خطر النزيف يومياً.',
    };
  }
  if (riskLevel === 'MODERATE') {
    return {
      en: 'Consider pharmacological prophylaxis based on individual risk-benefit assessment. Mechanical prophylaxis (IPC/GCS) recommended.',
      ar: 'النظر في الوقاية الدوائية بناءً على تقييم المخاطر والفوائد الفردية. الوقاية الميكانيكية (IPC/GCS) موصى بها.',
    };
  }
  return {
    en: 'Low risk — encourage early ambulation. No routine pharmacological prophylaxis required.',
    ar: 'خطر منخفض — تشجيع المشي المبكر. لا تحتاج لوقاية دوائية روتينية.',
  };
}

function getCapriniProphylaxis(riskLevel: VteRiskLevel, canPharmaco: boolean): ProphylaxisText {
  switch (riskLevel) {
    case 'HIGH':
      if (canPharmaco) {
        return {
          en: 'Pharmacological prophylaxis (LMWH or UFH) PLUS mechanical prophylaxis (IPC + GCS). Consider extended prophylaxis (up to 4 weeks post-discharge for major cancer surgery or hip/knee arthroplasty).',
          ar: 'وقاية دوائية (LMWH أو UFH) بالإضافة للوقاية الميكانيكية (IPC + GCS). النظر في الوقاية الممتدة (حتى 4 أسابيع بعد الخروج لجراحات الأورام الكبرى أو تبديل مفصل الورك/الركبة).',
        };
      }
      return {
        en: 'Pharmacological prophylaxis contraindicated. Use mechanical prophylaxis: IPC + GCS. Reassess bleeding risk daily for possible pharmacological initiation.',
        ar: 'الوقاية الدوائية ممنوعة. استخدام الوقاية الميكانيكية: IPC + GCS. إعادة تقييم خطر النزيف يومياً لإمكانية بدء العلاج الدوائي.',
      };
    case 'MODERATE':
      if (canPharmaco) {
        return {
          en: 'Pharmacological prophylaxis (LMWH preferred) PLUS mechanical prophylaxis (IPC/GCS). Duration: throughout hospitalization.',
          ar: 'وقاية دوائية (LMWH مفضل) بالإضافة للوقاية الميكانيكية (IPC/GCS). المدة: طوال فترة الإقامة.',
        };
      }
      return {
        en: 'Pharmacological prophylaxis contraindicated. Use mechanical prophylaxis: IPC and/or GCS.',
        ar: 'الوقاية الدوائية ممنوعة. استخدام الوقاية الميكانيكية: IPC و/أو GCS.',
      };
    case 'LOW':
      return {
        en: 'Mechanical prophylaxis recommended: intermittent pneumatic compression (IPC) or graduated compression stockings (GCS).',
        ar: 'الوقاية الميكانيكية موصى بها: ضغط هوائي متقطع (IPC) أو جوارب ضاغطة متدرجة (GCS).',
      };
    case 'VERY_LOW':
    default:
      return {
        en: 'Very low risk — early ambulation encouraged. No specific thromboprophylaxis recommended.',
        ar: 'خطر منخفض جداً — تشجيع المشي المبكر. لا تحتاج لوقاية من الخثار.',
      };
  }
}

// ---------------------------------------------------------------------------
// Main Assessment Function
// ---------------------------------------------------------------------------

export function assessVteRisk(input: VteRiskInput): VteRiskResult {
  const isMedical = input.patientType === 'medical';

  // Calculate the appropriate score
  const { score, riskFactorsPresent } = isMedical
    ? calculatePaduaScore(input)
    : calculateCapriniScore(input);

  const riskLevel = isMedical ? paduaRiskLevel(score) : capriniRiskLevel(score);
  const scoreName = isMedical ? 'Padua Prediction Score' : 'Caprini Score';

  // Bleeding risk check
  const { contraindications, contraindicationsAr, canReceivePharmacological } =
    checkBleedingContraindications(input);

  // Prophylaxis recommendation
  const prophylaxis = isMedical
    ? getPaduaProphylaxis(riskLevel, canReceivePharmacological)
    : getCapriniProphylaxis(riskLevel, canReceivePharmacological);

  // General recommendations
  const recommendations: string[] = [];
  const recommendationsAr: string[] = [];

  // Score-specific recommendations
  if (riskLevel === 'HIGH') {
    recommendations.push(
      'Document VTE risk assessment in medical record',
      'Initiate prophylaxis within 24 hours of admission',
      'Reassess VTE and bleeding risk daily',
      'Ensure patient/family education on VTE signs and symptoms',
      'Consider pharmacist review for appropriate dosing',
    );
    recommendationsAr.push(
      'توثيق تقييم خطر الخثار الوريدي في السجل الطبي',
      'بدء الوقاية خلال 24 ساعة من القبول',
      'إعادة تقييم خطر الخثار والنزيف يومياً',
      'ضمان تثقيف المريض/العائلة عن علامات وأعراض الخثار الوريدي',
      'النظر في مراجعة الصيدلي للجرعات المناسبة',
    );
  } else if (riskLevel === 'MODERATE') {
    recommendations.push(
      'Document VTE risk assessment in medical record',
      'Initiate appropriate prophylaxis',
      'Reassess risk if clinical status changes',
      'Encourage early mobilization when safe',
    );
    recommendationsAr.push(
      'توثيق تقييم خطر الخثار الوريدي في السجل الطبي',
      'بدء الوقاية المناسبة',
      'إعادة تقييم الخطر إذا تغيرت الحالة السريرية',
      'تشجيع الحركة المبكرة عندما يكون ذلك آمناً',
    );
  } else if (riskLevel === 'LOW') {
    recommendations.push(
      'Early and frequent ambulation',
      'Adequate hydration',
      'Consider mechanical prophylaxis for immobile periods',
      'Reassess if risk factors change',
    );
    recommendationsAr.push(
      'المشي المبكر والمتكرر',
      'ترطيب كافٍ',
      'النظر في الوقاية الميكانيكية خلال فترات عدم الحركة',
      'إعادة التقييم إذا تغيرت عوامل الخطر',
    );
  } else {
    recommendations.push(
      'Early ambulation',
      'Adequate hydration',
      'No routine prophylaxis needed',
    );
    recommendationsAr.push(
      'المشي المبكر',
      'ترطيب كافٍ',
      'لا تحتاج لوقاية روتينية',
    );
  }

  // If bleeding contraindications present, add advisory
  if (!canReceivePharmacological && (riskLevel === 'HIGH' || riskLevel === 'MODERATE')) {
    recommendations.push(
      'IMPORTANT: Pharmacological prophylaxis is contraindicated — use mechanical methods only',
      'Reassess bleeding risk daily for possible pharmacological prophylaxis initiation',
    );
    recommendationsAr.push(
      'مهم: الوقاية الدوائية ممنوعة — استخدام الوسائل الميكانيكية فقط',
      'إعادة تقييم خطر النزيف يومياً لإمكانية بدء الوقاية الدوائية',
    );
  }

  // Surgical-specific extended prophylaxis note
  if (!isMedical && riskLevel === 'HIGH' && canReceivePharmacological) {
    const hasArthroplasty =
      input.capriniFactors?.elective_arthroplasty ||
      input.capriniFactors?.hip_pelvis_leg_fracture;
    const hasCancer = input.activeCancer || input.capriniFactors?.malignancy;

    if (hasArthroplasty || hasCancer) {
      recommendations.push(
        'Consider extended-duration prophylaxis (up to 35 days post-surgery) per ACCP guidelines',
      );
      recommendationsAr.push(
        'النظر في الوقاية الممتدة (حتى 35 يوماً بعد الجراحة) حسب إرشادات ACCP',
      );
    }
  }

  return {
    score,
    scoreName,
    riskLevel,
    prophylaxisRecommendation: prophylaxis.en,
    prophylaxisRecommendationAr: prophylaxis.ar,
    bleedingContraindications: contraindications,
    bleedingContraindicationsAr: contraindicationsAr,
    canReceivePharmacological,
    recommendations,
    recommendationsAr,
    riskFactorsPresent,
  };
}

// ---------------------------------------------------------------------------
// UI Config Export
// ---------------------------------------------------------------------------

export const VTE_RISK_CFG: Record<
  VteRiskLevel,
  { bg: string; text: string; border: string; labelEn: string; labelAr: string }
> = {
  VERY_LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', labelEn: 'Very Low', labelAr: 'منخفض جداً' },
  LOW: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', labelEn: 'Low', labelAr: 'منخفض' },
  MODERATE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', labelEn: 'Moderate', labelAr: 'متوسط' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', labelEn: 'High', labelAr: 'مرتفع' },
};

export const OVERALL_RISK_CFG: Record<
  VteRiskLevel,
  { icon: string; colorClass: string }
> = {
  VERY_LOW: { icon: 'check-circle', colorClass: 'text-emerald-600' },
  LOW: { icon: 'info', colorClass: 'text-sky-600' },
  MODERATE: { icon: 'alert-triangle', colorClass: 'text-amber-600' },
  HIGH: { icon: 'alert-octagon', colorClass: 'text-red-600' },
};
