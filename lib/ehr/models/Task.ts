/**
 * EHR Task Model
 *
 * Represents clinical tasks/work items.
 */

export interface Task {
  id: string; // UUID
  
  // References
  patientId?: string; // Reference to Patient.id (if patient-related)
  encounterId?: string; // Reference to Encounter.id (if encounter-related)
  orderId?: string; // Reference to Order.id (if order-related)
  mrn?: string; // Denormalized for faster queries
  
  // Task details
  title: string;
  description?: string;
  taskType: 'CLINICAL' | 'ADMINISTRATIVE' | 'FOLLOW_UP' | 'REVIEW' | 'OTHER';
  
  // Assignment
  assignedTo: string; // User ID
  assignedBy?: string; // User ID who assigned
  department?: string; // Department assignment
  
  // Status
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DEFERRED';
  
  // Timing
  dueDate?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  completedBy?: string; // User ID
  
  // Priority
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  
  // Notes
  notes?: string;
  completionNotes?: string;
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

