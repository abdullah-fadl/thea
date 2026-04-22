/**
 * CDO Prompt Service
 * 
 * Service for managing ClinicalDecisionPrompts:
 * - Acknowledgment (Section 14: Required for high-risk prompts)
 * - Status management
 * - Alert fatigue prevention
 */

import { CDORepository } from '../repositories/CDORepository';
import { ClinicalDecisionPrompt } from '@/lib/models/cdo';

export interface AcknowledgePromptRequest {
  promptId: string;
  acknowledgedBy: string;
  acknowledgmentNotes?: string;
}

export interface PromptFilter {
  erVisitId?: string;
  domain?: ClinicalDecisionPrompt['domain'];
  severity?: ClinicalDecisionPrompt['severity'];
  status?: ClinicalDecisionPrompt['status'];
  requiresAcknowledgment?: boolean;
  limit?: number;
}

export class CDOPromptService {
  /**
   * Acknowledge a prompt (Section 14: Acknowledgment required for high-risk prompts)
   */
  static async acknowledgePrompt(request: AcknowledgePromptRequest): Promise<void> {
    const prompt = await CDORepository.getPromptById(request.promptId);
    
    if (!prompt) {
      throw new Error(`Prompt not found: ${request.promptId}`);
    }

    if (prompt.status !== 'ACTIVE') {
      throw new Error(`Prompt is not active (current status: ${prompt.status})`);
    }

    await CDORepository.acknowledgePrompt(
      request.promptId,
      request.acknowledgedBy,
      request.acknowledgmentNotes
    );
  }

  /**
   * Get prompts with filtering
   */
  static async getPrompts(filter: PromptFilter = {}): Promise<ClinicalDecisionPrompt[]> {
    if (filter.erVisitId) {
      // Get prompts for specific visit
      const prompts = await CDORepository.getPromptsByVisitId(filter.erVisitId);
      
      // Apply additional filters
      return this.applyFilters(prompts, filter);
    } else {
      // Get active prompts (optionally filtered by acknowledgment requirement)
      const prompts = await CDORepository.getActivePrompts(
        undefined,
        filter.requiresAcknowledgment
      );
      
      return this.applyFilters(prompts, filter);
    }
  }

  /**
   * Get unacknowledged high-risk prompts (for alert fatigue prevention)
   * Section 14: Alert fatigue must be actively prevented
   */
  static async getUnacknowledgedHighRiskPrompts(
    erVisitId?: string
  ): Promise<ClinicalDecisionPrompt[]> {
    const prompts = await CDORepository.getActivePrompts(erVisitId, true);
    
    // Filter for unacknowledged and high severity
    return prompts.filter(
      (p) => !p.acknowledgedAt && (p.severity === 'HIGH' || p.severity === 'CRITICAL')
    );
  }

  /**
   * Resolve a prompt (mark as resolved)
   */
  static async resolvePrompt(promptId: string, resolvedBy: string): Promise<void> {
    await CDORepository.updatePromptStatus(promptId, 'RESOLVED', resolvedBy);
  }

  /**
   * Dismiss a prompt (mark as dismissed)
   */
  static async dismissPrompt(promptId: string, dismissedBy: string): Promise<void> {
    await CDORepository.updatePromptStatus(promptId, 'DISMISSED', dismissedBy);
  }

  /**
   * Get prompt by ID
   */
  static async getPromptById(promptId: string): Promise<ClinicalDecisionPrompt | null> {
    return CDORepository.getPromptById(promptId);
  }

  /**
   * Helper: Apply filters to prompts array
   */
  private static applyFilters(
    prompts: ClinicalDecisionPrompt[],
    filter: PromptFilter
  ): ClinicalDecisionPrompt[] {
    let filtered = [...prompts];

    if (filter.domain) {
      filtered = filtered.filter((p) => p.domain === filter.domain);
    }

    if (filter.severity) {
      filtered = filtered.filter((p) => p.severity === filter.severity);
    }

    if (filter.status) {
      filtered = filtered.filter((p) => p.status === filter.status);
    }

    if (filter.requiresAcknowledgment !== undefined) {
      filtered = filtered.filter((p) => p.requiresAcknowledgment === filter.requiresAcknowledgment);
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }
}

