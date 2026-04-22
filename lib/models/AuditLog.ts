/**
 * Audit Log Model
 * Records all security-relevant events for compliance and monitoring
 */

export type AuditAction =
  // Authentication
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'session_expired'
  | 'session_invalidated'
  
  // MFA
  | 'mfa_enroll'
  | 'mfa_verify'
  | 'mfa_disable'
  | 'mfa_backup_code_used'
  
  // User Management
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_activate'
  | 'user_deactivate'
  
  // Permission Changes
  | 'permission_grant'
  | 'permission_revoke'
  | 'role_change'
  
  // Access Control
  | 'access_denied'
  | 'scope_violation'
  | 'tenant_violation'
  
  // Security Events
  | 'rate_limit_exceeded'
  | 'account_locked'
  | 'account_unlocked'
  | 'password_change'
  | 'password_reset'
  | 'org_profile_updated'
  | 'queue_item_ack'
  | 'queue_item_assign'
  | 'queue_item_resolve'
  | 'queue_item_snooze'
  | 'draft_created'
  | 'draft_version_created'
  | 'draft_reused_from_group'
  | 'draft_published'
  | 'integrity_reset'

  // Patient Record Access (HIPAA/JCI compliance)
  | 'patient_record_access'
  | 'data_access'
  | 'data_access_error'
  | 'data_access_failed'
  | 'data_export'
  | 'break_glass_access';

export type AuditResourceType =
  | 'user'
  | 'session'
  | 'group'
  | 'hospital'
  | 'permission'
  | 'role'
  | 'policy'
  | 'data_export'
  | 'data_import'
  | 'system'
  | 'organization_profile'
  | 'queue_item'
  | 'draft_document'
  | 'patient'
  | 'encounter'
  | 'clinical_note'
  | 'lab_result'
  | 'medication';

export interface AuditLog {
  id: string; // UUID
  
  // Actor information
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  
  // Scope information
  tenantId: string;
  groupId?: string;
  hospitalId?: string;
  
  // Action details
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  
  // Request context
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  
  // Result
  success: boolean;
  errorMessage?: string;
  
  // Additional metadata (JSON)
  metadata?: Record<string, any>;
  
  // Timestamp
  timestamp: Date;
}

