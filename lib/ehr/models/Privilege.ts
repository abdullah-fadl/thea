/**
 * EHR Privilege Model
 *
 * Represents access privileges/privileges granted to users.
 */

export interface Privilege {
  id: string; // UUID
  
  // References
  userId: string; // Reference to User.id
  grantedBy: string; // User ID who granted this privilege
  
  // Privilege details
  resource: string; // Resource type (e.g., 'patient', 'encounter', 'order')
  action: string; // Action allowed (e.g., 'view', 'create', 'edit', 'delete')
  scope?: string; // Scope (e.g., 'department', 'own', 'all')
  
  // Constraints (optional)
  departmentId?: string; // If scope is department
  expiresAt?: string; // ISO timestamp - when privilege expires
  
  // Status
  isActive: boolean;
  revokedAt?: string; // ISO timestamp
  revokedBy?: string; // User ID who revoked
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

