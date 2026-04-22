/**
 * ResponseTimeMetric Entity (Section 16)
 * 
 * Tracks time-based metrics for response times, escalations, and interventions.
 * 
 * Based on Section 5: Clinical Deterioration & Rescue
 * - Time to recognition
 * - Time to escalation
 * 
 * Section 15: Governance & Quality Outputs - tracks response time metrics
 */
export interface ResponseTimeMetric {
  id: string; // UUID

  // Patient & Visit Context
  patientId?: string; // Future: link to patient record
  erVisitId?: string; // ER visit identifier
  registrationId?: string; // ER registration ID

  // Metric Details
  metricType: 
    | 'TIME_TO_RECOGNITION' // Section 5
    | 'TIME_TO_ESCALATION' // Section 5
    | 'TIME_TO_ANTIBIOTICS' // Section 6 (Sepsis)
    | 'TIME_TO_INTERVENTION' // Generic
    | 'TIME_TO_RESPONSE'; // Generic

  domain: 
    | 'CLINICAL_DETERIORATION'
    | 'SEPSIS_INFECTION'
    | 'MEDICATION_EFFECTIVENESS'
    | 'PROCEDURE_SURGICAL'
    | 'ICU_HIGH_ACUITY'
    | 'TRANSITIONS_CARE'
    | 'MATERNAL_NEONATAL'
    | 'READMISSION_PATTERNS';

  // Time Measurements
  startTimestamp: Date; // When the condition/need was first detected/initiated
  endTimestamp?: Date; // When the response/action occurred
  durationMinutes?: number; // Calculated duration in minutes
  
  // Thresholds & Comparison
  policyThresholdMinutes?: number; // Policy-defined threshold (e.g., escalation within 30 min)
  exceedsThreshold: boolean; // Whether duration exceeds policy threshold
  
  // Context
  contextData?: {
    careSetting?: 'ED' | 'WARD' | 'ICU';
    ageGroup?: 'NEONATAL' | 'PEDIATRIC' | 'ADULT' | 'GERIATRIC' | 'OB_GYNE';
    severityAtStart?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    [key: string]: any;
  };

  // Related Events
  relatedPromptId?: string; // Link to ClinicalDecisionPrompt if applicable
  relatedOutcomeId?: string; // Link to OutcomeEvent if applicable

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // System/CDO service
  updatedBy?: string;
}

