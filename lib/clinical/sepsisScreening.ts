/**
 * Sepsis Screening Tool — Comprehensive Clinical Decision Support
 *
 * Implements THREE validated scoring systems:
 * 1. qSOFA (Quick Sequential Organ Failure Assessment) — Singer et al., JAMA 2016
 * 2. SIRS (Systemic Inflammatory Response Syndrome) — ACCP/SCCM Consensus 1992
 * 3. NEWS2 (National Early Warning Score 2) — Royal College of Physicians UK 2017
 *
 * Combined risk stratification with Surviving Sepsis Campaign (SSC) guided
 * clinical response recommendations.
 */

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

export type SepsisRisk = 'NEGATIVE' | 'POSSIBLE' | 'PROBABLE' | 'SEPSIS_ALERT';

/** Legacy input — used by the existing SepsisScreening component */
export interface SepsisInput {
  sbp?: number | null;
  rr?: number | null;
  gcsScore?: number | null;
  temp?: number | null;
  hr?: number | null;
  wbc?: number | null;
  lactate?: number | null;
  suspectedInfection: boolean;
}

export interface SepsisCriterion {
  id: string;
  met: boolean;
  labelAr: string;
  labelEn: string;
}

export interface SepsisResult {
  risk: SepsisRisk;
  qsofaScore: number;
  sirsScore: number;
  qsofaCriteria: SepsisCriterion[];
  sirsCriteria: SepsisCriterion[];
  recommendations: { labelAr: string; labelEn: string }[];
}

export const DEFAULT_SEPSIS_INPUT: SepsisInput = {
  suspectedInfection: false,
};

// ---------------------------------------------------------------------------
// Comprehensive Screening Types (new API)
// ---------------------------------------------------------------------------

export type ConsciousnessLevelSepsis = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';

export interface SepsisScreeningInput {
  respiratoryRate: number;
  systolicBP: number;
  heartRate: number;
  temperature: number; // Celsius
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  consciousnessLevel: ConsciousnessLevelSepsis;
  gcs?: number;
  wbc?: number; // x10^3/uL
  bandPercentage?: number;
  paco2?: number; // mmHg
  lactate?: number; // mmol/L
}

export type NEWS2RiskLevel = 'low' | 'low-medium' | 'medium' | 'high';
export type OverallSepsisRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface SepsisScreeningResult {
  qsofa: {
    score: number;
    criteria: string[];
    criteriaAr: string[];
    positive: boolean;
  };
  sirs: {
    score: number;
    criteria: string[];
    criteriaAr: string[];
    positive: boolean;
  };
  news2: {
    score: number;
    riskLevel: NEWS2RiskLevel;
    clinicalResponse: string;
    clinicalResponseAr: string;
    parameterScores: { parameter: string; parameterAr: string; value: number | string; score: number }[];
  };
  overallRisk: OverallSepsisRisk;
  recommendations: string[];
  recommendationsAr: string[];
  alerts: { severity: 'CRITICAL' | 'WARNING' | 'INFO'; message: string; messageAr: string }[];
}

// ---------------------------------------------------------------------------
// Legacy screenSepsis (backward-compat — used by components/nursing/SepsisScreening.tsx)
// ---------------------------------------------------------------------------

