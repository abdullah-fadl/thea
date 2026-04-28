/**
 * QualityIndicator Entity (Section 16)
 * 
 * Aggregated quality indicators for governance and accreditation (Section 15).
 * 
 * Section 15: Governance & Quality Outputs
 * Key Indicators:
 * - Failure to rescue
 * - Surgical site infection rate
 * - Sepsis mortality
 * - Medication harm signals
 * - Readmission rates
 * - Endorsement-related incidents
 */
export interface QualityIndicator {
  id: string; // UUID

  // Indicator Details
  indicatorType: 
    | 'FAILURE_TO_RESCUE' // Section 15
    | 'SURGICAL_SITE_INFECTION_RATE' // Section 15
    | 'SEPSIS_MORTALITY' // Section 15
    | 'MEDICATION_HARM_SIGNALS' // Section 15
    | 'READMISSION_RATE' // Section 15
    | 'ENDORSEMENT_INCIDENTS' // Section 15
    | 'TIME_TO_RECOGNITION_AVG' // Derived from ResponseTimeMetric
    | 'TIME_TO_ESCALATION_AVG' // Derived from ResponseTimeMetric
    | 'ICU_TRANSFER_AFTER_DELAY_COUNT' // Derived from OutcomeEvent
    | 'CARDIAC_ARREST_COUNT' // Derived from OutcomeEvent
    | 'OTHER';

  // Aggregation Period
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
  periodStart: Date;
  periodEnd: Date;

  // Scope
  careSetting?: 'ED' | 'WARD' | 'ICU' | 'ALL';
  unitId?: string; // Future: specific unit/department
  serviceId?: string; // Future: specific service

  // Metric Values
  numerator: number; // Count or value for numerator (e.g., number of failures)
  denominator?: number; // Count for denominator (e.g., total patients, for rates)
  rate?: number; // Calculated rate (numerator/denominator) as percentage or ratio
  
  // Thresholds & Targets
  targetRate?: number; // Target rate/threshold
  benchmarkRate?: number; // Benchmark for comparison
  exceedsTarget: boolean; // Whether current rate exceeds target
  exceedsBenchmark: boolean; // Whether current rate exceeds benchmark

  // Trend Analysis (Section 15: Longitudinal trend analysis)
  previousPeriodValue?: number; // Value from previous period for trend calculation
  trendDirection?: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  trendPercentage?: number; // Percentage change from previous period

  // Context
  metadata?: {
    calculationMethod?: string;
    dataSource?: string; // Which entities/collections were used
    lastCalculated?: Date;
    [key: string]: any;
  };

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // System/CDO service
  updatedBy?: string;
}

