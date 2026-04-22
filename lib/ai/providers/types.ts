/**
 * AI Provider Types
 *
 * Defines a common interface for all AI providers (Claude, OpenAI, etc.)
 * so the AI engine can swap providers without changing business logic.
 */

// ---------------------------------------------------------------------------
// Provider Configuration
// ---------------------------------------------------------------------------

export type AIProviderName = 'anthropic' | 'openai';

export interface AIProviderConfig {
  provider: AIProviderName;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Chat Messages
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** JSON mode — provider will return valid JSON */
  jsonMode?: boolean;
}

export interface CompletionResult {
  content: string;
  provider: AIProviderName;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface AIProvider {
  readonly name: AIProviderName;
  readonly defaultModel: string;

  /** Check if the provider is configured and ready */
  isAvailable(): boolean;

  /** Send a chat completion request */
  complete(options: CompletionOptions): Promise<CompletionResult>;
}

// ---------------------------------------------------------------------------
// Bilingual Text
// ---------------------------------------------------------------------------

export interface BilingualText {
  ar: string;
  en: string;
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceScore {
  value: number;       // 0–1
  level: ConfidenceLevel;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Clinical AI Types
// ---------------------------------------------------------------------------

export interface LabInterpretation {
  summary: BilingualText;
  findings: {
    testCode: string;
    status: 'normal' | 'abnormal_high' | 'abnormal_low' | 'critical';
    interpretation: BilingualText;
    clinicalSignificance: 'low' | 'moderate' | 'high';
  }[];
  patterns: {
    name: string;
    description: BilingualText;
    confidence: number;
    suggestedFollowUp: string[];
  }[];
  disclaimer: string;
}

export interface RadiologyAssistance {
  suggestedFindings: {
    finding: BilingualText;
    location: string;
    confidence: number;
    severity: 'incidental' | 'moderate' | 'urgent';
  }[];
  suggestedImpression: BilingualText;
  comparisons: string[];
  criticalAlert?: {
    finding: string;
    action: string;
  };
}

export interface CDSAlert {
  id: string;
  type: 'drug_interaction' | 'allergy' | 'duplicate_order' | 'clinical_pattern' | 'guideline';
  severity: 'info' | 'warning' | 'critical';
  title: BilingualText;
  description: BilingualText;
  suggestedAction: BilingualText;
  evidence?: string;
  overridable: boolean;
  patientId: string;
  encounterId?: string;
  triggeredBy: string;
  createdAt: Date;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: BilingualText;
  mechanism?: string;
  management: BilingualText;
}

export interface PatientSummary {
  overview: BilingualText;
  activeDiagnoses: string[];
  currentMedications: string[];
  recentLabs: { test: string; value: string; status: string }[];
  recentRadiology: { study: string; impression: string }[];
  alerts: string[];
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// AI Settings
// ---------------------------------------------------------------------------

export interface AISettings {
  enabled: boolean;
  provider: AIProviderName;
  anthropicModel: string;
  openaiModel: string;
  features: {
    labInterpretation: boolean;
    radiologyAssist: boolean;
    clinicalDecisionSupport: boolean;
    patientSummary: boolean;
    drugInteraction: boolean;
  };
  departments: string[];       // Empty = all departments
  auditEnabled: boolean;
  maxRequestsPerMinute: number;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: true,
  provider: 'openai',
  anthropicModel: 'claude-sonnet-4-20250514',
  openaiModel: 'gpt-4o-mini',
  features: {
    labInterpretation: true,
    radiologyAssist: true,
    clinicalDecisionSupport: true,
    patientSummary: true,
    drugInteraction: true,
  },
  departments: [],
  auditEnabled: true,
  maxRequestsPerMinute: 30,
};
