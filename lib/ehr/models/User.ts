/**
 * EHR User Model
 *
 * Extended user model for EHR system.
 * Links to core User model but includes EHR-specific fields.
 */

export interface EHRUser {
  id: string; // UUID - matches core User.id
  
  // Link to core user (denormalized for convenience)
  userId: string; // Reference to core User.id
  email: string; // Denormalized from User
  firstName: string;
  lastName: string;
  
  // EHR-specific fields
  licenseNumber?: string; // Medical license number
  specialty?: string;
  npi?: string; // National Provider Identifier
  title?: string; // Dr., RN, etc.
  
  // Employment
  department?: string;
  role?: string; // Additional role beyond core User.role
  
  // Status
  isActive: boolean;
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

