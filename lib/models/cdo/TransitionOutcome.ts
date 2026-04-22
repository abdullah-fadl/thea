/**
 * TransitionOutcome Entity (Section 16)
 * 
 * Tracks outcomes related to transitions of care (Section 10).
 * 
 * Section 10: Transitions of Care Safety
 * - Emergency → Ward
 * - Ward → ICU
 * - ICU → Ward
 * - Discharge
 * 
 * Outcome Indicators:
 * - Deterioration within 24-48 hours
 * - Medication discrepancies
 * - Readmission within defined timeframes
 */
export interface TransitionOutcome {
  id: string; // UUID

  // Patient & Visit Context
  patientId?: string; // Future: link to patient record
  erVisitId?: string; // ER visit identifier (from source visit)
  sourceRegistrationId?: string; // Source visit registration ID
  targetVisitId?: string; // Future: target visit ID if applicable

  // Transition Details
  transitionType: 
    | 'ED_TO_WARD' // Section 10: Emergency → Ward
    | 'WARD_TO_ICU' // Section 10: Ward → ICU
    | 'ICU_TO_WARD' // Section 10: ICU → Ward
    | 'DISCHARGE'; // Section 10: Discharge

  transitionTimestamp: Date; // When the transition occurred
  
  // Outcome Indicators (Section 10)
  hasDeteriorationWithin48h: boolean; // Deterioration within 24-48 hours
  deteriorationTimestamp?: Date; // When deterioration was detected
  hasMedicationDiscrepancy: boolean; // Medication discrepancies
  medicationDiscrepancyDetails?: string;
  readmissionWithinTimeframe?: {
    timeframe: '7_DAY' | '14_DAY' | '30_DAY'; // Section 12: 7-day, 14-day, 30-day readmissions
    readmissionTimestamp?: Date;
    readmissionErVisitId?: string;
  };

  // Context
  contextData?: {
    sourceCareSetting: 'ED' | 'WARD' | 'ICU';
    targetCareSetting?: 'ED' | 'WARD' | 'ICU' | 'HOME';
    ageGroup?: 'NEONATAL' | 'PEDIATRIC' | 'ADULT' | 'GERIATRIC' | 'OB_GYNE';
    dischargeDiagnosis?: string;
    [key: string]: any;
  };

  // Related Events
  relatedOutcomeId?: string; // Link to OutcomeEvent if deterioration occurred
  relatedReadmissionId?: string; // Link to ReadmissionEvent if applicable

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // System/CDO service
  updatedBy?: string;
}

