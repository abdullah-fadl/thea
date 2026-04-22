/**
 * CDO Analysis Service
 * 
 * Main service orchestrating CDO analysis workflow:
 * 1. Ingest ER data
 * 2. Run analysis (currently Clinical Deterioration only)
 * 3. Save results to CDO collections
 * 
 * Section 2: CDO reads + analyzes + alerts only (read-only from clinical data)
 */

import { ERIngestionService, IngestedERVisit } from '../ingestion/ERIngestionService';
import { ClinicalDeteriorationAnalyzer } from '../analysis/ClinicalDeteriorationAnalyzer';
import { CDORepository } from '../repositories/CDORepository';
import { logger } from '@/lib/monitoring/logger';
import {
  ClinicalDecisionPrompt,
  OutcomeEvent,
  RiskFlag,
  ResponseTimeMetric,
} from '@/lib/models/cdo';

export interface AnalysisOptions {
  erVisitId?: string; // Analyze specific visit
  startDate?: Date; // Analyze visits from date range
  endDate?: Date;
  activeOnly?: boolean; // Analyze only active visits
  limit?: number; // Limit number of visits to analyze
}

export interface AnalysisResult {
  visitsAnalyzed: number;
  riskFlagsCreated: number;
  promptsCreated: number;
  outcomesCreated: number;
  metricsCreated: number;
  errors: string[];
}

export class CDOAnalysisService {
  /**
   * Run analysis for ER visits
   * Currently supports: Clinical Deterioration & Rescue domain only
   */
  static async runAnalysis(options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      visitsAnalyzed: 0,
      riskFlagsCreated: 0,
      promptsCreated: 0,
      outcomesCreated: 0,
      metricsCreated: 0,
      errors: [],
    };

    try {
      let visits: IngestedERVisit[] = [];

      // Determine which visits to analyze
      if (options.erVisitId) {
        // Analyze specific visit
        const visit = await ERIngestionService.ingestVisit(options.erVisitId);
        if (visit) {
          visits = [visit];
        }
      } else if (options.startDate && options.endDate) {
        // Analyze visits in date range
        visits = await ERIngestionService.ingestVisitsByDateRange(
          options.startDate,
          options.endDate,
          options.limit
        );
      } else if (options.activeOnly) {
        // Analyze active visits
        visits = await ERIngestionService.ingestActiveVisits(options.limit);
      } else {
        // Default: analyze active visits
        visits = await ERIngestionService.ingestActiveVisits(options.limit || 100);
      }

      result.visitsAnalyzed = visits.length;

      // Analyze each visit
      for (const visit of visits) {
        try {
          // Run Clinical Deterioration analysis (only domain currently supported)
          const analysisResult = ClinicalDeteriorationAnalyzer.analyze(visit);

          // Save risk flags
          for (const flag of analysisResult.riskFlags) {
            await CDORepository.saveRiskFlag(flag);
            result.riskFlagsCreated++;
          }

          // Save decision prompts
          for (const prompt of analysisResult.decisionPrompts) {
            await CDORepository.savePrompt(prompt);
            result.promptsCreated++;
          }

          // Save outcome events
          for (const outcome of analysisResult.outcomeEvents) {
            await CDORepository.saveOutcomeEvent(outcome);
            result.outcomesCreated++;
          }

          // Save response time metrics
          for (const metric of analysisResult.responseTimeMetrics) {
            await CDORepository.saveResponseTimeMetric(metric);
            result.metricsCreated++;
          }
        } catch (error: any) {
          const errorMsg = `Error analyzing visit ${visit.erVisitId}: ${error.message}`;
          logger.error(errorMsg, { category: 'general', error });
          result.errors.push(errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = `Error in analysis service: ${error.message}`;
      logger.error(errorMsg, { category: 'general', error });
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Analyze a single ER visit and return results (without saving)
   * Useful for preview/testing
   */
  static async analyzeVisitPreview(erVisitId: string): Promise<{
    visit: IngestedERVisit | null;
    riskFlags: RiskFlag[];
    prompts: ClinicalDecisionPrompt[];
    outcomes: OutcomeEvent[];
    metrics: ResponseTimeMetric[];
  }> {
    const visit = await ERIngestionService.ingestVisit(erVisitId);
    
    if (!visit) {
      return {
        visit: null,
        riskFlags: [],
        prompts: [],
        outcomes: [],
        metrics: [],
      };
    }

    const analysisResult = ClinicalDeteriorationAnalyzer.analyze(visit);

    return {
      visit,
      riskFlags: analysisResult.riskFlags,
      prompts: analysisResult.decisionPrompts,
      outcomes: analysisResult.outcomeEvents,
      metrics: analysisResult.responseTimeMetrics,
    };
  }

  /**
   * Check domain availability
   * Returns which domains are available based on data sources
   */
  static getAvailableDomains(): {
    domain: string;
    available: boolean;
    reason?: string;
  }[] {
    return [
      {
        domain: 'CLINICAL_DETERIORATION',
        available: true,
        reason: 'ER data (triage, vitals, notes) available',
      },
      {
        domain: 'SEPSIS_INFECTION',
        available: false,
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - Lab results, medications not available',
      },
      {
        domain: 'MEDICATION_EFFECTIVENESS',
        available: false,
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - Medications data not available',
      },
      {
        domain: 'PROCEDURE_SURGICAL',
        available: false,
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - Procedures data not available',
      },
      {
        domain: 'ICU_HIGH_ACUITY',
        available: false,
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - ICU data not available',
      },
      {
        domain: 'TRANSITIONS_CARE',
        available: false, // Could be partially available if we track dispositions, but not fully
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - Transfers, discharges data not fully available',
      },
      {
        domain: 'MATERNAL_NEONATAL',
        available: false,
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - OB/Gyne, NICU data not available',
      },
      {
        domain: 'READMISSION_PATTERNS',
        available: false, // Could be partially available if we track readmissions, but not fully
        reason: 'NOT_AVAILABLE_SOURCE_MISSING - Readmission tracking not fully available',
      },
    ];
  }
}

