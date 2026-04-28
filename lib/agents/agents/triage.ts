/**
 * Phase 8.3 — TriageAgent (suggestion-only)
 *
 * Reads a chief complaint (Arabic or English) plus optional vitals and
 * returns ESI score, candidate ICD-10 codes, recommended workup, and
 * any Arabic medical phrases recognised in the text.
 *
 * SAFETY:
 *   - Output is always { suggestion: true, ... }. Never auto-applied.
 *     A clinician must review and accept any recommendation.
 *   - Anthropic SDK is loaded lazily through `chat()` (Phase 6.2 wrapper).
 *     No top-level import of @anthropic-ai/sdk.
 *   - Both flag-gating layers apply:
 *       FF_AI_AGENTS_ENABLED   → register/run-time guard
 *       FF_ARABIC_NLP_ENABLED  → matchMedicalPhrases() returns [] when off
 *       FF_ONTOLOGY_ENABLED    → findConceptByCode() returns null when off
 *     The agent degrades gracefully when the optional flags are off
 *     (falls back to LLM-only analysis with empty supporting context).
 *
 * TOOLS (each emits tool.invoked@v1 via the Phase 6.2 framework):
 *   - clinical.triage.analyzeSymptoms : LLM-backed analysis returning JSON
 *   - clinical.triage.lookupIcd10     : Phase 5.3 ontology lookup by code
 */

import { z } from 'zod';
import { isEnabled } from '@/lib/core/flags';
import { registerAgent } from '../framework/registry';
import { registerTool, invokeTool } from '../framework/tools';
import { matchMedicalPhrases, type PhraseMatch } from '@/lib/nlp/arabic/matcher';
import { findConceptByCode } from '@/lib/ontology/lookup';