export function screenSepsis(input: SepsisInput): SepsisResult {
  const qsofaCriteria: SepsisCriterion[] = [
    {
      id: 'sbp',
      met: input.sbp != null && input.sbp <= 100,
      labelAr: 'ضغط انقباضي \u2264100 mmHg',
      labelEn: 'Systolic BP \u2264100 mmHg',
    },
    {
      id: 'rr',
      met: input.rr != null && input.rr >= 22,
      labelAr: 'معدل تنفس \u226522/min',
      labelEn: 'Respiratory rate \u226522/min',
    },
    {
      id: 'gcs',
      met: input.gcsScore != null && input.gcsScore < 15,
      labelAr: 'تغير مستوى الوعي (GCS <15)',
      labelEn: 'Altered mental status (GCS <15)',
    },
  ];

  const sirsCriteria: SepsisCriterion[] = [
    {
      id: 'temp',
      met: input.temp != null && (input.temp > 38.3 || input.temp < 36),
      labelAr: 'حرارة >38.3\u00B0C أو <36\u00B0C',
      labelEn: 'Temperature >38.3\u00B0C or <36\u00B0C',
    },
    {
      id: 'hr',
      met: input.hr != null && input.hr > 90,
      labelAr: 'معدل نبض >90/min',
      labelEn: 'Heart rate >90/min',
    },
    {
      id: 'rr_sirs',
      met: input.rr != null && input.rr > 20,
      labelAr: 'معدل تنفس >20/min',
      labelEn: 'Respiratory rate >20/min',
    },
    {
      id: 'wbc',
      met: input.wbc != null && (input.wbc > 12 || input.wbc < 4),
      labelAr: 'كريات بيضاء >12K أو <4K',
      labelEn: 'WBC >12K or <4K',
    },
  ];

  const qsofaScore = qsofaCriteria.filter((c) => c.met).length;
  const sirsScore = sirsCriteria.filter((c) => c.met).length;

  let risk: SepsisRisk = 'NEGATIVE';
  if (
    input.suspectedInfection &&
    (qsofaScore >= 2 || (sirsScore >= 2 && input.lactate != null && input.lactate > 2))
  ) {
    risk = 'SEPSIS_ALERT';
  } else if (qsofaScore >= 2 || (sirsScore >= 2 && input.suspectedInfection)) {
    risk = 'PROBABLE';
  } else if (qsofaScore >= 1 || sirsScore >= 2) {
    risk = 'POSSIBLE';
  }

  const recommendations: { labelAr: string; labelEn: string }[] = [];
  if (risk === 'SEPSIS_ALERT') {
    recommendations.push(
      { labelAr: 'إبلاغ الطبيب فوراً — بروتوكول الإنتان', labelEn: 'Notify physician STAT — activate Sepsis Protocol' },
      { labelAr: 'سحب مزرعة دم قبل المضادات الحيوية', labelEn: 'Blood cultures BEFORE antibiotics' },
      { labelAr: 'مضاد حيوي واسع الطيف خلال ساعة', labelEn: 'Broad-spectrum antibiotics within 1 hour' },
      { labelAr: 'بدء محاليل وريدية 30mL/kg', labelEn: 'IV fluid bolus 30mL/kg' },
      { labelAr: 'قياس لاكتات', labelEn: 'Measure serum lactate' },
      { labelAr: 'مراقبة كمية البول', labelEn: 'Monitor urine output' },
    );
  } else if (risk === 'PROBABLE') {
    recommendations.push(
      { labelAr: 'إبلاغ الطبيب عاجلاً', labelEn: 'Notify physician urgently' },
      { labelAr: 'سحب مزرعة دم', labelEn: 'Obtain blood cultures' },
      { labelAr: 'مراقبة مستمرة للعلامات الحيوية', labelEn: 'Continuous vital sign monitoring' },
      { labelAr: 'قياس لاكتات', labelEn: 'Check lactate level' },
    );
  } else if (risk === 'POSSIBLE') {
    recommendations.push(
      { labelAr: 'زيادة تكرار المراقبة', labelEn: 'Increase monitoring frequency' },
      { labelAr: 'إعادة الفحص خلال ساعة', labelEn: 'Reassess within 1 hour' },
    );
  }

  return { risk, qsofaScore, sirsScore, qsofaCriteria, sirsCriteria, recommendations };
}

// ---------------------------------------------------------------------------
// UI config (backward compat)
// ---------------------------------------------------------------------------

export const SEPSIS_RISK_CFG: Record<
  SepsisRisk,
  { bg: string; text: string; border: string; labelAr: string; labelEn: string }
