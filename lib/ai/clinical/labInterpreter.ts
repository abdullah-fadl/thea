/**
 * Lab Result Interpreter
 *
 * AI-powered interpretation of lab results in clinical context.
 * Detects patterns, suggests follow-up, and provides bilingual explanations.
 */

import type { LabInterpretation, BilingualText } from '../providers/types';
import { LAB_INTERPRETATION_SYSTEM, buildLabInterpretationPrompt } from '../prompts/labPrompts';
import { getDisclaimer } from '../safety/disclaimer';
import { sanitizeAIOutput, ensureSuggestiveLanguage } from '../safety/guardrails';
import { buildConfidence, getConfidenceLevel } from '../safety/confidence';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabInterpretationInput {
  results: {
    testCode: string;
    testName: string;
    value: number | string;
    unit: string;
    referenceRange?: string;
    flag?: string;
  }[];
  patientAge?: number;
  patientGender?: string;
  clinicalContext?: string;
  previousResults?: {
    testCode: string;
    value: number | string;
    date: string;
  }[];
}

// Re-export for convenience
export type { LabInterpretation };

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

/**
 * Interpret lab results using AI.
 * Requires an engine instance (injected to avoid circular deps).
 */
export async function interpretLabResults(
  input: LabInterpretationInput,
  complete: (system: string, user: string) => Promise<string>,
): Promise<LabInterpretation> {
  const userPrompt = buildLabInterpretationPrompt(input);

  try {
    const raw = await complete(LAB_INTERPRETATION_SYSTEM, userPrompt);

    // Parse JSON response
    const parsed = parseLabResponse(raw);

    // Apply safety guardrails
    return applySafety(parsed);
  } catch (error) {
    logger.error('Lab interpretation failed', { category: 'api', error });
    return buildFallbackInterpretation(input);
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseLabResponse(raw: string): LabInterpretation {
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    // Also try to find first { ... } block
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const data = JSON.parse(jsonStr);

    return {
      summary: {
        ar: data.summary?.ar || '',
        en: data.summary?.en || '',
      },
      findings: Array.isArray(data.findings)
        ? data.findings.map((f: Record<string, unknown>) => ({
            testCode: String(f.testCode || ''),
            status: validateStatus(String(f.status || 'normal')),
            interpretation: {
              ar: String((f.interpretation as Record<string, unknown>)?.ar || ''),
              en: String((f.interpretation as Record<string, unknown>)?.en || ''),
            },
            clinicalSignificance: validateSignificance(String(f.clinicalSignificance || 'low')),
          }))
        : [],
      patterns: Array.isArray(data.patterns)
        ? data.patterns.map((p: Record<string, unknown>) => ({
            name: String(p.name || ''),
            description: {
              ar: String((p.description as Record<string, unknown>)?.ar || ''),
              en: String((p.description as Record<string, unknown>)?.en || ''),
            },
            confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
            suggestedFollowUp: Array.isArray(p.suggestedFollowUp)
              ? p.suggestedFollowUp.map(String)
              : [],
          }))
        : [],
      disclaimer: String(data.disclaimer || getDisclaimer('lab', 'en')),
    };
  } catch {
    throw new Error('Failed to parse lab interpretation response');
  }
}

function validateStatus(s: string): 'normal' | 'abnormal_high' | 'abnormal_low' | 'critical' {
  const valid = ['normal', 'abnormal_high', 'abnormal_low', 'critical'] as const;
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'normal';
}

function validateSignificance(s: string): 'low' | 'moderate' | 'high' {
  const valid = ['low', 'moderate', 'high'] as const;
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'low';
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

function applySafety(interp: LabInterpretation): LabInterpretation {
  // Sanitize all text fields
  const safeFindings = interp.findings.map((f) => ({
    ...f,
    interpretation: {
      ar: sanitizeAIOutput(ensureSuggestiveLanguage(f.interpretation.ar, 'ar')).text,
      en: sanitizeAIOutput(ensureSuggestiveLanguage(f.interpretation.en, 'en')).text,
    },
  }));

  const safeSummary: BilingualText = {
    ar: sanitizeAIOutput(ensureSuggestiveLanguage(interp.summary.ar, 'ar')).text,
    en: sanitizeAIOutput(ensureSuggestiveLanguage(interp.summary.en, 'en')).text,
  };

  return {
    ...interp,
    summary: safeSummary,
    findings: safeFindings,
    disclaimer: getDisclaimer('lab', 'en'),
  };
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

function buildFallbackInterpretation(input: LabInterpretationInput): LabInterpretation {
  const findings = input.results.map((r) => {
    let status: 'normal' | 'abnormal_high' | 'abnormal_low' | 'critical' = 'normal';
    if (r.flag) {
      const f = r.flag.toUpperCase();
      if (f === 'H' || f === 'HH') status = f === 'HH' ? 'critical' : 'abnormal_high';
      if (f === 'L' || f === 'LL') status = f === 'LL' ? 'critical' : 'abnormal_low';
    }

    return {
      testCode: r.testCode,
      status,
      interpretation: {
        ar: status === 'normal' ? 'ضمن المعدل الطبيعي' : 'خارج المعدل الطبيعي — يحتاج تقييم سريري',
        en: status === 'normal' ? 'Within normal range' : 'Outside normal range — requires clinical evaluation',
      },
      clinicalSignificance: (status === 'critical' ? 'high' : status === 'normal' ? 'low' : 'moderate') as 'low' | 'moderate' | 'high',
    };
  });

  return {
    summary: {
      ar: 'تعذر تفسير النتائج آلياً — يرجى مراجعة النتائج يدوياً',
      en: 'Automated interpretation unavailable — please review results manually',
    },
    findings,
    patterns: [],
    disclaimer: getDisclaimer('lab', 'en'),
  };
}
