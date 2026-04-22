/**
 * Operational Integrity & Decision Engine Models
 * 
 * Multi-layer conflict analysis models for enterprise-wide operational integrity
 */

/**
 * Analysis Scope
 */
export type AnalysisScope = 
  | { type: 'department'; departmentIds: string[] }
  | { type: 'operation'; operationId: string }
  | { type: 'enterprise'; allDepartments: true };

/**
 * Conflict Layer Types
 */
export type ConflictLayer = 
  | 'policy'      // Policy conflicts (textual, scope, authority, temporal, regulatory)
  | 'workflow'    // Workflow/practice conflicts (duplication, contradiction, gaps)
  | 'cost'        // Cost & efficiency conflicts (waste, redundancy, bottlenecks)
  | 'coverage';   // Coverage & gap analysis (missing policies for active practices)

/**
 * Policy Conflict Types
 */
export type PolicyConflictType =
  | 'textual'      // Textual contradictions
  | 'scope'        // Scope overlaps or conflicts
  | 'authority'    // Authority conflicts (who has final say)
  | 'temporal'     // Time-based conflicts (effective dates, expiry)
  | 'regulatory';  // Regulatory compliance conflicts

/**
 * Workflow Conflict Types
 */
export type WorkflowConflictType =
  | 'duplication'   // Duplicate processes
  | 'contradiction'  // Contradictory procedures
  | 'gap';          // Missing procedures

/**
 * Cost Conflict Types
 */
export type CostConflictType =
  | 'waste'        // Wasteful processes
  | 'redundancy'   // Redundant operations
  | 'bottleneck';  // Process bottlenecks

/**
 * Coverage Gap Types
 */
export type CoverageGapType =
  | 'missing_policy'      // No policy exists for active practice
  | 'outdated_policy'     // Policy exists but is outdated
  | 'incomplete_policy'; // Policy exists but incomplete

/**
 * Conflict Severity
 */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Confidence Level
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Base Conflict Interface
 */
export interface BaseConflict {
  id: string;
  layer: ConflictLayer;
  type: string;
  severity: ConflictSeverity;
  title: string;
  summary: string;
  explanation: string; // Why this conflict exists or why none was found
  confidence: ConfidenceLevel;
  assumptions: string[]; // Assumptions made during analysis
  affectedPolicies: Array<{
    policyId: string;
    filename: string;
    role: 'primary' | 'secondary' | 'related';
  }>;
  evidence: Array<{
    policyId: string;
    filename: string;
    page?: number;
    chunkId?: string;
    quote: string;
    relevance: number;
  }>;
  scope: AnalysisScope;
  detectedAt: Date;
  tenantId: string;
}

/**
 * Policy Conflict
 */
export interface PolicyConflict extends BaseConflict {
  layer: 'policy';
  type: PolicyConflictType;
  details: {
    conflictNature: string; // Description of the conflict
    conflictingRequirements?: string[]; // Specific conflicting requirements
    regulatoryReferences?: string[]; // Regulatory standards involved
    temporalIssues?: {
      effectiveDateA?: Date;
      effectiveDateB?: Date;
      expiryDateA?: Date;
      expiryDateB?: Date;
    };
  };
}

/**
 * Workflow Conflict
 */
export interface WorkflowConflict extends BaseConflict {
  layer: 'workflow';
  type: WorkflowConflictType;
  details: {
    workflowDescription: string;
    affectedOperations: string[];
    processSteps: Array<{
      step: string;
      conflictingPolicies: string[];
    }>;
  };
}

/**
 * Cost Conflict
 */
export interface CostConflict extends BaseConflict {
  layer: 'cost';
  type: CostConflictType;
  details: {
    estimatedImpact?: {
      cost: number;
      currency: string;
      timeframe: string; // e.g., "per month", "per year"
    };
    efficiencyLoss?: {
      timeWasted: string; // e.g., "2 hours per day"
      resourceWaste: string; // Description
    };
    bottleneckDetails?: {
      location: string;
      impact: string;
    };
  };
}

/**
 * Coverage Gap
 */
export interface CoverageGap extends BaseConflict {
  layer: 'coverage';
  type: CoverageGapType;
  details: {
    practiceDescription: string;
    missingAspects: string[];
    recommendedPolicyType: string; // e.g., "SOP", "Policy", "Workflow"
    urgency: 'low' | 'medium' | 'high';
  };
}

/**
 * Union type for all conflicts
 */
export type Conflict = PolicyConflict | WorkflowConflict | CostConflict | CoverageGap;

/**
 * Decision Scenario
 */
export interface DecisionScenario {
  id: string;
  conflictGroupId: string; // Group of related conflicts
  action: 'improve' | 'merge' | 'unify' | 'redesign';
  title: string;
  description: string;
  impacts: {
    operational: {
      description: string;
      severity: ConflictSeverity;
    };
    risk: {
      description: string;
      severity: ConflictSeverity;
    };
    cost: {
      description: string;
      estimatedCost?: number;
      currency?: string;
      severity: ConflictSeverity;
    };
    compliance: {
      description: string;
      severity: ConflictSeverity;
    };
  };
  affectedPolicies: string[];
  steps: Array<{
    step: number;
    description: string;
    estimatedTime?: string;
  }>;
  confidence: ConfidenceLevel;
}

/**
 * Conflict Analysis Request
 */
export interface ConflictAnalysisRequest {
  scope: AnalysisScope;
  layers: ConflictLayer[]; // Which layers to analyze
  options?: {
    includeExplainability?: boolean;
    generateScenarios?: boolean;
    minConfidence?: ConfidenceLevel;
  };
}

/**
 * Conflict Analysis Response
 */
export interface ConflictAnalysisResponse {
  success: boolean;
  scope: AnalysisScope;
  layers: ConflictLayer[];
  conflicts: Conflict[];
  summary: {
    total: number;
    byLayer: Record<ConflictLayer, number>;
    bySeverity: Record<ConflictSeverity, number>;
  };
  explainability: {
    analysisMethod: string;
    assumptions: string[];
    confidence: ConfidenceLevel;
    justification: string; // Why conflicts were found or not found
  };
  decisionScenarios?: DecisionScenario[];
  metadata: {
    analyzedAt: Date;
    policiesAnalyzed: number;
    processingTimeMs: number;
  };
}

/**
 * Resolution Request
 */
export interface ResolutionRequest {
  scenarioId: string;
  action: 'improve' | 'merge' | 'unify' | 'redesign';
  affectedPolicyIds: string[];
  options: {
    archiveOldItems: boolean;
    deleteOldItems: boolean;
    createDraft: boolean; // If false, activate immediately
    notes?: string;
  };
}

/**
 * Resolution Response
 */
export interface ResolutionResponse {
  success: boolean;
  resolutionId: string;
  createdPolicies?: Array<{
    policyId: string;
    filename: string;
    status: 'draft' | 'active';
  }>;
  archivedPolicies?: string[];
  deletedPolicies?: string[];
  auditLog: {
    action: string;
    performedBy: string;
    performedAt: Date;
    details: string;
  };
}
