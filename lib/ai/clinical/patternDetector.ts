/**
 * Clinical Pattern Detector
 *
 * Rule-based + AI-powered detection of clinical patterns across patient data.
 * The rule-based layer provides instant results; AI adds deeper analysis.
 */

import type { BilingualText, ConfidenceScore } from '../providers/types';
import { buildConfidence } from '../safety/confidence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClinicalPattern {
  name: string;
  description: BilingualText;
  confidence: ConfidenceScore;
  matchedTests: string[];
  suggestedFollowUp: string[];
  severity: 'low' | 'moderate' | 'high';
}

export interface LabDataPoint {
  testCode: string;
  value: number;
  unit: string;
  flag?: string;
}

// ---------------------------------------------------------------------------
// Rule-Based Pattern Definitions
// ---------------------------------------------------------------------------

interface PatternRule {
  name: string;
  description: BilingualText;
  severity: 'low' | 'moderate' | 'high';
  conditions: {
    testCode: string;
    check: 'low' | 'high' | 'critical_low' | 'critical_high';
    /** Threshold — if check is 'low', value must be below this */
    threshold?: number;
  }[];
  /** Minimum conditions that must match (default: all) */
  minMatch?: number;
  suggestedFollowUp: string[];
}

const PATTERN_RULES: PatternRule[] = [
  {
    name: 'Iron Deficiency Anemia',
    description: {
      ar: 'نمط يشير إلى فقر الدم بسبب نقص الحديد — انخفاض الهيموجلوبين مع صغر حجم الكريات وانخفاض الحديد',
      en: 'Pattern suggestive of iron deficiency anemia — low hemoglobin with microcytosis and low iron markers',
    },
    severity: 'moderate',
    conditions: [
      { testCode: 'HGB', check: 'low', threshold: 12 },
      { testCode: 'MCV', check: 'low', threshold: 80 },
      { testCode: 'FERRITIN', check: 'low', threshold: 30 },
      { testCode: 'TIBC', check: 'high', threshold: 400 },
    ],
    minMatch: 3,
    suggestedFollowUp: ['Iron studies', 'Reticulocyte count', 'Peripheral blood smear'],
  },
  {
    name: 'Diabetic Ketoacidosis (DKA)',
    description: {
      ar: 'نمط يشير إلى حماض كيتوني سكري — ارتفاع السكر مع حماض استقلابي',
      en: 'Pattern suggestive of diabetic ketoacidosis — hyperglycemia with metabolic acidosis',
    },
    severity: 'high',
    conditions: [
      { testCode: 'GLU', check: 'high', threshold: 250 },
      { testCode: 'CO2', check: 'low', threshold: 18 },
      { testCode: 'PH', check: 'low', threshold: 7.3 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['ABG', 'Serum ketones', 'Anion gap', 'Serum osmolality'],
  },
  {
    name: 'Acute Kidney Injury',
    description: {
      ar: 'نمط يشير إلى إصابة كلوية حادة — ارتفاع الكرياتينين واليوريا',
      en: 'Pattern suggestive of acute kidney injury — rising creatinine and BUN',
    },
    severity: 'high',
    conditions: [
      { testCode: 'CREAT', check: 'high', threshold: 1.3 },
      { testCode: 'BUN', check: 'high', threshold: 20 },
      { testCode: 'K', check: 'high', threshold: 5.0 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['Urinalysis', 'Urine electrolytes', 'Renal ultrasound', 'Urine output monitoring'],
  },
  {
    name: 'Liver Injury / Hepatocellular Pattern',
    description: {
      ar: 'نمط يشير إلى إصابة كبدية — ارتفاع إنزيمات الكبد',
      en: 'Pattern suggestive of hepatocellular injury — elevated liver enzymes',
    },
    severity: 'moderate',
    conditions: [
      { testCode: 'ALT', check: 'high', threshold: 40 },
      { testCode: 'AST', check: 'high', threshold: 40 },
      { testCode: 'TBIL', check: 'high', threshold: 1.2 },
      { testCode: 'ALB', check: 'low', threshold: 3.5 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['Hepatitis panel', 'INR/PT', 'Liver ultrasound', 'GGT', 'ALP'],
  },
  {
    name: 'Sepsis Markers',
    description: {
      ar: 'نمط يشير إلى إنتان — ارتفاع مؤشرات الالتهاب مع علامات سريرية',
      en: 'Pattern suggestive of sepsis — elevated inflammatory markers',
    },
    severity: 'high',
    conditions: [
      { testCode: 'WBC', check: 'high', threshold: 12 },
      { testCode: 'CRP', check: 'high', threshold: 10 },
      { testCode: 'PCT', check: 'high', threshold: 0.5 },
      { testCode: 'LACTATE', check: 'high', threshold: 2.0 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['Blood cultures', 'Procalcitonin trend', 'Lactate trend', 'qSOFA score'],
  },
  {
    name: 'Thyroid Dysfunction — Hypothyroidism',
    description: {
      ar: 'نمط يشير إلى قصور الغدة الدرقية — ارتفاع TSH مع انخفاض T4',
      en: 'Pattern suggestive of hypothyroidism — elevated TSH with low T4',
    },
    severity: 'low',
    conditions: [
      { testCode: 'TSH', check: 'high', threshold: 4.5 },
      { testCode: 'FT4', check: 'low', threshold: 0.8 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['Anti-TPO antibodies', 'Free T3', 'Thyroid ultrasound'],
  },
  {
    name: 'Coagulation Disorder',
    description: {
      ar: 'نمط يشير إلى اضطراب تخثر — ارتفاع PT/INR مع تغيرات aPTT',
      en: 'Pattern suggestive of coagulation disorder — prolonged PT/INR with aPTT changes',
    },
    severity: 'moderate',
    conditions: [
      { testCode: 'INR', check: 'high', threshold: 1.5 },
      { testCode: 'PT', check: 'high', threshold: 14 },
      { testCode: 'APTT', check: 'high', threshold: 40 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['Fibrinogen', 'D-dimer', 'Mixing studies', 'Factor levels'],
  },
  {
    name: 'Metabolic Syndrome Markers',
    description: {
      ar: 'نمط يشير إلى متلازمة أيضية — ارتفاع السكر والدهون',
      en: 'Pattern suggestive of metabolic syndrome — elevated glucose and lipids',
    },
    severity: 'low',
    conditions: [
      { testCode: 'GLU', check: 'high', threshold: 100 },
      { testCode: 'TG', check: 'high', threshold: 150 },
      { testCode: 'HDL', check: 'low', threshold: 40 },
      { testCode: 'HBA1C', check: 'high', threshold: 5.7 },
    ],
    minMatch: 2,
    suggestedFollowUp: ['OGTT', 'Fasting insulin', 'Lipid panel repeat', 'Blood pressure monitoring'],
  },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect clinical patterns in lab results using rule-based matching.
 * Returns all patterns where minimum conditions are met.
 */
export function detectPatterns(labs: LabDataPoint[]): ClinicalPattern[] {
  const labMap = new Map<string, LabDataPoint>();
  for (const lab of labs) {
    labMap.set(lab.testCode.toUpperCase(), lab);
  }

  const detected: ClinicalPattern[] = [];

  for (const rule of PATTERN_RULES) {
    const matchedTests: string[] = [];
    let matchCount = 0;

    for (const cond of rule.conditions) {
      const lab = labMap.get(cond.testCode.toUpperCase());
      if (!lab || cond.threshold === undefined) continue;

      const matches =
        (cond.check === 'low' && lab.value < cond.threshold) ||
        (cond.check === 'high' && lab.value > cond.threshold) ||
        (cond.check === 'critical_low' && lab.value < cond.threshold) ||
        (cond.check === 'critical_high' && lab.value > cond.threshold);

      if (matches) {
        matchCount++;
        matchedTests.push(cond.testCode);
      }
    }

    const minRequired = rule.minMatch || rule.conditions.length;
    if (matchCount >= minRequired) {
      // Confidence based on how many conditions matched vs total
      const confidenceValue = matchCount / rule.conditions.length;

      detected.push({
        name: rule.name,
        description: rule.description,
        confidence: buildConfidence(confidenceValue, `${matchCount}/${rule.conditions.length} conditions met`),
        matchedTests,
        suggestedFollowUp: rule.suggestedFollowUp,
        severity: rule.severity,
      });
    }
  }

  // Sort by severity (high first) then by confidence
  detected.sort((a, b) => {
    const severityOrder = { high: 0, moderate: 1, low: 2 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence.value - a.confidence.value;
  });

  return detected;
}

/**
 * Get all available pattern names (for UI display).
 */
export function getAvailablePatterns(): { name: string; description: BilingualText }[] {
  return PATTERN_RULES.map((r) => ({
    name: r.name,
    description: r.description,
  }));
}