> = {
  NEGATIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', labelAr: 'سلبي', labelEn: 'Negative' },
  POSSIBLE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', labelAr: 'محتمل', labelEn: 'Possible' },
  PROBABLE: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', labelAr: 'مرجح', labelEn: 'Probable' },
  SEPSIS_ALERT: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', labelAr: 'تنبيه إنتان!', labelEn: 'SEPSIS ALERT!' },
};

// ---------------------------------------------------------------------------
// NEWS2 Scoring — Royal College of Physicians UK (2017)
// Uses Scale 1 for SpO2 (general population). Scale 2 for COPD patients
// would need a separate flag — this implementation uses Scale 1.
// ---------------------------------------------------------------------------

function news2ScoreRR(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3; // >= 25
}

function news2ScoreSpO2Scale1(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0; // >= 96
}

function news2ScoreSpO2Scale2(spo2: number, onO2: boolean): number {
  if (spo2 <= 83) return 3;
  if (spo2 <= 85) return 2;
  if (spo2 <= 87) return 1;
  if (spo2 <= 92 || (spo2 >= 93 && !onO2)) return 0;
  // On supplemental O2 with higher sats
  if (spo2 <= 94) return 1; // 93-94 on O2
  if (spo2 <= 96) return 2; // 95-96 on O2
  return 3; // >= 97 on O2
}

function news2ScoreAirO2(onO2: boolean): number {
  return onO2 ? 2 : 0;
}

function news2ScoreSBP(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3; // >= 220
}

function news2ScoreHR(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3; // >= 131
}

function news2ScoreConsciousness(level: ConsciousnessLevelSepsis): number {
  // CVPU: Confusion, Voice, Pain, Unresponsive all score 3
  return level === 'alert' ? 0 : 3;
}

function news2ScoreTemp(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2; // >= 39.1
}

