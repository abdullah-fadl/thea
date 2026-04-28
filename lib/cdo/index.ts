/**
 * CDO Module Exports
 * 
 * Central export point for CDO (Clinical Decision & Outcomes) module.
 */

// Models
export type { 
  ClinicalDecisionPrompt,
  OutcomeEvent,
  RiskFlag,
  ResponseTimeMetric,
  TransitionOutcome,
  ReadmissionEvent,
  QualityIndicator,
} from '../models/cdo';

// Repositories
export { ERRepository } from './repositories/ERRepository';
export { CDORepository } from './repositories/CDORepository';

// Services
export { ERIngestionService } from './ingestion/ERIngestionService';
export { ClinicalDeteriorationAnalyzer } from './analysis/ClinicalDeteriorationAnalyzer';
export { CDOAnalysisService } from './services/CDOAnalysisService';
export { CDOPromptService } from './services/CDOPromptService';
export { CDODashboardService } from './services/CDODashboardService';

