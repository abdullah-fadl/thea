/**
 * EHR Order Model
 *
 * Represents clinical orders (medications, labs, procedures, etc.).
 */

export interface Order {
  id: string; // UUID
  
  // References
  patientId: string; // Reference to Patient.id
  encounterId?: string; // Reference to Encounter.id (if encounter-based)
  mrn: string; // Denormalized for faster queries
  
  // Order details
  orderNumber: string; // Unique order identifier
  orderType: 'MEDICATION' | 'LAB' | 'IMAGING' | 'PROCEDURE' | 'CONSULT' | 'OTHER';
  
  // Content
  description: string; // Human-readable description
  code?: string; // SNOMED, LOINC, or other code
  codeSystem?: string; // Code system identifier
  
  // Provider
  orderedBy: string; // User ID who placed the order
  orderingProviderName?: string; // Denormalized provider name
  
  // Status
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISCONTINUED';
  
  // Timing
  orderedAt: string; // ISO timestamp
  startDate?: string; // ISO timestamp
  endDate?: string; // ISO timestamp
  scheduledTime?: string; // ISO timestamp
  
  // Priority
  priority?: 'ROUTINE' | 'URGENT' | 'STAT' | 'ASAP';
  
  // Additional data (flexible for different order types)
  instructions?: string;
  frequency?: string;
  quantity?: string;
  route?: string;
  duration?: string;
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

