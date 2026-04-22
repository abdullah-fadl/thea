/**
 * SOFA Score (Sequential Organ Failure Assessment)
 * Based on Vincent et al. 1996 / ICM guidelines
 *
 * 6 organ systems, each scored 0–4.
 * Total 0–24. Used to assess ICU mortality risk.
 */

// ─── Input Types ────────────────────────────────────────────────────────────

export interface SOFAInput {
  /** Respiration: PaO2/FiO2 ratio (mmHg). Pass null if not on ventilator for score ≥3 */
  pfRatio: number | null;
  /** Respiration: is patient mechanically ventilated? */
  onVentilator: boolean;

  /** Coagulation: platelet count ×10³/μL */
  platelets: number | null;

  /** Liver: bilirubin mg/dL */
  bilirubin: number | null;

  /** Cardiovascular */
  cardiovascular: {
    map: number | null;                // Mean arterial pressure mmHg
    vasopressors: CVSOFALevel;         // see enum below
  };

  /** CNS: Glasgow Coma Scale total (3–15) */
  gcs: number | null;

  /** Renal */
  renal: {
    creatinine: number | null;         // mg/dL
    urineOutput24h: number | null;     // mL/24h
  };
}

export type CVSOFALevel =
  | 'none'
  | 'map_low'                          // MAP < 70, no vasopressors
  | 'dopa_low_or_dobu'                 // Dopamine ≤5 or any Dobutamine
  | 'dopa_mid_or_epi_low_or_norepi_low'  // Dopa >5, Epi ≤0.1, Norepi ≤0.1
  | 'dopa_high_or_epi_high_or_norepi_high'; // Dopa >15, Epi >0.1, Norepi >0.1

export interface SOFAResult {
  /** 0–4 per organ */
  respiration: number;
  coagulation: number;
  liver: number;
  cardiovascular: number;
  cns: number;
  renal: number;

  /** Total 0–24 */
  total: number;

  /** Predicted mortality risk band */
  risk: 'low' | 'moderate' | 'high' | 'very_high' | 'critical';
  riskLabel: string;
  riskLabelAr: string;

  /** Approximate mortality % range */
  mortalityRange: string;

  /** Colour for UI badges */
  color: 'green' | 'yellow' | 'orange' | 'red' | 'purple';
}

// ─── Scoring Functions ────────────────────────────────────────────────────

function scoreRespiration(pfRatio: number | null, onVent: boolean): number {
  if (pfRatio === null) return 0;
  if (pfRatio > 400) return 0;
  if (pfRatio > 300) return 1;
  if (pfRatio > 200) return 2;
  // scores 3 and 4 require mechanical ventilation per guidelines
  if (pfRatio > 100) return onVent ? 3 : 2;
  return onVent ? 4 : 2;
}

function scoreCoagulation(platelets: number | null): number {
  if (platelets === null) return 0;
  if (platelets > 150) return 0;
  if (platelets > 100) return 1;
  if (platelets > 50) return 2;
  if (platelets > 20) return 3;
  return 4;
}

function scoreLiver(bilirubin: number | null): number {
  if (bilirubin === null) return 0;
  if (bilirubin < 1.2) return 0;
  if (bilirubin < 2.0) return 1;
  if (bilirubin < 6.0) return 2;
  if (bilirubin < 12.0) return 3;
  return 4;
}

function scoreCardiovascular(cv: SOFAInput['cardiovascular']): number {
  switch (cv.vasopressors) {
    case 'dopa_high_or_epi_high_or_norepi_high': return 4;
    case 'dopa_mid_or_epi_low_or_norepi_low': return 3;
    case 'dopa_low_or_dobu': return 2;
    case 'map_low': return 1;
    case 'none':
    default:
      if (cv.map !== null && cv.map < 70) return 1;
      return 0;
  }
}

function scoreCNS(gcs: number | null): number {
  if (gcs === null) return 0;
  if (gcs === 15) return 0;
  if (gcs >= 13) return 1;
  if (gcs >= 10) return 2;
  if (gcs >= 6) return 3;
  return 4;
}

function scoreRenal(renal: SOFAInput['renal']): number {
  const { creatinine, urineOutput24h } = renal;
  let score = 0;

  // Creatinine-based scoring
  if (creatinine !== null) {
    if (creatinine >= 5.0) score = 4;
    else if (creatinine >= 3.5) score = 3;
    else if (creatinine >= 2.0) score = 2;
    else if (creatinine >= 1.2) score = 1;
  }

  // Urine output can upgrade score
  if (urineOutput24h !== null) {
    let uoScore = 0;
    if (urineOutput24h < 200) uoScore = 4;
    else if (urineOutput24h < 500) uoScore = 3;
    score = Math.max(score, uoScore);
  }

  return score;
}

