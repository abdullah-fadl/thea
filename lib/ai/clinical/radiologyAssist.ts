/**
 * Radiology Report Assistant
 *
 * AI-powered assistance for structuring radiology reports.
 * Does NOT interpret images — assists with report writing workflow.
 */

import type { RadiologyAssistance, BilingualText } from '../providers/types';
import {
  RADIOLOGY_ASSIST_SYSTEM,
  buildRadiologyAssistPrompt,
} from '../prompts/radiologyPrompts';
import { getDisclaimer } from '../safety/disclaimer';
import { sanitizeAIOutput, ensureSuggestiveLanguage } from '../safety/guardrails';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadiologyAssistInput {
  modality: string;
  bodyPart: string;
  clinicalIndication?: string;
  currentFindings?: string;
  priorReports?: { date: string; impression: string }[];
  patientAge?: number;
  patientGender?: string;
}

export type { RadiologyAssistance };

// ---------------------------------------------------------------------------
// Assistance
// ---------------------------------------------------------------------------

/**
 * Get AI assistance for a radiology report.
 */
export async function assistRadiologyReport(
  input: RadiologyAssistInput,
  complete: (system: string, user: string) => Promise<string>,
): Promise<RadiologyAssistance> {
  const userPrompt = buildRadiologyAssistPrompt(input);

  try {
    const raw = await complete(RADIOLOGY_ASSIST_SYSTEM, userPrompt);
    const parsed = parseRadiologyResponse(raw);
    return applySafety(parsed);
  } catch (error) {
    logger.error('Radiology assist failed', { category: 'api', error });
    return buildFallback(input);
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseRadiologyResponse(raw: string): RadiologyAssistance {
  try {
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const data = JSON.parse(jsonStr);

    return {
      suggestedFindings: Array.isArray(data.suggestedFindings)
        ? data.suggestedFindings.map((f: Record<string, unknown>) => ({
            finding: {
              ar: String((f.finding as Record<string, unknown>)?.ar || ''),
              en: String((f.finding as Record<string, unknown>)?.en || ''),
            },
            location: String(f.location || ''),
            confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
            severity: validateSeverity(String(f.severity || 'incidental')),
          }))
        : [],
      suggestedImpression: {
        ar: String(data.suggestedImpression?.ar || ''),
        en: String(data.suggestedImpression?.en || ''),
      },
      comparisons: Array.isArray(data.comparisons)
        ? data.comparisons.map(String)
        : [],
      criticalAlert: data.criticalAlert
        ? {
            finding: String(data.criticalAlert.finding || ''),
            action: String(data.criticalAlert.action || ''),
          }
        : undefined,
    };
  } catch {
    throw new Error('Failed to parse radiology response');
  }
}

function validateSeverity(s: string): 'incidental' | 'moderate' | 'urgent' {
  const valid = ['incidental', 'moderate', 'urgent'] as const;
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'incidental';
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

function applySafety(result: RadiologyAssistance): RadiologyAssistance {
  return {
    ...result,
    suggestedFindings: result.suggestedFindings.map((f) => ({
      ...f,
      finding: {
        ar: sanitizeAIOutput(ensureSuggestiveLanguage(f.finding.ar, 'ar')).text,
        en: sanitizeAIOutput(ensureSuggestiveLanguage(f.finding.en, 'en')).text,
      },
    })),
    suggestedImpression: {
      ar: sanitizeAIOutput(ensureSuggestiveLanguage(result.suggestedImpression.ar, 'ar')).text,
      en: sanitizeAIOutput(ensureSuggestiveLanguage(result.suggestedImpression.en, 'en')).text,
    },
  };
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function buildFallback(input: RadiologyAssistInput): RadiologyAssistance {
  return {
    suggestedFindings: [],
    suggestedImpression: {
      ar: `دراسة ${input.modality} — ${input.bodyPart}: تعذر إنشاء اقتراحات آلية`,
      en: `${input.modality} — ${input.bodyPart}: Automated suggestions unavailable`,
    },
    comparisons: [],
  };
}
