/**
 * OutcomeEvent Entity (Section 16)
 * 
 * Tracks actual patient outcomes (what happened to the patient).
 * Section 3B: Outcomes Over Activity - Track what happened to the patient.
 * 
 * Based on Section 5: Clinical Deterioration & Rescue outcomes
 * - Time to recognition
 * - Time to escalation
 * - ICU transfer after delay
 * - Cardiac arrest occurrence
 */
export interface OutcomeEvent {
  id: string; // UUID

  // Patient & Visit Context
  patientId?: string; // Future: link to patient record
  erVisitId?: string; // ER visit identifier
  registrationId?: string; // ER registration ID

  // Outcome Details
  outcomeType: 
    | 'TIME_TO_RECOGNITION' // Section 5
    | 'TIME_TO_ESCALATION' // Section 5
    | 'ICU_TRANSFER_AFTER_DELAY' // Section 5
    | 'CARDIAC_ARREST' // Section 5
    | 'SEPSIS_CONFIRMED' // Section 6
    | 'SEPSIS_MORTALITY' // Section 6
    | 'MEDICATION_HARM' // Section 7
    | 'SURGICAL_COMPLICATION' // Section 8
    | 'ICU_READMISSION' // Section 9
    | 'TRANSITION_DETERIORATION' // Section 10
    | 'MATERNAL_COMPLICATION' // Section 11
    | 'NEONATAL_COMPLICATION' // Section 11
    | 'READMISSION' // Section 12
    | 'OTHER';

  domain: 
    | 'CLINICAL_DETERIORATION'
    | 'SEPSIS_INFECTION'
    | 'MEDICATION_EFFECTIVENESS'
    | 'PROCEDURE_SURGICAL'
    | 'ICU_HIGH_ACUITY'
    | 'TRANSITIONS_CARE'
    | 'MATERNAL_NEONATAL'
    | 'READMISSION_PATTERNS';

  // Outcome Metrics
  metricValue?: number; // e.g., time in minutes, count, etc.
  metricUnit?: string; // e.g., "minutes", "days", "count"
  outcomeCategory?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  
  // Timing
  eventTimestamp: Date; // When the outcome occurred
  detectionTimestamp?: Date; // When the system detected this outcome

  // Related Data
  relatedPromptId?: string; // Link to ClinicalDecisionPrompt if triggered by a prompt
  relatedRiskFlagId?: string; // Link to RiskFlag if applicable
  
  // Context
  contextData?: {
    // Section 3C: Context Awareness (ICU vs Ward vs ED, Adult vs Pediatric)
    careSetting?: 'ED' | 'WARD' | 'ICU';
    ageGroup?: 'NEONATAL' | 'PEDIATRIC' | 'ADULT' | 'GERIATRIC' | 'OB_GYNE';
    [key: string]: any;
  };

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // System/CDO service
  updatedBy?: string;
}

