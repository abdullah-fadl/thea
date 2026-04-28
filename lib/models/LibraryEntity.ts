/**
 * Unified Library Entity Model
 * 
 * This extends PolicyDocument to support universal Knowledge & Operations Core
 * across all industries, not just healthcare.
 */

import type { PolicyDocument } from './Policy';

/**
 * Extended Library Entity
 * Extends PolicyDocument with universal metadata
 */
export interface LibraryEntity extends PolicyDocument {
  // Entity classification
  entityType: 'policy' | 'sop' | 'workflow' | 'playbook';
  
  // Scope and access
  scope: 'department' | 'shared' | 'enterprise';
  departments: string[]; // Department IDs or names
  
  // Geographic and sector metadata
  sector?: string; // Industry sector
  country?: string; // ISO 3166-1 alpha-2 country code
  
  // Lifecycle management
  status: 'active' | 'expired' | 'draft' | 'archived';
  reviewCycle?: number; // Days between reviews
  lastReviewedAt?: Date;
  nextReviewDate?: Date;
  
  // Source tracking
  source: 'manual' | 'ai-generated';
  
  // Operational grouping
  operationalGroup?: string; // Group items governing the same operation
}

/**
 * Upload metadata for intelligent upload flow
 */
export interface LibraryUploadMetadata {
  scope: 'department' | 'shared' | 'enterprise';
  departments: string[];
  entityType?: 'policy' | 'sop' | 'workflow' | 'playbook';
  sector?: string;
  country?: string;
  reviewCycle?: number;
  effectiveDate?: Date;
  expiryDate?: Date;
  
  // AI-suggested classification (optional)
  aiSuggestions?: {
    entityType?: { value: string; confidence: number };
    departments?: Array<{ id: string; label: string; confidence: number }>;
    sector?: { value: string; confidence: number };
  };
}

/**
 * Bulk operation request
 */
export interface BulkOperationRequest {
  itemIds: string[];
  operation: 'delete' | 'archive' | 'reclassify' | 'update-metadata';
  metadata?: Partial<LibraryEntity>;
}

/**
 * Lifecycle alert
 */
export interface LifecycleAlert {
  id: string;
  entityId: string;
  type: 'expiry' | 'review-due' | 'conflict' | 'risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  actionRequired: boolean;
  dueDate?: Date;
  createdAt: Date;
}
