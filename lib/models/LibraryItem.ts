/**
 * LibraryItem Model - Universal Knowledge & Operations Core
 * 
 * Extends PolicyDocument with industry-agnostic metadata, classification,
 * lifecycle management, and operational intelligence.
 * 
 * Backward compatible with existing PolicyDocument structure.
 */

import type { PolicyDocument } from './Policy';

/**
 * LibraryItem - Universal entity model for all document types
 * Extends PolicyDocument with comprehensive metadata
 */
export interface LibraryItem extends PolicyDocument {
  // ============================================
  // REQUIRED FIELDS (from requirements)
  // ============================================
  itemId: string; // Alias for id (for clarity in Library context)
  tenantId: string; // Required (not optional)
  title: string; // Required

  // ============================================
  // ENTITY TYPE & CLASSIFICATION
  // ============================================
  entityType: 'policy' | 'sop' | 'workflow' | 'playbook' | 'manual' | 'other';
  
  // ============================================
  // GEOGRAPHIC & SECTOR METADATA
  // ============================================
  sector?: string; // Industry sector (healthcare, manufacturing, banking, logistics, etc.)
  country?: string; // ISO 3166-1 alpha-2 country code (optional)
  language?: string; // Auto-detected language (ISO 639-1)

  // ============================================
  // SCOPE & ACCESS CONTROL
  // ============================================
  scope: 'enterprise' | 'shared' | 'department';
  departmentIds: string[]; // Multi-select department IDs
  sharedWithDepartments?: string[]; // If scope=shared, which departments can access

  // ============================================
  // LIFECYCLE STATUS
  // ============================================
  status: 'draft' | 'active' | 'under_review' | 'expired' | 'archived' | 'ACTIVE' | 'EXPIRING_SOON' | 'UNDER_REVIEW' | 'EXPIRED' | 'ARCHIVED';
  statusUpdatedAt?: Date;
  
  // ============================================
  // DATES & REVIEW CYCLE
  // ============================================
  effectiveDate?: Date;
  expiryDate?: Date;
  reviewCycle?: number; // Days between reviews (legacy)
  reviewCycleMonths?: number; // Months between reviews
  nextReviewDate?: Date; // Calculated: lastReviewedAt + reviewCycle
  lastReviewedAt?: Date;

  // ============================================
  // VERSIONING & SOURCE
  // ============================================
  version?: string; // Version number (e.g., "1.0", "2.1")
  source: 'uploaded' | 'ai_generated' | 'imported'; // Document source

  // ============================================
  // AI SUGGESTIONS (Pre-analysis results)
  // ============================================
  aiSuggested?: {
    entityType?: { value: string; confidence: number };
    scope?: { value: 'enterprise' | 'shared' | 'department'; confidence: number };
    departments?: Array<{ id: string; label: string; confidence: number }>;
    similarItems?: Array<{
      itemId: string;
      title: string;
      similarity: number; // 0-1
      reason: string;
    }>;
    duplicateOf?: string; // itemId of duplicate item
    aiConfidenceScore?: number; // Overall confidence (0-1)
  };

  // ============================================
  // SMART CLASSIFICATION ENGINE
  // ============================================
  classification?: {
    function?: string; // Functional area (e.g., "HR", "Finance", "Operations", "Compliance")
    riskDomains?: string[]; // Risk domains (e.g., ["Data Privacy", "Safety", "Regulatory Compliance"])
    operations?: string[]; // Operations/processes (e.g., ["Patient Admission", "Order Fulfillment", "Employee Onboarding"])
    regulators?: string[]; // Regulatory bodies (e.g., ["FDA", "HIPAA", "ISO 9001", "SOC 2"])
    stage?: string; // Operational stage (e.g., "Pre-production", "Active", "Post-production")
  };

  // ============================================
  // OPERATIONAL GROUPING
  // ============================================
  operationalGroup?: string; // Group items governing the same operation/workflow

  // ============================================
  // VERSION HISTORY (for replace version feature)
  // ============================================
  versionHistory?: Array<{
    version: string;
    itemId: string; // ID of previous version
    replacedAt: Date;
    replacedBy: string; // User ID
    changeSummary?: string;
  }>;

  // ============================================
  // NOTIFICATIONS & WARNINGS
  // ============================================
  reviewReminderSent?: boolean;
  expiryWarningSent?: boolean;
  lastNotificationSentAt?: Date;
}

/**
 * AI Pre-analysis Result
 * Returned from AI classification endpoint
 */
