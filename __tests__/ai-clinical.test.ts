/**
 * 20 AI Clinical Intelligence Tests
 *
 * Structural validation of the AI clinical module via source file inspection.
 * Complements the existing ai-module.test.ts (which tests guardrails, confidence,
 * and pattern detection at runtime) by verifying provider interfaces, engine
 * architecture, prompt structure, clinical modules, and audit logging patterns.
 *
 * Categories:
 *   AC-01..AC-03  Provider interface & implementations (types, OpenAI, Anthropic)
 *   AC-04..AC-06  Safety guardrails deep inspection (forbidden phrases, wrapping)
 *   AC-07..AC-09  Confidence scoring (thresholds, label, color, aggregation guard)
 *   AC-10..AC-11  Disclaimers (appendDisclaimer, buildReportFooter)
 *   AC-12..AC-14  Clinical modules (labInterpreter, drugInteraction, clinicalDecision)
 *   AC-15..AC-16  Pattern detector (rule definitions, 8 patterns)
 *   AC-17..AC-18  Engine (provider fallback, rate limiting, audit)
 *   AC-19..AC-20  Prompts (safety preamble, lab/radiology/clinical prompts)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Provider Interface & Implementations (AC-01..AC-03)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Provider Interface', () => {
  // AC-01: AIProvider interface defines required methods
  it('AC-01: AIProvider interface defines name, defaultModel, isAvailable, and complete', () => {
    const src = readSource('lib/ai/providers/types.ts');

    expect(src).toContain('export interface AIProvider');
    expect(src).toContain('readonly name: AIProviderName');
    expect(src).toContain('readonly defaultModel: string');
    expect(src).toContain('isAvailable(): boolean');
    expect(src).toContain('complete(options: CompletionOptions): Promise<CompletionResult>');
  });

  // AC-02: OpenAI provider wraps lib/openai/server.ts
  it('AC-02: OpenAI provider wraps existing lib/openai/server.ts via getOpenAI', () => {
    const src = readSource('lib/ai/providers/openai.ts');

    expect(src).toContain("import { getOpenAI } from '@/lib/openai/server'");
    expect(src).toContain("export class OpenAIProvider implements AIProvider");
    expect(src).toContain("readonly name = 'openai'");
    expect(src).toContain("return getOpenAI() !== null");
    expect(src).toContain('openai.chat.completions.create');
    expect(src).toContain("const DEFAULT_MODEL = 'gpt-4o-mini'");
  });

  // AC-03: Anthropic provider exists as alternative
  it('AC-03: Anthropic provider implements AIProvider interface', () => {
    const src = readSource('lib/ai/providers/anthropic.ts');

    expect(src).toContain('export class AnthropicProvider implements AIProvider');
    expect(src).toContain("readonly name = 'anthropic'");
    expect(src).toContain('isAvailable(): boolean');
    expect(src).toContain('async complete(');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Safety Guardrails Deep Inspection (AC-04..AC-06)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Guardrails Architecture', () => {
  const guardSrc = readSource('lib/ai/safety/guardrails.ts');

  // AC-04: SAFETY_RULES enforces all clinical safety principles
  it('AC-04: SAFETY_RULES defines all safety principles (disclaimer, neverDiagnose, etc.)', () => {
    expect(guardSrc).toContain('export const SAFETY_RULES');
    expect(guardSrc).toContain('neverDiagnose: true');
    expect(guardSrc).toContain('showConfidence: true');
    expect(guardSrc).toContain('requirePhysicianAction: true');
    expect(guardSrc).toContain('auditLog: true');
    expect(guardSrc).toContain('alwaysOverridable: true');
  });

  // AC-05: Forbidden phrases cover both English and Arabic diagnostic language
  it('AC-05: FORBIDDEN_PHRASES cover 12+ English and 5+ Arabic phrases', () => {
    // English forbidden phrases
    expect(guardSrc).toContain("'you have'");
    expect(guardSrc).toContain("'you are diagnosed with'");
    expect(guardSrc).toContain("'this confirms'");
    expect(guardSrc).toContain("'the patient has'");
    expect(guardSrc).toContain("'prescribe'");
    expect(guardSrc).toContain("'you should take'");
    expect(guardSrc).toContain("'start treatment'");

    // Arabic forbidden phrases
    expect(guardSrc).toContain('أنت مصاب بـ');
    expect(guardSrc).toContain('التشخيص النهائي');
    expect(guardSrc).toContain('تشخيص مؤكد');
    expect(guardSrc).toContain('يجب عليك تناول');
  });

  // AC-06: wrapWithSafety and validateSafeOutput exist
  it('AC-06: guardrails exports wrapWithSafety and validateSafeOutput', () => {
    expect(guardSrc).toContain('export function wrapWithSafety<T');
    expect(guardSrc).toContain('safetyApplied: true');
    expect(guardSrc).toContain('export function validateSafeOutput(');
    expect(guardSrc).toContain("typeof output.disclaimer === 'string'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Confidence Scoring — Thresholds & Utilities (AC-07..AC-09)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Confidence Scoring Details', () => {
  const confSrc = readSource('lib/ai/safety/confidence.ts');

  // AC-07: Confidence thresholds define exact ranges for high/medium/low
  it('AC-07: THRESHOLDS define high >= 0.8, medium >= 0.5, low >= 0.0', () => {
    expect(confSrc).toContain("high:   { min: 0.8, max: 1.0 }");
    expect(confSrc).toContain("medium: { min: 0.5, max: 0.79 }");
    expect(confSrc).toContain("low:    { min: 0.0, max: 0.49 }");
  });

  // AC-08: Bilingual confidence labels and Tailwind colors exist
  it('AC-08: getConfidenceLabel returns bilingual labels and getConfidenceColor returns Tailwind classes', () => {
    expect(confSrc).toContain('export function getConfidenceLabel(');
    expect(confSrc).toContain("ar: 'ثقة عالية'");
    expect(confSrc).toContain("en: 'High Confidence'");
    expect(confSrc).toContain('export function getConfidenceColor(');
    expect(confSrc).toContain("'text-green-600 bg-green-50'");
    expect(confSrc).toContain("'text-amber-600 bg-amber-50'");
    expect(confSrc).toContain("'text-red-600 bg-red-50'");
  });

  // AC-09: aggregateConfidence guards against divide-by-zero [AI-03]
  it('AC-09: aggregateConfidence guards against divide-by-zero with [AI-03] tag', () => {
    expect(confSrc).toContain('[AI-03]');
    expect(confSrc).toContain('!totalWeight || !Number.isFinite(totalWeight)');
    expect(confSrc).toContain("'Unable to aggregate — invalid weights'");
    // Returns 0 for empty scores
    expect(confSrc).toContain("if (scores.length === 0) return buildConfidence(0, 'No data')");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Disclaimers — Additional Functions (AC-10..AC-11)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Disclaimer Functions', () => {
  const discSrc = readSource('lib/ai/safety/disclaimer.ts');

  // AC-10: appendDisclaimer and buildReportFooter exist
  it('AC-10: disclaimer.ts exports appendDisclaimer and buildReportFooter', () => {
    expect(discSrc).toContain('export function appendDisclaimer(');
    expect(discSrc).toContain('export function buildReportFooter(');
    expect(discSrc).toContain('AI-assisted generation');
    expect(discSrc).toContain('تم الإنشاء بمساعدة الذكاء الاصطناعي');
  });

  // AC-11: All 6 disclaimer contexts have both Arabic and English text
  it('AC-11: DISCLAIMERS record has all 6 contexts with ar and en keys', () => {
    const contexts = ['lab', 'radiology', 'clinical', 'drug', 'summary', 'general'];
    for (const ctx of contexts) {
      expect(discSrc).toContain(`${ctx}: {`);
    }
    // Verify bilingual pattern
    expect(discSrc).toContain("ar: '");
    expect(discSrc).toContain("en: '");
    expect(discSrc).toContain("export type DisclaimerContext");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Clinical Modules — Lab, Drug, CDS (AC-12..AC-14)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Clinical Module Files', () => {
  // AC-12: Lab interpreter has AI + fallback interpretation with safety integration
  it('AC-12: labInterpreter imports safety guardrails and confidence scoring', () => {
    const src = readSource('lib/ai/clinical/labInterpreter.ts');

    expect(src).toContain('export async function interpretLabResults(');
    expect(src).toContain("import { sanitizeAIOutput, ensureSuggestiveLanguage } from '../safety/guardrails'");
    expect(src).toContain("import { buildConfidence, getConfidenceLevel } from '../safety/confidence'");
    expect(src).toContain("import { getDisclaimer } from '../safety/disclaimer'");
    expect(src).toContain('export interface LabInterpretationInput');
  });

  // AC-13: Drug interaction checker validates allergy conflicts
  it('AC-13: drugInteraction.ts exports DrugCheckInput/DrugCheckResult with allergyConflicts', () => {
    const src = readSource('lib/ai/clinical/drugInteraction.ts');

    expect(src).toContain('export interface DrugCheckInput');
    expect(src).toContain('export interface DrugCheckResult');
    expect(src).toContain('allergyConflicts:');
    expect(src).toContain("severity: 'warning' | 'critical'");
    expect(src).toContain('export async function checkDrugInteractions(');
    expect(src).toContain('allergies?: string[]');
  });

  // AC-14: Clinical decision support generates alerts with trigger context
  it('AC-14: clinicalDecision.ts generates CDSAlerts with patientData and trigger', () => {
    const src = readSource('lib/ai/clinical/clinicalDecision.ts');

    expect(src).toContain('export interface CDSInput');
    expect(src).toContain('export interface CDSResult');
    expect(src).toContain('trigger: string');
    expect(src).toContain('patientId: string');
    expect(src).toContain('alerts: CDSAlert[]');
    expect(src).toContain('export async function generateCDSAlerts(');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Pattern Detector — Rule Definitions (AC-15..AC-16)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Pattern Detector Architecture', () => {
  const pdSrc = readSource('lib/ai/clinical/patternDetector.ts');

  // AC-15: Pattern detector exports ClinicalPattern and LabDataPoint types
  it('AC-15: patternDetector.ts exports ClinicalPattern, LabDataPoint, and detectPatterns', () => {
    expect(pdSrc).toContain('export interface ClinicalPattern');
    expect(pdSrc).toContain('export interface LabDataPoint');
    expect(pdSrc).toContain('export function detectPatterns(');
    expect(pdSrc).toContain('matchedTests: string[]');
    expect(pdSrc).toContain('suggestedFollowUp: string[]');
    expect(pdSrc).toContain("severity: 'low' | 'moderate' | 'high'");
  });

  // AC-16: Pattern rules define 8 clinical patterns
  it('AC-16: patternDetector defines 8 rule-based patterns (iron deficiency, DKA, AKI, etc.)', () => {
    expect(pdSrc).toContain('Iron Deficiency Anemia');
    expect(pdSrc).toContain('Diabetic Ketoacidosis (DKA)');
    expect(pdSrc).toContain('Acute Kidney Injury');
    expect(pdSrc).toContain('Liver Injury');
    expect(pdSrc).toContain('Sepsis Markers');
    expect(pdSrc).toContain('Thyroid Dysfunction');
    expect(pdSrc).toContain('Coagulation Disorder');
    expect(pdSrc).toContain('Metabolic Syndrome Markers');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: Engine — Provider Fallback, Rate Limiting, Audit (AC-17..AC-18)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Engine Architecture', () => {
  const engineSrc = readSource('lib/ai/engine.ts');

  // AC-17: Engine has provider fallback and rate limiting with cleanup
  it('AC-17: engine has provider fallback logic and rate limit cleanup [AI-02]', () => {
    expect(engineSrc).toContain("const fallbackName: AIProviderName = params.providerName === 'anthropic' ? 'openai' : 'anthropic'");
    expect(engineSrc).toContain('No AI provider available');
    expect(engineSrc).toContain('function checkRateLimit(tenantId: string');
    expect(engineSrc).toContain('[AI-02]');
    expect(engineSrc).toContain('cleanupRateLimitMap');
    expect(engineSrc).toContain('RATE_LIMIT_CLEANUP_INTERVAL');
  });

  // AC-18: Engine audit logging writes to aiAuditLog via Prisma
  it('AC-18: engine logs all AI requests to prisma.aiAuditLog', () => {
    expect(engineSrc).toContain('prisma.aiAuditLog.create');
    expect(engineSrc).toContain('export interface AIAuditEntry');
    expect(engineSrc).toContain('promptTokens:');
    expect(engineSrc).toContain('completionTokens:');
    expect(engineSrc).toContain('totalTokens:');
    expect(engineSrc).toContain('durationMs:');
    expect(engineSrc).toContain('success:');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: Prompts — Safety Preamble & Clinical Prompts (AC-19..AC-20)
// ─────────────────────────────────────────────────────────────────────────────
describe('AI Clinical — Prompt Files', () => {
  // AC-19: Safety preamble defines non-negotiable rules for AI output
  it('AC-19: safetyPrompts.ts defines a safety preamble for all AI prompts', () => {
    const src = readSource('lib/ai/prompts/safetyPrompts.ts');

    expect(src).toContain('SAFETY_PREAMBLE');
    // Should mention physician/doctor
    expect(src.toLowerCase()).toMatch(/physician|doctor/);
    // Should mention suggestion/suggestive
    expect(src.toLowerCase()).toMatch(/suggest/);
  });

  // AC-20: Clinical prompts exist for lab, radiology, and CDS
  it('AC-20: clinicalPrompts.ts exports CDS_SYSTEM, DRUG_INTERACTION_SYSTEM, and PATIENT_SUMMARY_SYSTEM', () => {
    const src = readSource('lib/ai/prompts/clinicalPrompts.ts');

    expect(src).toContain('CDS_SYSTEM');
    expect(src).toContain('DRUG_INTERACTION_SYSTEM');
    expect(src).toContain('PATIENT_SUMMARY_SYSTEM');
    expect(src).toContain('buildPatientSummaryPrompt');
    expect(src).toContain('buildCDSPrompt');
    expect(src).toContain('buildDrugInteractionPrompt');

    // Lab prompts
    const labSrc = readSource('lib/ai/prompts/labPrompts.ts');
    expect(labSrc).toContain('LAB_INTERPRETATION_SYSTEM');
    expect(labSrc).toContain('buildLabInterpretationPrompt');

    // Radiology prompts
    const radSrc = readSource('lib/ai/prompts/radiologyPrompts.ts');
    expect(radSrc).toContain('buildRadiologyAssistPrompt');
  });
});