// Lazy import the LLM wrapper. The wrapper itself dynamically imports
// @anthropic-ai/sdk only when chat() is actually called, so we keep that
// guarantee here too — a triage tool registration alone never pulls the
// SDK into the module graph, and tests can replace the wrapper module
// without forcing Vite to resolve the SDK package.
async function loadChat(): Promise<typeof import('@/lib/agents/llm/anthropic').chat> {
  const mod = await import('@/lib/agents/llm/anthropic');
  return mod.chat;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIAGE_AGENT_KEY = 'clinical.triage.v1';
const TOOL_ANALYZE_KEY = 'clinical.triage.analyzeSymptoms';
const TOOL_LOOKUP_ICD10_KEY = 'clinical.triage.lookupIcd10';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const vitalsSchema = z
  .object({
    hr: z.number().int().min(0).max(400).optional(),
    bp: z.string().min(1).max(20).optional(),
    temp: z.number().min(20).max(45).optional(),
    spo2: z.number().int().min(0).max(100).optional(),
  })
  .optional();

const phraseMatchSchema = z.object({
  phrase: z.string(),
  canonical: z.string(),
  concept_code_system: z.string(),
  concept_code: z.string(),
  span: z.tuple([z.number(), z.number()]),
  score: z.number(),
});

const candidateIcd10Schema = z.object({
  code: z.string().min(1).max(20),
  display: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
});

const triageInputSchema = z.object({
  chiefComplaint: z.string().min(1).max(2000),
  patientAgeYears: z.number().int().min(0).max(130).optional(),
  patientSex: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  vitals: vitalsSchema,
});

const triageOutputSchema = z.object({
  suggestion: z.literal(true),
  esiScore: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  esiReasoning: z.string().min(1).max(2000),
  candidateIcd10Codes: z.array(candidateIcd10Schema).max(10),
  suggestedWorkup: z.array(z.string().min(1).max(200)).max(20),
  recognizedPhrases: z.array(phraseMatchSchema),
});

export type TriageInput = z.infer<typeof triageInputSchema>;
export type TriageOutput = z.infer<typeof triageOutputSchema>;

// ─── Tool: analyzeSymptoms (LLM) ──────────────────────────────────────────────

const analyzeInputSchema = z.object({
  chiefComplaint: z.string().min(1),
  patientAgeYears: z.number().int().optional(),
  patientSex: z.string().optional(),
  vitals: vitalsSchema,
  recognizedPhrases: z.array(phraseMatchSchema),
});

const analyzeOutputSchema = z.object({
  esiScore: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  esiReasoning: z.string().min(1),
  candidateIcd10Codes: z.array(candidateIcd10Schema).max(10),
  suggestedWorkup: z.array(z.string().min(1)).max(20),
});

const TRIAGE_SYSTEM_PROMPT = [
  'You are a clinical triage assistant for an Emergency Department in Saudi Arabia.',
  'You support both Arabic and English chief complaints.',
  '',
  'You DO NOT make clinical decisions. Every output you produce is a SUGGESTION',
  'for a licensed clinician to review and accept or reject. Do not produce',
  'definitive diagnoses or prescriptions.',
  '',
  'TASK: Given a chief complaint, optional vitals, and any Arabic medical',
  'phrases already recognised by the upstream NLP layer, produce:',
  '  1. ESI score (Emergency Severity Index 1=immediate resuscitation,',
  '     2=high risk, 3=urgent, 4=less urgent, 5=non-urgent).',
  '  2. A short reasoning sentence explaining the ESI score.',
  '  3. Up to 5 candidate ICD-10 codes with display + confidence (0..1).',
  '  4. Suggested workup items (labs, imaging, vitals to recheck).',
  '',
  'Respond with ONLY valid JSON matching the schema below. No prose, no markdown.',
  '{',
  '  "esiScore": 1|2|3|4|5,',
  '  "esiReasoning": "string",',
  '  "candidateIcd10Codes": [{"code":"R07.9","display":"Chest pain unspecified","confidence":0.7}],',
  '  "suggestedWorkup": ["12-lead ECG","Troponin"]',
  '}',
].join('\n');

function buildAnalyzeUserMessage(input: z.infer<typeof analyzeInputSchema>): string {
  const lines: string[] = [];
  lines.push(`Chief complaint: ${input.chiefComplaint}`);
  if (input.patientAgeYears !== undefined) lines.push(`Age: ${input.patientAgeYears} years`);
  if (input.patientSex) lines.push(`Sex: ${input.patientSex}`);
  if (input.vitals) {
    const v = input.vitals;
    const parts: string[] = [];
    if (v.hr !== undefined) parts.push(`HR=${v.hr}`);
    if (v.bp) parts.push(`BP=${v.bp}`);
    if (v.temp !== undefined) parts.push(`Temp=${v.temp}°C`);
    if (v.spo2 !== undefined) parts.push(`SpO2=${v.spo2}%`);
    if (parts.length > 0) lines.push(`Vitals: ${parts.join(', ')}`);
  }
  if (input.recognizedPhrases.length > 0) {
    const phrases = input.recognizedPhrases
      .map(
        (p) =>
          `${p.canonical} (${p.concept_code_system}:${p.concept_code}, score=${p.score.toFixed(2)})`,
      )
      .join('; ');
    lines.push(`Recognised Arabic phrases: ${phrases}`);
  }
  lines.push('');
  lines.push('Respond with ONLY the JSON object described in the system prompt.');
  return lines.join('\n');
}

function parseModelJson(text: string): z.infer<typeof analyzeOutputSchema> {
  const trimmed = text.trim();
  // Tolerate fenced JSON if the model still wraps it (`)
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('TriageAgent: model response was not valid JSON');
  }
  return analyzeOutputSchema.parse(parsed);
}

// ─── Tool: lookupIcd10 (ontology) ─────────────────────────────────────────────

const lookupInputSchema = z.object({
  code: z.string().min(1).max(20),
});

const lookupOutputSchema = z.object({
  found: z.boolean(),
  code: z.string(),
  display: z.string().nullable(),
});

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register TriageAgent + its two tools.
 * No-op when FF_AI_AGENTS_ENABLED is OFF (registerAgent / registerTool
 * are themselves guarded — the explicit guard here keeps the call cheap).
 */
