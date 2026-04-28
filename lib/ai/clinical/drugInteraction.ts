/**
 * Drug Interaction Checker
 *
 * AI-powered medication interaction and allergy conflict detection.
 */

import type { DrugInteraction, BilingualText } from '../providers/types';
import {
  DRUG_INTERACTION_SYSTEM,
  buildDrugInteractionPrompt,
} from '../prompts/clinicalPrompts';
import { getDisclaimer } from '../safety/disclaimer';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrugCheckInput {
  medications: {
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
  }[];
  allergies?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
}

export interface DrugCheckResult {
  interactions: DrugInteraction[];
  allergyConflicts: {
    drug: string;
    allergen: string;
    description: BilingualText;
    severity: 'warning' | 'critical';
  }[];
  disclaimer: string;
}

export type { DrugInteraction };

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

/**
 * Check for drug interactions and allergy conflicts.
 */
export async function checkDrugInteractions(
  input: DrugCheckInput,
  complete: (system: string, user: string) => Promise<string>,
): Promise<DrugCheckResult> {
  // Need at least 2 medications to check interactions
  if (input.medications.length < 2 && (!input.allergies || input.allergies.length === 0)) {
    return {
      interactions: [],
      allergyConflicts: [],
      disclaimer: getDisclaimer('drug', 'en'),
    };
  }

  const userPrompt = buildDrugInteractionPrompt(input);

  try {
    const raw = await complete(DRUG_INTERACTION_SYSTEM, userPrompt);
    return parseResponse(raw);
  } catch (error) {
    logger.error('Drug interaction check failed', { category: 'api', error });
    return {
      interactions: [],
      allergyConflicts: [],
      disclaimer: getDisclaimer('drug', 'en'),
    };
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseResponse(raw: string): DrugCheckResult {
  try {
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const data = JSON.parse(jsonStr);

    return {
      interactions: Array.isArray(data.interactions)
        ? data.interactions.map((i: Record<string, unknown>) => ({
            drug1: String(i.drug1 || ''),
            drug2: String(i.drug2 || ''),
            severity: validateSeverity(String(i.severity || 'minor')),
            description: {
              ar: String((i.description as Record<string, unknown>)?.ar || ''),
              en: String((i.description as Record<string, unknown>)?.en || ''),
            },
            mechanism: i.mechanism ? String(i.mechanism) : undefined,
            management: {
              ar: String((i.management as Record<string, unknown>)?.ar || ''),
              en: String((i.management as Record<string, unknown>)?.en || ''),
            },
          }))
        : [],
      allergyConflicts: Array.isArray(data.allergyConflicts)
        ? data.allergyConflicts.map((c: Record<string, unknown>) => ({
            drug: String(c.drug || ''),
            allergen: String(c.allergen || ''),
            description: {
              ar: String((c.description as Record<string, unknown>)?.ar || ''),
              en: String((c.description as Record<string, unknown>)?.en || ''),
            },
            severity: c.severity === 'critical' ? 'critical' as const : 'warning' as const,
          }))
        : [],
      disclaimer: String(data.disclaimer || getDisclaimer('drug', 'en')),
    };
  } catch {
    return {
      interactions: [],
      allergyConflicts: [],
      disclaimer: getDisclaimer('drug', 'en'),
    };
  }
}

function validateSeverity(s: string): 'minor' | 'moderate' | 'major' | 'contraindicated' {
  const valid = ['minor', 'moderate', 'major', 'contraindicated'] as const;
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'minor';
}