function determineNEWS2RiskLevel(totalScore: number, hasSingleParam3: boolean): NEWS2RiskLevel {
  if (totalScore >= 7) return 'high';
  if (totalScore >= 5 || hasSingleParam3) return 'medium';
  if (totalScore >= 1) return 'low-medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// NEWS2 Clinical Response text
// ---------------------------------------------------------------------------

const NEWS2_RESPONSE: Record<NEWS2RiskLevel, { en: string; ar: string }> = {
  low: {
    en: 'Routine monitoring. Minimum every 12 hours.',
    ar: 'مراقبة روتينية. كل 12 ساعة كحد أدنى.',
  },
  'low-medium': {
    en: 'Inform registered nurse. Increase monitoring to every 4-6 hours. Assess if change in clinical condition.',
    ar: 'إبلاغ الممرض المسؤول. زيادة المراقبة إلى كل 4-6 ساعات. تقييم ما إذا كان هناك تغير في الحالة السريرية.',
  },
  medium: {
    en: 'Urgent response. Notify doctor immediately. Increase monitoring to at least hourly. Consider transfer to higher-dependency care.',
    ar: 'استجابة عاجلة. إبلاغ الطبيب فوراً. زيادة المراقبة إلى كل ساعة على الأقل. النظر في النقل لعناية أعلى.',
  },
  high: {
    en: 'Emergency response. Activate Rapid Response Team (RRT). Continuous monitoring. Immediate senior clinician review.',
    ar: 'استجابة طارئة. تفعيل فريق الاستجابة السريعة (RRT). مراقبة مستمرة. مراجعة فورية من طبيب أقدم.',
  },
};

// ---------------------------------------------------------------------------
// Comprehensive Screening — computes all three scores + combined risk
// ---------------------------------------------------------------------------

export function performComprehensiveSepsisScreening(input: SepsisScreeningInput): SepsisScreeningResult {
  // ---- qSOFA ----
  const qsofaCriteria: string[] = [];
  const qsofaCriteriaAr: string[] = [];
  let qsofaScore = 0;

  if (input.respiratoryRate >= 22) {
    qsofaScore++;
    qsofaCriteria.push(`Respiratory rate >= 22/min (value: ${input.respiratoryRate})`);
    qsofaCriteriaAr.push(`معدل التنفس >= 22/دقيقة (القيمة: ${input.respiratoryRate})`);
  }

  const effectiveGCS = input.gcs ?? (input.consciousnessLevel === 'alert' ? 15 : input.consciousnessLevel === 'confused' ? 14 : input.consciousnessLevel === 'voice' ? 10 : input.consciousnessLevel === 'pain' ? 8 : 3);
  if (effectiveGCS < 15) {
    qsofaScore++;
    qsofaCriteria.push(`Altered mentation (GCS ${effectiveGCS} < 15)`);
    qsofaCriteriaAr.push(`تغير مستوى الوعي (GCS ${effectiveGCS} < 15)`);
  }

  if (input.systolicBP <= 100) {
    qsofaScore++;
    qsofaCriteria.push(`Systolic BP <= 100 mmHg (value: ${input.systolicBP})`);
    qsofaCriteriaAr.push(`الضغط الانقباضي <= 100 ملم زئبقي (القيمة: ${input.systolicBP})`);
  }

  const qsofaPositive = qsofaScore >= 2;

  // ---- SIRS ----
  const sirsCriteria: string[] = [];
  const sirsCriteriaAr: string[] = [];
  let sirsScore = 0;

  if (input.temperature > 38 || input.temperature < 36) {
    sirsScore++;
    sirsCriteria.push(`Temperature ${input.temperature > 38 ? '> 38' : '< 36'}\u00B0C (value: ${input.temperature})`);
    sirsCriteriaAr.push(`الحرارة ${input.temperature > 38 ? '> 38' : '< 36'}\u00B0C (القيمة: ${input.temperature})`);
  }

  if (input.heartRate > 90) {
    sirsScore++;
    sirsCriteria.push(`Heart rate > 90/min (value: ${input.heartRate})`);
    sirsCriteriaAr.push(`معدل النبض > 90/دقيقة (القيمة: ${input.heartRate})`);
  }

  if (input.respiratoryRate > 20 || (input.paco2 != null && input.paco2 < 32)) {
    sirsScore++;
    if (input.respiratoryRate > 20) {
      sirsCriteria.push(`Respiratory rate > 20/min (value: ${input.respiratoryRate})`);
      sirsCriteriaAr.push(`معدل التنفس > 20/دقيقة (القيمة: ${input.respiratoryRate})`);
    }
    if (input.paco2 != null && input.paco2 < 32) {
      sirsCriteria.push(`PaCO2 < 32 mmHg (value: ${input.paco2})`);
      sirsCriteriaAr.push(`PaCO2 < 32 ملم زئبقي (القيمة: ${input.paco2})`);
    }
  }

  if (input.wbc != null) {
    const wbcMet =
      input.wbc > 12 ||
      input.wbc < 4 ||
      (input.bandPercentage != null && input.bandPercentage > 10);
    if (wbcMet) {
      sirsScore++;
      const details: string[] = [];
      const detailsAr: string[] = [];
      if (input.wbc > 12) {
        details.push(`WBC > 12,000 (value: ${input.wbc}K)`);
        detailsAr.push(`كريات بيضاء > 12,000 (القيمة: ${input.wbc}K)`);
      }
      if (input.wbc < 4) {
        details.push(`WBC < 4,000 (value: ${input.wbc}K)`);
        detailsAr.push(`كريات بيضاء < 4,000 (القيمة: ${input.wbc}K)`);
      }
      if (input.bandPercentage != null && input.bandPercentage > 10) {
        details.push(`Bands > 10% (value: ${input.bandPercentage}%)`);
        detailsAr.push(`عصابات > 10% (القيمة: ${input.bandPercentage}%)`);
      }
      sirsCriteria.push(...details);
      sirsCriteriaAr.push(...detailsAr);
    }
  }

  const sirsPositive = sirsScore >= 2;

  // ---- NEWS2 ----
  const parameterScores: SepsisScreeningResult['news2']['parameterScores'] = [];
  let news2Total = 0;
  let hasSingleParam3 = false;

  const rrScore = news2ScoreRR(input.respiratoryRate);
  parameterScores.push({ parameter: 'Respiratory Rate', parameterAr: 'معدل التنفس', value: input.respiratoryRate, score: rrScore });
  news2Total += rrScore;
  if (rrScore === 3) hasSingleParam3 = true;

  const spo2Score = news2ScoreSpO2Scale1(input.oxygenSaturation);
  parameterScores.push({ parameter: 'SpO2 (Scale 1)', parameterAr: 'تشبع الأكسجين (مقياس 1)', value: input.oxygenSaturation, score: spo2Score });
  news2Total += spo2Score;
  if (spo2Score === 3) hasSingleParam3 = true;

  const airO2Score = news2ScoreAirO2(input.supplementalOxygen);
  parameterScores.push({ parameter: 'Air/O2', parameterAr: 'هواء/أكسجين', value: input.supplementalOxygen ? 'Supplemental O2' : 'Room Air', score: airO2Score });
  news2Total += airO2Score;

  const sbpScore = news2ScoreSBP(input.systolicBP);
  parameterScores.push({ parameter: 'Systolic BP', parameterAr: 'الضغط الانقباضي', value: input.systolicBP, score: sbpScore });
  news2Total += sbpScore;
  if (sbpScore === 3) hasSingleParam3 = true;

  const hrScore = news2ScoreHR(input.heartRate);
  parameterScores.push({ parameter: 'Heart Rate', parameterAr: 'معدل النبض', value: input.heartRate, score: hrScore });
  news2Total += hrScore;
  if (hrScore === 3) hasSingleParam3 = true;

  const consciousnessScore = news2ScoreConsciousness(input.consciousnessLevel);
  const consciousnessDisplay = input.consciousnessLevel.charAt(0).toUpperCase() + input.consciousnessLevel.slice(1);
  parameterScores.push({ parameter: 'Consciousness', parameterAr: 'مستوى الوعي', value: consciousnessDisplay, score: consciousnessScore });
  news2Total += consciousnessScore;
  if (consciousnessScore === 3) hasSingleParam3 = true;

  const tempScore = news2ScoreTemp(input.temperature);
  parameterScores.push({ parameter: 'Temperature', parameterAr: 'الحرارة', value: input.temperature, score: tempScore });
  news2Total += tempScore;
  if (tempScore === 3) hasSingleParam3 = true;

  const news2RiskLevel = determineNEWS2RiskLevel(news2Total, hasSingleParam3);
  const news2Response = NEWS2_RESPONSE[news2RiskLevel];

  // ---- Overall Risk ----
  const overallRisk = determineOverallRisk(qsofaScore, sirsScore, news2Total, news2RiskLevel, input.lactate);

  // ---- Recommendations ----
  const recommendations: string[] = [];
  const recommendationsAr: string[] = [];

  if (overallRisk === 'CRITICAL') {
    recommendations.push(
      'Immediate senior clinician review',
      'Establish IV access immediately',
      'Blood cultures x2 STAT (before antibiotics)',
      'Serum lactate STAT',
      'Empiric broad-spectrum antibiotics within 1 hour (Surviving Sepsis Campaign)',
      'IV crystalloid fluid bolus 30 mL/kg for hypotension or lactate >= 4 mmol/L',
      'Monitor urine output (target >= 0.5 mL/kg/hr)',
      'Reassess within 1 hour of interventions',
      'Consider ICU/HDU admission',
    );
    recommendationsAr.push(
      'مراجعة فورية من طبيب أقدم',
      'تركيب خط وريدي فوراً',
      'مزرعة دم × 2 فوراً (قبل المضادات الحيوية)',
      'قياس اللاكتات فوراً',
      'مضاد حيوي واسع الطيف خلال ساعة (إرشادات حملة النجاة من الإنتان)',
      'محلول بلوري وريدي 30 مل/كغ لانخفاض الضغط أو اللاكتات >= 4 ملمول/لتر',
      'مراقبة كمية البول (الهدف >= 0.5 مل/كغ/ساعة)',
      'إعادة التقييم خلال ساعة من التدخلات',
      'النظر في القبول بالعناية المركزة/عالية التبعية',
    );
  } else if (overallRisk === 'HIGH') {
    recommendations.push(
      'Urgent medical review required',
      'Obtain blood cultures',
      'Measure serum lactate',
      'Consider empiric antibiotics if infection suspected',
      'Increase vital signs monitoring to at least hourly',
      'Ensure IV access',
      'Consider fluid resuscitation if signs of hypoperfusion',
    );
    recommendationsAr.push(
      'مراجعة طبية عاجلة مطلوبة',
      'سحب مزرعة دم',
      'قياس اللاكتات في الدم',
      'النظر في المضادات الحيوية التجريبية إذا اشتُبه بعدوى',
      'زيادة مراقبة العلامات الحيوية إلى كل ساعة على الأقل',
      'ضمان وجود خط وريدي',
      'النظر في الإنعاش بالسوائل إذا كانت هناك علامات نقص التروية',
    );
  } else if (overallRisk === 'MODERATE') {
    recommendations.push(
      'Increase monitoring frequency to every 1-4 hours',
      'Consider serum lactate measurement',
      'Reassess clinical trajectory within 1 hour',
      'Notify medical team of elevated screening scores',
    );
    recommendationsAr.push(
      'زيادة تكرار المراقبة إلى كل 1-4 ساعات',
      'النظر في قياس اللاكتات في الدم',
      'إعادة تقييم المسار السريري خلال ساعة',
      'إبلاغ الفريق الطبي بارتفاع درجات الفحص',
    );
  } else {
    recommendations.push(
      'Continue routine monitoring per unit protocol',
      'Reassess if clinical condition changes',
    );
    recommendationsAr.push(
      'الاستمرار في المراقبة الروتينية حسب بروتوكول الوحدة',
      'إعادة التقييم إذا تغيرت الحالة السريرية',
    );
  }

  // ---- Alerts ----
  const alerts: SepsisScreeningResult['alerts'] = [];

  if (qsofaPositive) {
    alerts.push({
      severity: 'CRITICAL',
      message: `qSOFA score ${qsofaScore}/3 — High risk for sepsis-related organ dysfunction. Investigate for sepsis immediately.`,
      messageAr: `درجة qSOFA ${qsofaScore}/3 — خطر مرتفع لخلل وظائف الأعضاء المرتبط بالإنتان. التحقيق من الإنتان فوراً.`,
    });
  }

  if (input.lactate != null && input.lactate >= 4) {
    alerts.push({
      severity: 'CRITICAL',
      message: `Lactate ${input.lactate} mmol/L (>= 4) — Suggestive of tissue hypoperfusion / septic shock. Initiate aggressive fluid resuscitation.`,
      messageAr: `اللاكتات ${input.lactate} ملمول/لتر (>= 4) — يشير إلى نقص تروية الأنسجة / صدمة إنتانية. بدء الإنعاش العدواني بالسوائل.`,
    });
  } else if (input.lactate != null && input.lactate >= 2) {
    alerts.push({
      severity: 'WARNING',
      message: `Lactate ${input.lactate} mmol/L (elevated >= 2) — Monitor trend and reassess.`,
      messageAr: `اللاكتات ${input.lactate} ملمول/لتر (مرتفع >= 2) — مراقبة الاتجاه وإعادة التقييم.`,
    });
  }

  if (sirsPositive && qsofaPositive) {
    alerts.push({
      severity: 'CRITICAL',
      message: 'Both SIRS and qSOFA criteria met — strongly consider sepsis and initiate Hour-1 Bundle.',
      messageAr: 'تحققت معايير SIRS و qSOFA معاً — يجب التفكير بقوة في الإنتان وبدء حزمة الساعة الأولى.',
    });
  }

  if (news2RiskLevel === 'high') {
    alerts.push({
      severity: 'CRITICAL',
      message: `NEWS2 score ${news2Total} — High clinical risk. Activate Rapid Response Team.`,
      messageAr: `درجة NEWS2 ${news2Total} — خطر سريري مرتفع. تفعيل فريق الاستجابة السريعة.`,
    });
  } else if (news2RiskLevel === 'medium') {
    alerts.push({
      severity: 'WARNING',
      message: `NEWS2 score ${news2Total} — Medium clinical risk. Urgent clinical review needed.`,
      messageAr: `درجة NEWS2 ${news2Total} — خطر سريري متوسط. مراجعة سريرية عاجلة مطلوبة.`,
    });
  }

  if (input.systolicBP <= 90) {
    alerts.push({
      severity: 'WARNING',
      message: `Systolic BP ${input.systolicBP} mmHg — Hypotension. Assess for shock and consider fluid resuscitation.`,
      messageAr: `الضغط الانقباضي ${input.systolicBP} ملم زئبقي — انخفاض ضغط الدم. تقييم الصدمة والنظر في الإنعاش بالسوائل.`,
    });
  }

  if (input.oxygenSaturation <= 91) {
    alerts.push({
      severity: 'WARNING',
      message: `SpO2 ${input.oxygenSaturation}% — Severe hypoxemia. Assess airway, consider supplemental oxygen.`,
      messageAr: `تشبع الأكسجين ${input.oxygenSaturation}% — نقص أكسجة شديد. تقييم مجرى الهواء، النظر في الأكسجين الإضافي.`,
    });
  }

  if (input.temperature >= 40) {
    alerts.push({
      severity: 'WARNING',
      message: `Temperature ${input.temperature}\u00B0C — Hyperpyrexia. Active cooling measures, blood cultures if not already obtained.`,
      messageAr: `الحرارة ${input.temperature}\u00B0C — ارتفاع حرارة شديد. إجراءات تبريد فعّالة، مزرعة دم إن لم تؤخذ بعد.`,
    });
  }

  return {
    qsofa: {
      score: qsofaScore,
      criteria: qsofaCriteria,
      criteriaAr: qsofaCriteriaAr,
      positive: qsofaPositive,
    },
    sirs: {
      score: sirsScore,
      criteria: sirsCriteria,
      criteriaAr: sirsCriteriaAr,
      positive: sirsPositive,
    },
    news2: {
      score: news2Total,
      riskLevel: news2RiskLevel,
      clinicalResponse: news2Response.en,
      clinicalResponseAr: news2Response.ar,
      parameterScores,
    },
    overallRisk,
    recommendations,
    recommendationsAr,
    alerts,
  };
}

// ---------------------------------------------------------------------------
// Combined risk determination
// ---------------------------------------------------------------------------

function determineOverallRisk(
  qsofaScore: number,
  sirsScore: number,
  news2Score: number,
  news2Risk: NEWS2RiskLevel,
  lactate?: number,
): OverallSepsisRisk {
  // CRITICAL: qSOFA >= 2 with elevated lactate, or NEWS2 high, or qSOFA >= 2 + SIRS >= 2
  if (
    (qsofaScore >= 2 && lactate != null && lactate >= 2) ||
    (qsofaScore >= 2 && sirsScore >= 2) ||
    (news2Risk === 'high' && qsofaScore >= 1) ||
    (lactate != null && lactate >= 4)
  ) {
    return 'CRITICAL';
  }

  // HIGH: qSOFA >= 2 alone, or NEWS2 high, or SIRS >= 2 with elevated lactate
  if (
    qsofaScore >= 2 ||
    news2Risk === 'high' ||
    (sirsScore >= 2 && lactate != null && lactate >= 2) ||
    news2Score >= 7
  ) {
    return 'HIGH';
  }

  // MODERATE: any concerning individual score
  if (
    qsofaScore >= 1 ||
    sirsScore >= 2 ||
    news2Risk === 'medium' ||
    news2Score >= 5
  ) {
    return 'MODERATE';
  }

  return 'LOW';
}

// ---------------------------------------------------------------------------
// Exported helpers for Scale 2 SpO2 (COPD patients)
// ---------------------------------------------------------------------------

export { news2ScoreSpO2Scale2 };
