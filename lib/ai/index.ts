/**
 * AI Module — Barrel Exports
 *
 * Usage:
 *   import { AIEngine, detectPatterns, getDisclaimer } from '@/lib/ai';
 */

// Engine
export { AIEngine, getAISettings, saveAISettings } from './engine';
export type { AIAuditEntry } from './engine';

// Providers
export type {
  AIProviderName,
  AISettings,
  BilingualText,
  ConfidenceLevel,
  ConfidenceScore,
  LabInterpretation,
  RadiologyAssistance,
  CDSAlert,
  DrugInteraction,
  PatientSummary,
  CompletionResult,
} from './providers/types';
export { DEFAULT_AI_SETTINGS } from './providers/types';

// Clinical
export { interpretLabResults } from './clinical/labInterpreter';
export type { LabInterpretationInput } from './clinical/labInterpreter';
export { assistRadiologyReport } from './clinical/radiologyAssist';
export type { RadiologyAssistInput } from './clinical/radiologyAssist';
export { checkDrugInteractions } from './clinical/drugInteraction';
export type { DrugCheckInput, DrugCheckResult } from './clinical/drugInteraction';
export { generateCDSAlerts } from './clinical/clinicalDecision';
export type { CDSInput, CDSResult } from './clinical/clinicalDecision';
export { detectPatterns, getAvailablePatterns } from './clinical/patternDetector';
export type { ClinicalPattern, LabDataPoint } from './clinical/patternDetector';

// Safety
export { SAFETY_RULES, sanitizeAIOutput, wrapWithSafety } from './safety/guardrails';
export { buildConfidence, getConfidenceLevel, getConfidenceLabel, getConfidenceColor } from './safety/confidence';
export { getDisclaimer, getBilingualDisclaimer, appendDisclaimer } from './safety/disclaimer';