export function registerTriageAgent(): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;

  // Tool 1 — analyzeSymptoms (calls LLM)
  registerTool({
    key: TOOL_ANALYZE_KEY,
    description:
      'Calls Claude Sonnet 4.6 to produce ESI + candidate ICD-10 + workup as JSON. Suggestion-only.',
    inputSchema: analyzeInputSchema,
    outputSchema: analyzeOutputSchema,
    policyKey: 'thea_health:read',
    handler: async (input) => {
      const userMsg = buildAnalyzeUserMessage(input);
      const chat = await loadChat();
      const result = await chat(
        [{ role: 'user', content: userMsg }],
        { systemPrompt: TRIAGE_SYSTEM_PROMPT, maxTokens: 1024 },
      );
      return parseModelJson(result.text);
    },
  });

  // Tool 2 — lookupIcd10 (Phase 5.3 ontology)
  registerTool({
    key: TOOL_LOOKUP_ICD10_KEY,
    description:
      'Phase 5.3 ontology lookup for an ICD-10-AM concept by code. Returns display name when present.',
    inputSchema: lookupInputSchema,
    outputSchema: lookupOutputSchema,
    policyKey: 'thea_health:read',
    handler: async ({ code }) => {
      const concept = await findConceptByCode('ICD_10_AM', code);
      return {
        found: concept !== null,
        code,
        display: concept?.display ?? null,
      };
    },
  });

  // Agent
  registerAgent({
    key: TRIAGE_AGENT_KEY,
    name: 'Clinical Triage Agent v1',
    description:
      'Reads a chief complaint (Arabic or English) and suggests ESI score, candidate ICD-10 codes, and workup. Suggestion-only — never auto-applies.',
    version: 1,
    inputSchema: triageInputSchema,
    outputSchema: triageOutputSchema,
    policyKey: 'thea_health:read',
    handler: async (input, ctx) => {
      // Pre-process the complaint via Phase 6.1 Arabic NLP. Returns []
      // when FF_ARABIC_NLP_ENABLED is OFF — that's fine, the LLM still runs.
      let recognizedPhrases: PhraseMatch[] = [];
      try {
        recognizedPhrases = matchMedicalPhrases(input.chiefComplaint);
      } catch {
        // Lexicon not loaded at runtime — degrade silently to LLM-only.
        recognizedPhrases = [];
      }

      // Tool 1 — LLM analysis
      const analysis = (await invokeTool(
        TOOL_ANALYZE_KEY,
        {
          chiefComplaint: input.chiefComplaint,
          patientAgeYears: input.patientAgeYears,
          patientSex: input.patientSex,
          vitals: input.vitals,
          recognizedPhrases,
        },
        ctx,
      )) as z.infer<typeof analyzeOutputSchema>;

      // Tool 2 — enrich ICD-10 displays from the ontology when available.
      // Only attempted when ontology flag is on; otherwise we keep the
      // LLM-supplied display string.
      const enrichedIcd10 = await Promise.all(
        analysis.candidateIcd10Codes.map(async (cand) => {
          try {
            const lookup = (await invokeTool(
              TOOL_LOOKUP_ICD10_KEY,
              { code: cand.code },
              ctx,
            )) as z.infer<typeof lookupOutputSchema>;
            if (lookup.found && lookup.display) {
              return { ...cand, display: lookup.display };
            }
          } catch {
            // Ignore enrichment failures — the LLM display is acceptable.
          }
          return cand;
        }),
      );

      return {
        suggestion: true as const,
        esiScore: analysis.esiScore,
        esiReasoning: analysis.esiReasoning,
        candidateIcd10Codes: enrichedIcd10,
        suggestedWorkup: analysis.suggestedWorkup,
        recognizedPhrases,
      };
    },
  });
}

export {
  TRIAGE_AGENT_KEY,
  TOOL_ANALYZE_KEY,
  TOOL_LOOKUP_ICD10_KEY,
  TRIAGE_SYSTEM_PROMPT,
};