// ─── Risk Classification ─────────────────────────────────────────────────

function classifyRisk(total: number): Pick<SOFAResult, 'risk' | 'riskLabel' | 'riskLabelAr' | 'mortalityRange' | 'color'> {
  if (total <= 6) {
    return {
      risk: 'low',
      riskLabel: 'Low Risk',
      riskLabelAr: 'خطر منخفض',
      mortalityRange: '<10%',
      color: 'green',
    };
  }
  if (total <= 9) {
    return {
      risk: 'moderate',
      riskLabel: 'Moderate Risk',
      riskLabelAr: 'خطر متوسط',
      mortalityRange: '15–20%',
      color: 'yellow',
    };
  }
  if (total <= 12) {
    return {
      risk: 'high',
      riskLabel: 'High Risk',
      riskLabelAr: 'خطر مرتفع',
      mortalityRange: '40–50%',
      color: 'orange',
    };
  }
  if (total <= 14) {
    return {
      risk: 'very_high',
      riskLabel: 'Very High Risk',
      riskLabelAr: 'خطر مرتفع جداً',
      mortalityRange: '50–60%',
      color: 'red',
    };
  }
  return {
    risk: 'critical',
    riskLabel: 'Critical',
    riskLabelAr: 'حرج',
    mortalityRange: '>80%',
    color: 'purple',
  };
}

// ─── Main Calculator ──────────────────────────────────────────────────────

export function calculateSOFA(input: SOFAInput): SOFAResult {
  const respiration = scoreRespiration(input.pfRatio, input.onVentilator);
  const coagulation = scoreCoagulation(input.platelets);
  const liver = scoreLiver(input.bilirubin);
  const cardiovascular = scoreCardiovascular(input.cardiovascular);
  const cns = scoreCNS(input.gcs);
  const renal = scoreRenal(input.renal);

  const total = respiration + coagulation + liver + cardiovascular + cns + renal;
  const risk = classifyRisk(total);

  return {
    respiration,
    coagulation,
    liver,
    cardiovascular,
    cns,
    renal,
    total,
    ...risk,
  };
}

// ─── Subscore Labels ─────────────────────────────────────────────────────

export const SOFA_SUBSCORE_LABELS: Record<
  keyof Pick<SOFAResult, 'respiration' | 'coagulation' | 'liver' | 'cardiovascular' | 'cns' | 'renal'>,
  { labelEn: string; labelAr: string; unitEn: string; unitAr: string }
> = {
  respiration: { labelEn: 'Respiration', labelAr: 'التنفس', unitEn: 'PaO₂/FiO₂ ratio', unitAr: 'نسبة PaO₂/FiO₂' },
  coagulation: { labelEn: 'Coagulation', labelAr: 'تخثر الدم', unitEn: 'Platelets ×10³/μL', unitAr: 'الصفائح الدموية' },
  liver:        { labelEn: 'Liver', labelAr: 'الكبد', unitEn: 'Bilirubin mg/dL', unitAr: 'البيليروبين' },
  cardiovascular: { labelEn: 'Cardiovascular', labelAr: 'القلب والأوعية', unitEn: 'MAP / vasopressors', unitAr: 'الضغط / ضاغطات الأوعية' },
  cns:          { labelEn: 'CNS', labelAr: 'الجهاز العصبي', unitEn: 'GCS', unitAr: 'مقياس غلاسكو' },
  renal:        { labelEn: 'Renal', labelAr: 'الكلى', unitEn: 'Creatinine / Urine output', unitAr: 'الكرياتينين / البول' },
};

export const CV_SOFA_OPTIONS: { value: CVSOFALevel; labelEn: string; labelAr: string }[] = [
  { value: 'none', labelEn: 'MAP ≥70, no vasopressors', labelAr: 'MAP ≥70، بدون ضاغطات' },
  { value: 'map_low', labelEn: 'MAP <70', labelAr: 'MAP أقل من 70' },
  { value: 'dopa_low_or_dobu', labelEn: 'Dopamine ≤5 or Dobutamine (any)', labelAr: 'دوبامين ≤5 أو دوبوتامين' },
  { value: 'dopa_mid_or_epi_low_or_norepi_low', labelEn: 'Dopamine >5, Epinephrine ≤0.1, or Norepinephrine ≤0.1', labelAr: 'دوبامين >5، أدرينالين ≤0.1، أو نورأدرينالين ≤0.1' },
  { value: 'dopa_high_or_epi_high_or_norepi_high', labelEn: 'Dopamine >15, Epinephrine >0.1, or Norepinephrine >0.1', labelAr: 'دوبامين >15، أدرينالين >0.1، أو نورأدرينالين >0.1' },
];
