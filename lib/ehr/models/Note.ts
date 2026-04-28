/**
 * EHR Note Model
 *
 * Represents clinical notes/documentation.
 */

export interface Note {
  id: string; // UUID
  
  // References
  patientId: string; // Reference to Patient.id
  encounterId?: string; // Reference to Encounter.id (if encounter-based)
  mrn: string; // Denormalized for faster queries
  
  // Note details
  noteType: 'PROGRESS' | 'ADMISSION' | 'DISCHARGE' | 'CONSULTATION' | 'PROCEDURE' | 'SOAP' | 'OTHER';
  title?: string;
  content: string; // Note body/content
  
  // Author
  authoredBy: string; // User ID
  authorName?: string; // Denormalized author name
  authorTitle?: string; // Denormalized author title
  
  // Status
  status: 'DRAFT' | 'FINAL' | 'AMENDED' | 'VOIDED';
  
  // Timing
  authoredAt: string; // ISO timestamp
  signedAt?: string; // ISO timestamp (when finalized)
  amendedAt?: string; // ISO timestamp
  
  // Co-signers
  coSigners?: string[]; // Array of User IDs
  
  // Templates/Sections (optional structured data)
  sections?: {
    section: string; // e.g., 'SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN'
    content: string;
  }[];
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

