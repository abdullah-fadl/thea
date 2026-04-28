/**
 * AI Engine — Main Orchestrator
 *
 * Central entry point for all AI features.
 * Manages provider selection, settings, audit logging, and rate limiting.
 */

import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import type {
  AIProviderName,
  AISettings,
  CompletionResult,
  LabInterpretation,
  RadiologyAssistance,
  PatientSummary,
  DEFAULT_AI_SETTINGS,
} from './providers/types';
import type { AIProvider } from './providers/types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { interpretLabResults, type LabInterpretationInput } from './clinical/labInterpreter';
import { assistRadiologyReport, type RadiologyAssistInput } from './clinical/radiologyAssist';
import { checkDrugInteractions, type DrugCheckInput, type DrugCheckResult } from './clinical/drugInteraction';
import { generateCDSAlerts, type CDSInput, type CDSResult } from './clinical/clinicalDecision';
import { detectPatterns, type LabDataPoint, type ClinicalPattern } from './clinical/patternDetector';
import { getDisclaimer } from './safety/disclaimer';
import {
  PATIENT_SUMMARY_SYSTEM,
  buildPatientSummaryPrompt,
} from './prompts/clinicalPrompts';

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const providers: Record<AIProviderName, AIProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
};

function getProvider(name?: AIProviderName): AIProvider {
  const providerName = name || 'openai';
  return providers[providerName];
}

// ---------------------------------------------------------------------------
// Rate Limiting (simple in-memory)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// [AI-02] Periodic cleanup to prevent unbounded memory growth from stale tenant entries
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60_000; // 5 minutes
let lastRateLimitCleanup = Date.now();

