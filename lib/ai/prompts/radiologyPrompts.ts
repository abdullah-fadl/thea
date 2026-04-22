/**
 * Radiology AI Prompts
 *
 * System and user prompt templates for AI-assisted radiology reporting.
 */

import { SAFETY_PREAMBLE, OUTPUT_REMINDER } from './safetyPrompts';

/**
 * System prompt for radiology report assistance.
 */
export const RADIOLOGY_ASSIST_SYSTEM = `
${SAFETY_PREAMBLE}

You are a radiology report assistant integrated into Thea EHR.
Your role is to help radiologists structure and complete reports.

IMPORTANT: You do NOT have access to images. You assist by:
- Analyzing study metadata (modality, body part, clinical indication)
- Suggesting structured findings based on modality and anatomy
- Auto-filling report template sections
- Comparing with prior report text for the same patient
- Flagging if findings are inconsistent with clinical indication
- Suggesting critical findings that may need urgent communication

REPORT STRUCTURE:
- Clinical Indication
- Technique
- Comparison
- Findings (organized by anatomy)
- Impression (concise summary)

MODALITY AWARENESS:
- CR/DR (X-ray): focus on bones, soft tissue, lungs, heart size
- CT: systematic review by anatomy (brain, chest, abdomen, etc.)
- MR: tissue characterization, signal abnormalities
- US: organ echogenicity, measurements, fluid
- NM: tracer uptake, distribution

${OUTPUT_REMINDER}
`.trim();

/**
 * Build user prompt for radiology assistance.
 */
export function buildRadiologyAssistPrompt(params: {
  modality: string;
  bodyPart: string;
  clinicalIndication?: string;
  currentFindings?: string;
  priorReports?: { date: string; impression: string }[];
  patientAge?: number;
  patientGender?: string;
}): string {
  let prompt = `Assist with structuring a radiology report:\n`;
  prompt += `\nStudy: ${params.modality} — ${params.bodyPart}\n`;

  if (params.clinicalIndication) {
    prompt += `Clinical Indication: ${params.clinicalIndication}\n`;
  }

  if (params.patientAge || params.patientGender) {
    prompt += `Patient: ${params.patientAge ? `${params.patientAge} years` : ''}${params.patientGender ? `, ${params.patientGender}` : ''}\n`;
  }

  if (params.currentFindings) {
    prompt += `\nCurrent Draft Findings:\n${params.currentFindings}\n`;
  }

  if (params.priorReports && params.priorReports.length > 0) {
    prompt += `\nPrior Reports:\n`;
    for (const prior of params.priorReports.slice(0, 3)) {
      prompt += `  - ${prior.date}: ${prior.impression}\n`;
    }
  }

  prompt += `
Respond with this exact JSON structure:
{
  "suggestedFindings": [
    {
      "finding": { "ar": "...", "en": "..." },
      "location": "anatomical location",
      "confidence": 0.7,
      "severity": "incidental|moderate|urgent"
    }
  ],
  "suggestedImpression": { "ar": "...", "en": "..." },
  "comparisons": ["Suggestion for comparison studies"],
  "criticalAlert": {
    "finding": "...",
    "action": "Notify referring physician immediately"
  }
}

Note: criticalAlert should only be included if a finding may be urgent.
If there is no critical alert, set criticalAlert to null.`;

  return prompt;
}
