/**
 * ReadmissionEvent Entity (Section 16)
 * 
 * Tracks readmission events and patterns (Section 12).
 * 
 * Section 12: Readmission & Failure Patterns
 * - 7-day, 14-day, and 30-day readmissions
 * - Correlation with prior discharge decisions
 * - Failure pattern clustering
 */
export interface ReadmissionEvent {
  id: string; // UUID

  // Patient & Visit Context
  patientId?: string; // Future: link to patient record
  previousErVisitId?: string; // Previous ER visit ID (discharge visit)
  previousRegistrationId?: string; // Previous registration ID
  readmissionErVisitId: string; // Current readmission ER visit ID
  readmissionRegistrationId: string; // Current readmission registration ID

  // Readmission Details
  readmissionTimeframe: '7_DAY' | '14_DAY' | '30_DAY'; // Section 12: 7-day, 14-day, 30-day
  
  previousDischargeTimestamp: Date; // When patient was previously discharged
  readmissionTimestamp: Date; // When patient was readmitted
  
  daysSinceDischarge: number; // Calculated: days between discharge and readmission

  // Pattern Analysis
  isPotentiallyPreventable?: boolean; // Section 12: "Potentially preventable readmission pattern"
  failurePatternType?: string; // Pattern classification if applicable
  correlationWithDischargeDecision?: {
    dischargeDiagnosis?: string;
    dischargeDisposition?: string;
    relatedTransitionOutcomeId?: string; // Link to TransitionOutcome
  };

  // Context
  contextData?: {
    previousCareSetting?: 'ED' | 'WARD' | 'ICU';
    readmissionChiefComplaint?: string;
    readmissionTriageLevel?: number; // CTAS level
    ageGroup?: 'NEONATAL' | 'PEDIATRIC' | 'ADULT' | 'GERIATRIC' | 'OB_GYNE';
    [key: string]: any;
  };

  // Related Events
  relatedTransitionOutcomeId?: string; // Link to TransitionOutcome from previous discharge
  relatedOutcomeId?: string; // Link to OutcomeEvent if applicable

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // System/CDO service
  updatedBy?: string;
}

