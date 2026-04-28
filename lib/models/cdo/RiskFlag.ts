/**
 * RiskFlag Entity (Section 16)
 * 
 * Represents a risk indicator or flag raised by the CDO analysis engine.
 * These are contextual risk markers that may trigger decision prompts.
 * 
 * Section 2: "Detect risk, deviation, and failure early"
 */
export interface RiskFlag {
  id: string; // UUID

  // Patient & Visit Context
  patientId?: string; // Future: link to patient record
  erVisitId?: string; // ER visit identifier
  registrationId?: string; // ER registration ID

  // Flag Details
  flagType: string; // e.g., "VITAL_SIGN_ABNORMALITY", "PROLONGED_ED_STAY", "REPEATED_TRIAGE"
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  category: 
    | 'VITAL_SIGNS'
    | 'TIME_BASED'
    | 'PATTERN'
    | 'DEVIATION'
    | 'OTHER';

  title: string; // Display title
  description: string; // Detailed description
  
  // Source Data
  sourceDomain: 
    | 'CLINICAL_DETERIORATION'
    | 'SEPSIS_INFECTION'
    | 'MEDICATION_EFFECTIVENESS'
    | 'PROCEDURE_SURGICAL'
    | 'ICU_HIGH_ACUITY'
    | 'TRANSITIONS_CARE'
    | 'MATERNAL_NEONATAL'
    | 'READMISSION_PATTERNS';

  // Evidence/Context
  evidenceData?: {
    // Snapshot of data that triggered this flag
    triageData?: any;
    vitalSigns?: any;
    timestamps?: {
      detected: Date;
      resolved?: Date;
    };
    [key: string]: any;
  };

  // Status
  status: 'ACTIVE' | 'RESOLVED' | 'DISMISSED';
  resolvedAt?: Date;
  resolvedBy?: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // System/CDO service
  updatedBy?: string;
}

