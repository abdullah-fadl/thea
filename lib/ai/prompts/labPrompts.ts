/**
 * Lab Interpretation Prompts
 *
 * System and user prompt templates for AI-assisted lab result interpretation.
 */

import { SAFETY_PREAMBLE, OUTPUT_REMINDER } from './safetyPrompts';

/**
 * System prompt for lab result interpretation.
 */
export const LAB_INTERPRETATION_SYSTEM = `
${SAFETY_PREAMBLE}

You are a clinical laboratory interpretation assistant integrated into Thea EHR.
Your role is to help physicians understand lab results in clinical context.

CAPABILITIES:
- Interpret individual test results against reference ranges
- Detect multi-test patterns (e.g., iron deficiency anemia, DKA, AKI, sepsis markers)
- Suggest follow-up tests when patterns are incomplete
- Flag critical values requiring immediate attention
- Provide bilingual (Arabic/English) interpretations

KNOWN PATTERNS TO DETECT:
- Iron deficiency anemia: low HGB + low MCV + low ferritin + high TIBC
- DKA: high glucose + low CO2 + high anion gap + ketonuria
- Liver failure: high bilirubin + high ALT/AST + low albumin + high INR
- AKI: rising creatinine + rising BUN + electrolyte imbalance
- Sepsis markers: high WBC + high CRP + high procalcitonin + lactic acidosis
- Thyroid disorders: TSH/T3/T4 correlations
- Coagulation disorders: PT/INR/aPTT patterns
- Metabolic syndrome: glucose + lipids + HbA1c
- Electrolyte imbalances: Na/K/Cl/CO2/Ca/Mg/PO4 relationships

${OUTPUT_REMINDER}
`.trim();

/**
 * Build the user prompt for lab interpretation.
 */
export function buildLabInterpretationPrompt(params: {
  results: { testCode: string; testName: string; value: number | string; unit: string; referenceRange?: string; flag?: string }[];
  patientAge?: number;
  patientGender?: string;
  clinicalContext?: string;
  previousResults?: { testCode: string; value: number | string; date: string }[];
}): string {
  const resultsTable = params.results
    .map(
      (r) =>
        `  - ${r.testCode} (${r.testName}): ${r.value} ${r.unit}${r.referenceRange ? ` [Ref: ${r.referenceRange}]` : ''}${r.flag ? ` (${r.flag})` : ''}`,
    )
    .join('\n');

  let prompt = `Interpret the following lab results:\n\n${resultsTable}\n`;

  if (params.patientAge || params.patientGender) {
    prompt += `\nPatient: ${params.patientAge ? `${params.patientAge} years` : ''}${params.patientGender ? `, ${params.patientGender}` : ''}\n`;
  }

  if (params.clinicalContext) {
    prompt += `\nClinical Context: ${params.clinicalContext}\n`;
  }

  if (params.previousResults && params.previousResults.length > 0) {
    const prevTable = params.previousResults
      .map((r) => `  - ${r.testCode}: ${r.value} (${r.date})`)
      .join('\n');
    prompt += `\nPrevious Results:\n${prevTable}\n`;
  }

  prompt += `
Respond with this exact JSON structure:
{
  "summary": { "ar": "...", "en": "..." },
  "findings": [
    {
      "testCode": "...",
      "status": "normal|abnormal_high|abnormal_low|critical",
      "interpretation": { "ar": "...", "en": "..." },
      "clinicalSignificance": "low|moderate|high"
    }
  ],
  "patterns": [
    {
      "name": "Pattern Name",
      "description": { "ar": "...", "en": "..." },
      "confidence": 0.85,
      "suggestedFollowUp": ["Test1", "Test2"]
    }
  ],
  "disclaimer": "AI-assisted interpretation only..."
}`;

  return prompt;
}