export interface AIPreAnalysisResult {
  itemId?: string; // If analyzing existing item
  filename: string;
  status?: 'PROCESSING' | 'READY' | 'BLOCKED';
  jobId?: string; // For async processing
  error?: {
    code: string;
    message: string;
  };
  suggestions: {
    entityType: { value: string; confidence: number };
    scope: { value: 'enterprise' | 'shared' | 'department'; confidence: number };
    departments: Array<{ id: string; label: string; confidence: number; autoMatched?: boolean; requiresConfirmation?: boolean }>;
    sector?: { value: string; confidence: number };
    suggestedDepartmentName?: string; // AI-suggested department name when no match found
    classification?: {
      function?: { id: string; name: string; isNew: boolean; autoMatched?: boolean; requiresConfirmation?: boolean; confidence?: number } | string; // Can be object (with isNew, autoMatched, requiresConfirmation) or string (legacy)
      riskDomains?: Array<{ id: string; name: string; isNew: boolean; autoMatched?: boolean; requiresConfirmation?: boolean; confidence?: number }> | string[]; // Can be array of objects or strings (legacy)
      operations?: Array<{ id: string; name: string; isNew: boolean; autoMatched?: boolean; requiresConfirmation?: boolean; confidence?: number }> | string[]; // Can be array of objects or strings (legacy)
      regulators?: string[];
      stage?: string;
    };
    usedSignals?: {
      filename: boolean;
      pdfText: boolean;
      contentBased?: boolean;
      ocrUsed?: boolean;
      classificationSource?: 'ocr' | 'pdf-text' | 'filename';
    };
  };
  duplicates?: Array<{
    itemId: string;
    title: string;
    similarity: number;
    reason: string;
  }>;
  similarItems?: Array<{
    itemId: string;
    title: string;
    similarity: number;
    reason: string;
  }>;
  overallConfidence: number;
  contentSignals?: {
    pdfTextExtracted: boolean;
    ocrUsed: boolean;
    ocrProvider?: 'vision' | 'tesseract' | 'none';
    pagesProcessed: number;
    extractedChars: number;
    textLength?: number; // Deprecated, use extractedChars
  };
  extractedSnippet?: string; // Short snippet of extracted content for debugging/display
}

/**
 * Bulk Upload Item with AI Analysis
 */
export interface BulkUploadItem {
  file: File;
  metadata?: Partial<LibraryItem>;
  aiAnalysis?: AIPreAnalysisResult;
  status: 'pending' | 'analyzing' | 'ready' | 'error';
  error?: string;
}

/**
 * Upload Context (Step 2 of stepper)
 */
export interface UploadContext {
  sector?: string;
  country?: string; // ISO 3166-1 alpha-2 country code
  entityType?: 'policy' | 'sop' | 'workflow' | 'playbook' | 'manual' | 'other';
  entityTypeId?: string; // Tenant taxonomy entity type ID
  scope?: 'enterprise' | 'shared' | 'department'; // Optional in auto-classify mode
  scopeId?: string; // Tenant taxonomy scope ID
  departmentIds?: string[]; // Optional in auto-classify mode
  operations?: string[]; // Operation IDs (from taxonomy_operations)
  function?: string; // Function ID (from taxonomy_functions)
  riskDomains?: string[]; // Risk domain IDs (from taxonomy_risk_domains)
  creationContext?: {
    departmentId: string;
    operationId: string;
    requiredType: 'Policy' | 'SOP' | 'Workflow';
    scope?: 'enterprise' | 'shared' | 'department';
    source: 'gap_modal';
  };
  suggestedDepartmentName?: string; // AI-suggested department name when no match found
  sectorId?: string; // Tenant taxonomy sector ID
  effectiveDate?: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD
  version?: string;
  tagsStatus?: 'approved' | 'needs-review';
  applyToAll?: boolean; // For bulk: apply same context to all files
}

/**
 * Item Action Request
 */
export interface ItemActionRequest {
  itemId: string;
  action: 'rename' | 'edit-metadata' | 'edit-text' | 'replace-version' | 'merge' | 'convert-to-workflow' | 'link-to-risks' | 'archive' | 'delete';
  data?: {
    newName?: string;
    metadata?: Partial<LibraryItem>;
    text?: string;
    newFile?: File;
    mergeWith?: string; // itemId to merge with
    workflowDraft?: any; // Workflow draft data
    riskLinks?: string[]; // Risk IDs
  };
}

/**
 * Bulk Action Request
 */
export interface BulkActionRequest {
  itemIds: string[];
  action: 'reclassify' | 'archive' | 'delete' | 'set-expiry' | 'set-review';
  data?: {
    metadata?: Partial<LibraryItem>;
    expiryDate?: Date;
    reviewCycle?: number;
    nextReviewDate?: Date;
  };
  impactPreview?: {
    affectedItems: number;
    warnings: string[];
    estimatedTime?: string;
  };
}

/**
 * Operational View Filter
 */
export interface OperationalViewFilter {
  operation: string; // Operation/workflow name (e.g., "patient admission", "order fulfillment")
  relatedItems: LibraryItem[];
  gaps?: Array<{
    type: 'missing-policy' | 'missing-sop' | 'missing-workflow' | 'missing-playbook';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}
