/**
 * EHR Encounter Model
 *
 * Represents a patient encounter/visit.
 */

export interface Encounter {
  id: string; // UUID
  
  // References
  patientId: string; // Reference to Patient.id
  mrn: string; // Denormalized for faster queries
  
  // Encounter details
  encounterNumber: string; // Unique encounter identifier
  encounterType: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY' | 'AMBULATORY' | 'OTHER';
  
  // Timing
  admissionDate: string; // ISO timestamp
  dischargeDate?: string; // ISO timestamp
  status: 'PLANNED' | 'IN_PROGRESS' | 'DISCHARGED' | 'CANCELLED';
  
  // Location/Service
  department?: string;
  service?: string;
  location?: string; // Room, bed, etc.
  
  // Provider
  attendingPhysicianId?: string; // Reference to User.id
  admittingPhysicianId?: string; // Reference to User.id
  
  // Diagnosis (simplified)
  chiefComplaint?: string;
  primaryDiagnosis?: string;
  diagnosisCodes?: string[]; // ICD-10 codes
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}

