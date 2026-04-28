/**
 * Clinical Decision Support & Patient Summary Prompts
 */

import { SAFETY_PREAMBLE, OUTPUT_REMINDER } from './safetyPrompts';

// ---------------------------------------------------------------------------
// Drug Interaction Check
// ---------------------------------------------------------------------------

export const DRUG_INTERACTION_SYSTEM = `
${SAFETY_PREAMBLE}

You are a clinical pharmacology assistant integrated into Thea EHR.
Your role is to check for drug-drug interactions, drug-allergy conflicts,
and provide information about potential adverse effects.

INTERACTION SEVERITY LEVELS:
- minor: Minimal clinical significance, routine monitoring
- moderate: May require dose adjustment or monitoring
- major: Significant risk, alternative therapy should be considered
- contraindicated: Should NEVER be co-administered

ALWAYS:
- Flag the mechanism of interaction when known
- Suggest management options (dose adjustment, monitoring, alternatives)
- Consider the clinical context (renal/hepatic function if provided)
- Note if interactions are theoretical vs well-documented

${OUTPUT_REMINDER}
`.trim();

export function buildDrugInteractionPrompt(params: {
  medications: { name: string; dose?: string; route?: string; frequency?: string }[];
  allergies?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
}): string {
  const medList = params.medications
    .map((m) => `  - ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.route ? ` ${m.route}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`)
    .join('\n');

  let prompt = `Check for drug interactions in this medication list:\n\n${medList}\n`;

  if (params.allergies && params.allergies.length > 0) {
    prompt += `\nKnown Allergies: ${params.allergies.join(', ')}\n`;
  }
  if (params.renalFunction) prompt += `Renal Function: ${params.renalFunction}\n`;
  if (params.hepaticFunction) prompt += `Hepatic Function: ${params.hepaticFunction}\n`;

  prompt += `
Respond with this exact JSON structure:
{
  "interactions": [
    {
      "drug1": "...",
      "drug2": "...",
      "severity": "minor|moderate|major|contraindicated",
      "description": { "ar": "...", "en": "..." },
      "mechanism": "...",
      "management": { "ar": "...", "en": "..." }
    }
  ],
  "allergyConflicts": [
    {
      "drug": "...",
      "allergen": "...",
      "description": { "ar": "...", "en": "..." },
      "severity": "warning|critical"
    }
  ],
  "disclaimer": "AI drug interaction check..."
}

If no interactions or conflicts are found, return empty arrays.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Clinical Decision Support
// ---------------------------------------------------------------------------

export const CDS_SYSTEM = `
${SAFETY_PREAMBLE}

You are a clinical decision support system integrated into Thea EHR.
You analyze patient data and generate alerts for the treating physician.

ALERT TYPES:
- drug_interaction: Potential medication interactions
- allergy: Drug-allergy conflict
- duplicate_order: Same or overlapping orders
- clinical_pattern: Concerning patterns in data (vital signs, labs, trends)
- guideline: Relevant clinical guideline recommendations

ALWAYS:
- Prioritize patient safety alerts
- Be specific about what triggered the alert
- Suggest actionable next steps
- Include evidence/guideline references when available
- Mark whether the alert is overridable by the physician

${OUTPUT_REMINDER}
`.trim();

export function buildCDSPrompt(params: {
  trigger: string;
  patientData: {
    age?: number;
    gender?: string;
    diagnoses?: string[];
    medications?: string[];
    allergies?: string[];
    recentLabs?: { test: string; value: string; date: string }[];
    recentVitals?: { type: string; value: string; date: string }[];
  };
  context?: string;
}): string {
  let prompt = `Evaluate for clinical decision support alerts.\n\nTrigger: ${params.trigger}\n\n`;

  const pd = params.patientData;
  if (pd.age || pd.gender) prompt += `Patient: ${pd.age || '?'} years, ${pd.gender || '?'}\n`;
  if (pd.diagnoses?.length) prompt += `Active Diagnoses: ${pd.diagnoses.join(', ')}\n`;
  if (pd.medications?.length) prompt += `Current Medications: ${pd.medications.join(', ')}\n`;
  if (pd.allergies?.length) prompt += `Allergies: ${pd.allergies.join(', ')}\n`;

  if (pd.recentLabs?.length) {
    prompt += `\nRecent Labs:\n${pd.recentLabs.map((l) => `  - ${l.test}: ${l.value} (${l.date})`).join('\n')}\n`;
  }

  if (pd.recentVitals?.length) {
    prompt += `\nRecent Vitals:\n${pd.recentVitals.map((v) => `  - ${v.type}: ${v.value} (${v.date})`).join('\n')}\n`;
  }

  if (params.context) prompt += `\nAdditional Context: ${params.context}\n`;

  prompt += `
Respond with this exact JSON structure:
{
  "alerts": [
    {
      "type": "drug_interaction|allergy|duplicate_order|clinical_pattern|guideline",
      "severity": "info|warning|critical",
      "title": { "ar": "...", "en": "..." },
      "description": { "ar": "...", "en": "..." },
      "suggestedAction": { "ar": "...", "en": "..." },
      "evidence": "Guideline or reference if applicable",
      "overridable": true
    }
  ],
  "disclaimer": "Clinical decision support alert..."
}

If no alerts are warranted, return an empty alerts array.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Patient Summary
// ---------------------------------------------------------------------------

export const PATIENT_SUMMARY_SYSTEM = `
${SAFETY_PREAMBLE}

You are a clinical summary assistant integrated into Thea EHR.
Generate concise, structured patient summaries from EHR data.

SUMMARY SHOULD INCLUDE:
- Brief overview of patient's clinical status
- Active diagnoses / problem list
- Current medications
- Key recent lab results with trends
- Recent imaging findings
- Active alerts or concerns

ALWAYS:
- Be concise — summaries should be scannable
- Highlight what's changed recently
- Flag items needing attention
- Use standard medical terminology

${OUTPUT_REMINDER}
`.trim();

export function buildPatientSummaryPrompt(params: {
  patientAge?: number;
  patientGender?: string;
  diagnoses?: string[];
  medications?: string[];
  allergies?: string[];
  labs?: { test: string; value: string; unit: string; date: string; flag?: string }[];
  radiology?: { study: string; date: string; impression: string }[];
  vitals?: { type: string; value: string; date: string }[];
  notes?: string[];
}): string {
  let prompt = 'Generate a clinical patient summary from the following data:\n\n';

  const p = params;
  if (p.patientAge || p.patientGender) prompt += `Patient: ${p.patientAge || '?'} years, ${p.patientGender || '?'}\n`;
  if (p.diagnoses?.length) prompt += `\nActive Diagnoses:\n${p.diagnoses.map((d) => `  - ${d}`).join('\n')}\n`;
  if (p.medications?.length) prompt += `\nCurrent Medications:\n${p.medications.map((m) => `  - ${m}`).join('\n')}\n`;
  if (p.allergies?.length) prompt += `\nAllergies: ${p.allergies.join(', ')}\n`;

  if (p.labs?.length) {
    prompt += `\nRecent Labs:\n${p.labs.map((l) => `  - ${l.test}: ${l.value} ${l.unit} (${l.date})${l.flag ? ` [${l.flag}]` : ''}`).join('\n')}\n`;
  }

  if (p.radiology?.length) {
    prompt += `\nRecent Radiology:\n${p.radiology.map((r) => `  - ${r.study} (${r.date}): ${r.impression}`).join('\n')}\n`;
  }

  if (p.vitals?.length) {
    prompt += `\nRecent Vitals:\n${p.vitals.map((v) => `  - ${v.type}: ${v.value} (${v.date})`).join('\n')}\n`;
  }

  if (p.notes?.length) {
    prompt += `\nClinical Notes (excerpts):\n${p.notes.map((n) => `  - ${n}`).join('\n')}\n`;
  }

  prompt += `
Respond with this exact JSON structure:
{
  "overview": { "ar": "...", "en": "..." },
  "activeDiagnoses": ["..."],
  "currentMedications": ["..."],
  "recentLabs": [{ "test": "...", "value": "...", "status": "normal|abnormal|critical" }],
  "recentRadiology": [{ "study": "...", "impression": "..." }],
  "alerts": ["Any items needing physician attention"],
  "disclaimer": "AI-generated summary..."
}`;

  return prompt;
}
