/**
 * EHR Audit Log Model
 *
 * Tracks all mutations/actions in the EHR system for audit purposes.
 */

export interface AuditLog {
  id: string; // UUID

  // Action details
  action: string; // Action performed (e.g., 'CREATE_PATIENT', 'UPDATE_ENCOUNTER', 'GRANT_PRIVILEGE')
  resourceType: string; // Resource type (e.g., 'patient', 'encounter', 'order')
  resourceId?: string; // Resource ID (if applicable)

  // Actor
  userId: string; // User ID who performed the action
  userName?: string; // Denormalized user name
  tenantId?: string; // CRITICAL: Tenant ID for multi-tenant isolation

  // Changes
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];

  // Context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string; // Request/transaction ID for grouping related actions

  // Patient context (if applicable)
  patientId?: string;
  mrn?: string;

  // Result
  success: boolean;
  errorMessage?: string;

  // Timing
  timestamp: string; // ISO timestamp

  // Metadata
  metadata?: Record<string, any>; // Additional context
}
