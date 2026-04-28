/**
 * Policy Library - MongoDB Schemas
 */
export interface PolicyDocument {
  id: string; // UUID (MongoDB document ID)
  documentId: string; // POL-2025-XXXXXX
  
  // CRITICAL: Link to thea-engine (source of truth for files/OCR/chunks/indexing)
  theaEngineId?: string; // Policy ID from thea-engine (required for unified system)

  title: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string; // storage/policies/YYYY/... (legacy, thea-engine manages files now)
  fileSize: number;
  fileHash: string; // SHA-256, unique
  mimeType: string;

  totalPages: number;
  chunksCount?: number;

  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  processingError?: string;

  storageYear: number;

  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;

  isActive: boolean;
  deletedAt?: Date | null;
  archivedAt?: Date | null; // Archive timestamp (soft delete alternative)
  archivedBy?: string; // User who archived the document
  
  tenantId?: string; // Tenant isolation - from session
  
  // Lifecycle tracking
  lastReviewedAt?: Date; // Last review date
  nextReviewDate?: Date; // Calculated: lastReviewedAt + reviewCycle
  reviewReminderSent?: boolean; // Whether review reminder was sent
  expiryWarningSent?: boolean; // Whether expiry warning was sent
  
  // Operational grouping
  operationalGroup?: string; // Group items governing the same operation

  tags?: string[];
  category?: string;
  section?: string;
  version?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  hospital?: string; // Inferred from fileName prefix (TAK, WHH, etc.)
  
  // Unified Library Entity Model (Universal Knowledge & Operations Core)
  entityType?: 'policy' | 'sop' | 'workflow' | 'playbook' | 'manual' | 'other'; // Universal entity type
  entityTypeId?: string; // Tenant taxonomy entity type ID
  scope?: 'department' | 'shared' | 'enterprise'; // Universal scope
  scopeId?: string; // Tenant taxonomy scope ID
  departments?: string[]; // Multi-select departments (preferred)
  departmentIds?: string[]; // Legacy support - maps to departments
  sector?: string; // Industry sector (e.g., 'healthcare', 'manufacturing', 'finance')
  sectorId?: string; // Tenant taxonomy sector ID
  country?: string; // Country code (ISO 3166-1 alpha-2)
  status?: 'active' | 'expired' | 'draft' | 'archived' | 'under_review' | 'ACTIVE' | 'EXPIRING_SOON' | 'UNDER_REVIEW' | 'EXPIRED' | 'ARCHIVED'; // Lifecycle status
  statusUpdatedAt?: Date; // When lifecycle status last changed
  reviewCycle?: number; // Review cycle in days (legacy)
  reviewCycleMonths?: number; // Review cycle in months
  source?: 'manual' | 'ai-generated' | string; // Document source (universal or legacy string)
  
  // Legacy classification metadata (backward compatibility)
  setting?: 'IPD' | 'OPD' | 'Corporate' | 'Shared' | 'Unknown';
  policyType?: 'Clinical' | 'Admin' | 'HR' | 'Quality' | 'IC' | 'Medication' | 'Other' | 'Unknown';
  // Legacy scope mapping: HospitalWide -> enterprise, DepartmentOnly -> department, UnitSpecific -> department
  
  // AI tagging metadata
  aiTags?: {
    departments?: Array<{ id: string; label: string; confidence: number }>;
    setting?: { value: string; confidence: number };
    type?: { value: string; confidence: number };
    scope?: { value: string; confidence: number };
    overallConfidence?: number;
    model?: string;
    createdAt?: string;
  };
  classification?: Record<string, any>;
  tagsStatus?: 'auto-approved' | 'needs-review' | 'approved';
  creationContext?: {
    departmentId: string;
    operationId: string;
    requiredType: 'Policy' | 'SOP' | 'Workflow';
    scope?: 'enterprise' | 'shared' | 'department';
    source: 'gap_modal';
  };

  // Context snapshots for traceability
  orgProfileSnapshot?: Record<string, any>;
  contextRulesSnapshot?: Record<string, any>;
}

export interface PolicyChunk {
  id: string; // UUID
  policyId: string; // UUID -> policy_documents.id
  documentId: string; // POL-2025-XXXXXX

  chunkIndex: number;
  pageNumber: number; // approximate OK
  startLine: number;
  endLine: number;

  text: string;
  wordCount: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  hospital?: string; // Inferred from fileName prefix (TAK, WHH, etc.)
  tenantId?: string; // Tenant isolation - from session
}

export interface PolicySearchMatch {
  pageNumber: number;
  startLine: number;
  endLine: number;
  snippet: string;
  score?: number;
}

export interface PolicySearchResult {
  documentId: string;
  title: string;
  originalFileName: string;
  filePath: string;
  totalPages: number;
  matches: PolicySearchMatch[];
}

export interface PolicyAISource {
  documentId: string;
  title: string;
  fileName: string;
  pageNumber: number;
  startLine: number;
  endLine: number;
  snippet: string;
}

export interface PolicyAIResponse {
  answer: string;
  sources: PolicyAISource[];
  matchedDocuments: Array<{
    documentId: string;
    title: string;
    fileName: string;
  }>;
}