function cleanupRateLimitMap(): void {
  const now = Date.now();
  if (now - lastRateLimitCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return;
  lastRateLimitCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(tenantId: string, maxPerMinute: number = 30): boolean {
  const now = Date.now();

  // [AI-02] Periodic cleanup
  cleanupRateLimitMap();

  const entry = rateLimitMap.get(tenantId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(tenantId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Audit Logging
// ---------------------------------------------------------------------------

export interface AIAuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  feature: string;
  provider: AIProviderName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
  createdAt: Date;
}

async function logAudit(
  tenantId: string,
  entry: Omit<AIAuditEntry, 'id' | 'tenantId' | 'createdAt'>,
): Promise<void> {
  try {
    await prisma.aiAuditLog.create({
      data: {
        tenantId,
        userId: entry.userId,
        feature: entry.feature,
        provider: entry.provider,
        model: entry.model,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        totalTokens: entry.totalTokens,
        durationMs: entry.durationMs,
        success: entry.success,
        error: entry.error,
      },
    });
  } catch (error) {
    logger.error('Failed to save AI audit entry', { category: 'api', error });
  }

  logger.info('AI request completed', {
    category: 'api',
    tenantId,
    feature: entry.feature,
    durationMs: entry.durationMs,
    tokens: entry.totalTokens,
  } as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Get AI settings for a tenant from the database.
 */
export async function getAISettings(
  tenantId: string,
): Promise<AISettings> {
  try {
    const config = await prisma.aiConfig.findFirst({
      where: { tenantId, key: 'ai_settings' },
    });

    if (config) {
      // Merge with defaults (in case new fields are added)
      const { DEFAULT_AI_SETTINGS } = await import('./providers/types');
      return { ...DEFAULT_AI_SETTINGS, ...(config.settings as Record<string, unknown>) } as AISettings;
    }
  } catch (error) {
    logger.warn('Failed to load AI settings, using defaults', { category: 'api', error });
  }

  const { DEFAULT_AI_SETTINGS } = await import('./providers/types');
  return DEFAULT_AI_SETTINGS;
}

/**
 * Save AI settings for a tenant.
 */
export async function saveAISettings(
  tenantId: string,
  settings: Partial<AISettings>,
): Promise<void> {
  await prisma.aiConfig.upsert({
    where: {
      tenantId_key: { tenantId, key: 'ai_settings' },
    },
    update: {
      settings: settings as unknown as Prisma.InputJsonValue,
    },
    create: {
      tenantId,
      key: 'ai_settings',
      settings: settings as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// Core Completion Helper
// ---------------------------------------------------------------------------

/**
 * Internal helper: run an AI completion with audit logging.
 */
async function runCompletion(
  params: {
    tenantId: string;
    userId: string;
    feature: string;
    providerName?: AIProviderName;
    model?: string;
  },
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const provider = getProvider(params.providerName);
  const start = Date.now();

  if (!provider.isAvailable()) {
    // Try fallback provider
    const fallbackName: AIProviderName = params.providerName === 'anthropic' ? 'openai' : 'anthropic';
    const fallback = getProvider(fallbackName);
    if (!fallback.isAvailable()) {
      throw new Error('No AI provider available. Please configure an API key.');
    }
    logger.info(`Primary provider ${params.providerName} unavailable, falling back to ${fallbackName}`, { category: 'api' });
    return runCompletionWithProvider(fallback, params, systemPrompt, userPrompt, start);
  }

  return runCompletionWithProvider(provider, params, systemPrompt, userPrompt, start);
}

async function runCompletionWithProvider(
  provider: AIProvider,
  params: {
    tenantId: string;
    userId: string;
    feature: string;
    model?: string;
  },
  systemPrompt: string,
  userPrompt: string,
  start: number,
): Promise<string> {
  let result: CompletionResult;

  try {
    result = await provider.complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: params.model,
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: provider.name === 'openai', // Only OpenAI supports json_mode natively
    });
  } catch (error) {
    await logAudit(params.tenantId, {
      userId: params.userId,
      feature: params.feature,
      provider: provider.name,
      model: params.model || provider.defaultModel,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs: Date.now() - start,
      success: false,
      error: String(error),
    });
    throw error;
  }

  await logAudit(params.tenantId, {
    userId: params.userId,
    feature: params.feature,
    provider: result.provider,
    model: result.model,
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    totalTokens: result.usage?.totalTokens || 0,
    durationMs: Date.now() - start,
    success: true,
  });

  return result.content;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class AIEngine {
  private tenantId: string;
  private userId: string;
  private providerName?: AIProviderName;
  private model?: string;

  constructor(params: {
    tenantId: string;
    userId: string;
    providerName?: AIProviderName;
    model?: string;
  }) {
    this.tenantId = params.tenantId;
    this.userId = params.userId;
    this.providerName = params.providerName;
    this.model = params.model;
  }

  /**
   * Check if any AI provider is available.
   */
  isAvailable(): boolean {
    return Object.values(providers).some((p) => p.isAvailable());
  }

  /**
   * Check rate limit for this tenant.
   */
  checkRateLimit(maxPerMinute?: number): boolean {
    return checkRateLimit(this.tenantId, maxPerMinute);
  }

  /**
   * Raw completion (for custom prompts).
   */
  async complete(systemPrompt: string, userPrompt: string, feature: string = 'custom'): Promise<string> {
    return runCompletion(
      {
        tenantId: this.tenantId,
        userId: this.userId,
        feature,
        providerName: this.providerName,
        model: this.model,
      },
      systemPrompt,
      userPrompt,
    );
  }

  /**
   * Interpret lab results.
   */
  async interpretLabs(input: LabInterpretationInput): Promise<LabInterpretation> {
    const completeFn = (system: string, user: string) =>
      runCompletion(
        {
          tenantId: this.tenantId,
          userId: this.userId,
          feature: 'lab_interpretation',
          providerName: this.providerName,
          model: this.model,
        },
        system,
        user,
      );

    return interpretLabResults(input, completeFn);
  }

  /**
   * Assist with radiology report.
   */
  async assistRadiology(input: RadiologyAssistInput): Promise<RadiologyAssistance> {
    const completeFn = (system: string, user: string) =>
      runCompletion(
        {
          tenantId: this.tenantId,
          userId: this.userId,
          feature: 'radiology_assist',
          providerName: this.providerName,
          model: this.model,
        },
        system,
        user,
      );

    return assistRadiologyReport(input, completeFn);
  }

  /**
   * Check drug interactions.
   */
  async checkDrugs(input: DrugCheckInput): Promise<DrugCheckResult> {
    const completeFn = (system: string, user: string) =>
      runCompletion(
        {
          tenantId: this.tenantId,
          userId: this.userId,
          feature: 'drug_interaction',
          providerName: this.providerName,
          model: this.model,
        },
        system,
        user,
      );

    return checkDrugInteractions(input, completeFn);
  }

  /**
   * Generate CDS alerts.
   */
  async generateAlerts(input: CDSInput): Promise<CDSResult> {
    const completeFn = (system: string, user: string) =>
      runCompletion(
        {
          tenantId: this.tenantId,
          userId: this.userId,
          feature: 'clinical_decision_support',
          providerName: this.providerName,
          model: this.model,
        },
        system,
        user,
      );

    return generateCDSAlerts(input, completeFn);
  }

  /**
   * Generate patient summary.
   */
  async summarizePatient(input: Parameters<typeof buildPatientSummaryPrompt>[0]): Promise<PatientSummary> {
    const userPrompt = buildPatientSummaryPrompt(input);

    try {
      const raw = await runCompletion(
        {
          tenantId: this.tenantId,
          userId: this.userId,
          feature: 'patient_summary',
          providerName: this.providerName,
          model: this.model,
        },
        PATIENT_SUMMARY_SYSTEM,
        userPrompt,
      );

      return parsePatientSummary(raw);
    } catch (error) {
      logger.error('Patient summary generation failed', { category: 'api', error });
      return {
        overview: {
          ar: 'تعذر إنشاء الملخص آلياً',
          en: 'Automated summary generation failed',
        },
        activeDiagnoses: input.diagnoses || [],
        currentMedications: input.medications || [],
        recentLabs: [],
        recentRadiology: [],
        alerts: [],
        disclaimer: getDisclaimer('summary', 'en'),
      };
    }
  }

  /**
   * Detect clinical patterns (rule-based, no AI call needed).
   */
  detectPatterns(labs: LabDataPoint[]): ClinicalPattern[] {
    return detectPatterns(labs);
  }
}

// ---------------------------------------------------------------------------
// Patient Summary Parser
// ---------------------------------------------------------------------------

function parsePatientSummary(raw: string): PatientSummary {
  try {
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const data = JSON.parse(jsonStr);

    return {
      overview: {
        ar: String(data.overview?.ar || ''),
        en: String(data.overview?.en || ''),
      },
      activeDiagnoses: Array.isArray(data.activeDiagnoses)
        ? data.activeDiagnoses.map(String)
        : [],
      currentMedications: Array.isArray(data.currentMedications)
        ? data.currentMedications.map(String)
        : [],
      recentLabs: Array.isArray(data.recentLabs)
        ? data.recentLabs.map((l: Record<string, unknown>) => ({
            test: String(l.test || ''),
            value: String(l.value || ''),
            status: String(l.status || 'normal'),
          }))
        : [],
      recentRadiology: Array.isArray(data.recentRadiology)
        ? data.recentRadiology.map((r: Record<string, unknown>) => ({
            study: String(r.study || ''),
            impression: String(r.impression || ''),
          }))
        : [],
      alerts: Array.isArray(data.alerts) ? data.alerts.map(String) : [],
      disclaimer: String(data.disclaimer || getDisclaimer('summary', 'en')),
    };
  } catch {
    return {
      overview: {
        ar: 'تعذر تحليل الملخص',
        en: 'Failed to parse summary',
      },
      activeDiagnoses: [],
      currentMedications: [],
      recentLabs: [],
      recentRadiology: [],
      alerts: [],
      disclaimer: getDisclaimer('summary', 'en'),
    };
  }
}
