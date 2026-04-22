/**
 * Practice and Risk Detector Models
 */
export interface Practice {
  id: string; // UUID
  tenantId: string; // Tenant isolation - from session
  
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  title: string;
  description: string;
  frequency: 'Rare' | 'Occasional' | 'Frequent' | 'Daily';
  ownerRole?: string;
  status: 'active' | 'archived';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Trace {
  steps: string[];
  analyzedAt?: string;
}

export interface RiskModel {
  severity: 'Low' | 'Med' | 'High' | 'Critical';
  probability: number; // 0-1
  detectability: number; // 0-1
  baseRPN: number; // Risk Priority Number
  normalizedScore: number; // 0-100
  modifiersApplied: Record<string, number>; // {"noPolicy": 0.25, etc.}
  finalScore: number; // 0-100
}

export interface AccreditationReference {
  standard: string;
  clause: string;
  description: string;
}

export interface Evidence {
  policiesReviewed: Array<{ id: string; title: string }>;
  riskModel: RiskModel;
  accreditationReferences: AccreditationReference[];
}

export interface PracticeResult {
  practiceId: string;
  status: 'Covered' | 'Partial' | 'NoPolicy' | 'Conflict';
  relatedPolicies: Array<{
    policyId: string;
    title: string;
    documentId: string;
    citations: Array<{
      pageNumber: number;
      snippet: string;
    }>;
  }>;
  severity: 'Low' | 'Med' | 'High' | 'Critical';
  likelihood: number; // 0-1
  riskScore: number; // 0-100
  recommendations: string[];
  trace: Trace;
  reason: string[];
  evidence: Evidence;
}

export interface RiskRun {
  id: string; // UUID
  tenantId: string; // Tenant isolation - from session
  
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  createdBy: string; // userId
  inputPracticeIds: string[]; // Array of Practice IDs
  resultsJson: {
    practices: PracticeResult[];
    metadata?: {
      totalPractices: number;
      policiesAnalyzed: number;
      model?: string;
      analyzedAt: string;
    };
  };
  
  createdAt: Date;
}
