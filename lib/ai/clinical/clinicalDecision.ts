/**
 * Clinical Decision Support (CDS)
 *
 * Generates clinical alerts based on patient data triggers.
 * Triggers: order creation, result save, vitals entry, encounter.
 */

import { v4 as uuidv4 } from 'uuid';
import type { CDSAlert, BilingualText } from '../providers/types';
import { CDS_SYSTEM, buildCDSPrompt } from '../prompts/clinicalPrompts';
import { getDisclaimer } from '../safety/disclaimer';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CDSInput {
  trigger: string;
  patientId: string;
  encounterId?: string;
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
}

export interface CDSResult {
  alerts: CDSAlert[];
  disclaimer: string;
}

export type { CDSAlert };

// ---------------------------------------------------------------------------
// Alert Generation
// ---------------------------------------------------------------------------

/**
 * Generate CDS alerts for a clinical trigger.
 */
export async function generateCDSAlerts(
  input: CDSInput,
  complete: (system: string, user: string) => Promise<string>,
): Promise<CDSResult> {
  const userPrompt = buildCDSPrompt({
    trigger: input.trigger,
    patientData: input.patientData,
    context: input.context,
  });

  try {
    const raw = await complete(CDS_SYSTEM, userPrompt);
    return parseResponse(raw, input);
  } catch (error) {
    logger.error('CDS alert generation failed', { category: 'api', error });
    return {
      alerts: [],
      disclaimer: getDisclaimer('clinical', 'en'),
    };
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseResponse(raw: string, input: CDSInput): CDSResult {
  try {
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const data = JSON.parse(jsonStr);

    const alerts: CDSAlert[] = Array.isArray(data.alerts)
      ? data.alerts.map((a: Record<string, unknown>) => ({
          id: uuidv4(),
          type: validateAlertType(String(a.type || 'clinical_pattern')),
          severity: validateSeverity(String(a.severity || 'info')),
          title: {
            ar: String((a.title as Record<string, unknown>)?.ar || ''),
            en: String((a.title as Record<string, unknown>)?.en || ''),
          },
          description: {
            ar: String((a.description as Record<string, unknown>)?.ar || ''),
            en: String((a.description as Record<string, unknown>)?.en || ''),
          },
          suggestedAction: {
            ar: String((a.suggestedAction as Record<string, unknown>)?.ar || ''),
            en: String((a.suggestedAction as Record<string, unknown>)?.en || ''),
          },
          evidence: a.evidence ? String(a.evidence) : undefined,
          overridable: a.overridable !== false,
          patientId: input.patientId,
          encounterId: input.encounterId,
          triggeredBy: input.trigger,
          createdAt: new Date(),
        }))
      : [];

    return {
      alerts,
      disclaimer: String(data.disclaimer || getDisclaimer('clinical', 'en')),
    };
  } catch {
    return {
      alerts: [],
      disclaimer: getDisclaimer('clinical', 'en'),
    };
  }
}

function validateAlertType(
  t: string,
): 'drug_interaction' | 'allergy' | 'duplicate_order' | 'clinical_pattern' | 'guideline' {
  const valid = ['drug_interaction', 'allergy', 'duplicate_order', 'clinical_pattern', 'guideline'] as const;
  return valid.includes(t as typeof valid[number]) ? (t as typeof valid[number]) : 'clinical_pattern';
}

function validateSeverity(s: string): 'info' | 'warning' | 'critical' {
  const valid = ['info', 'warning', 'critical'] as const;
  return valid.includes(s as typeof valid[number]) ? (s as typeof valid[number]) : 'info';
}
