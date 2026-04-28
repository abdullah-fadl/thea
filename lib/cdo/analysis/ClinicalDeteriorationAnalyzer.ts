/**
 * Clinical Deterioration Analyzer
 * 
 * Rule-based analysis engine for Clinical Deterioration & Rescue domain (Section 5).
 * Currently supports ED context only (based on available ER data).
 * 
 * Section 5: Clinical Deterioration & Rescue
 * - Read early warning signals
 * - Track response times
 * - Detect failure to rescue
 * 
 * Decision Prompts:
 * - "Early deterioration detected - reassessment overdue"
 * - "Escalation delayed beyond policy threshold"
 * 
 * Outcomes Tracked:
 * - Time to recognition
 * - Time to escalation
 * - ICU transfer after delay
 * - Cardiac arrest occurrence
 */

import { IngestedERVisit } from '../ingestion/ERIngestionService';
import { RiskFlag, ClinicalDecisionPrompt, OutcomeEvent, ResponseTimeMetric } from '@/lib/models/cdo';
import { v4 as uuidv4 } from 'uuid';

export interface DeteriorationAnalysisResult {
  riskFlags: RiskFlag[];
  decisionPrompts: ClinicalDecisionPrompt[];
  outcomeEvents: OutcomeEvent[];
  responseTimeMetrics: ResponseTimeMetric[];
}

/**
 * Policy thresholds for clinical deterioration (configurable)
 */
const POLICY_THRESHOLDS = {
  // Time thresholds (in minutes)
  REASSESSMENT_OVERDUE_MINUTES: 120, // 2 hours - reassessment overdue
  ESCALATION_DELAY_MINUTES: 30, // 30 minutes - escalation delay threshold
  PROLONGED_ED_STAY_HOURS: 6, // 6 hours - prolonged ED stay flag
  
  // Vital sign thresholds (context-aware based on age group)
  VITAL_SIGNS: {
    ADULT: {
      HEART_RATE_MIN: 60,
      HEART_RATE_MAX: 100,
      RESPIRATORY_RATE_MIN: 12,
      RESPIRATORY_RATE_MAX: 20,
      OXYGEN_SATURATION_MIN: 95,
      TEMPERATURE_MIN: 36.1,
      TEMPERATURE_MAX: 37.2,
    },
    PEDIATRIC: {
      HEART_RATE_MIN: 70,
      HEART_RATE_MAX: 120,
      RESPIRATORY_RATE_MIN: 16,
      RESPIRATORY_RATE_MAX: 30,
      OXYGEN_SATURATION_MIN: 95,
      TEMPERATURE_MIN: 36.5,
      TEMPERATURE_MAX: 37.5,
    },
    GERIATRIC: {
      HEART_RATE_MIN: 55,
      HEART_RATE_MAX: 95,
      RESPIRATORY_RATE_MIN: 12,
      RESPIRATORY_RATE_MAX: 18,
      OXYGEN_SATURATION_MIN: 93,
      TEMPERATURE_MIN: 36.0,
      TEMPERATURE_MAX: 37.0,
    },
  },
  
  // CTAS level thresholds
  HIGH_SEVERITY_CTAS: [1, 2], // CTAS 1-2 are high severity
  CRITICAL_CTAS: [1], // CTAS 1 is critical
};

export class ClinicalDeteriorationAnalyzer {
  /**
   * Analyze a single ER visit for clinical deterioration indicators
   */
  static analyze(visit: IngestedERVisit, now: Date = new Date()): DeteriorationAnalysisResult {
    const riskFlags: RiskFlag[] = [];
    const decisionPrompts: ClinicalDecisionPrompt[] = [];
    const outcomeEvents: OutcomeEvent[] = [];
    const responseTimeMetrics: ResponseTimeMetric[] = [];

    // Skip if no triage data (cannot analyze without triage)
    if (!visit.triage) {
      return { riskFlags, decisionPrompts, outcomeEvents, responseTimeMetrics };
    }

    // 1. Analyze vital signs for abnormalities
    const vitalSignFlags = this.analyzeVitalSigns(visit, now);
    riskFlags.push(...vitalSignFlags);

    // 2. Analyze time-based patterns
    const timeBasedFlags = this.analyzeTimeBasedPatterns(visit, now);
    riskFlags.push(...timeBasedFlags);

    // 3. Generate decision prompts based on detected patterns
    const prompts = this.generateDecisionPrompts(visit, riskFlags, now);
    decisionPrompts.push(...prompts);

    // 4. Calculate response time metrics
    const metrics = this.calculateResponseTimeMetrics(visit, now);
    responseTimeMetrics.push(...metrics);

    // 5. Detect outcome events (if applicable)
    const outcomes = this.detectOutcomeEvents(visit, now);
    outcomeEvents.push(...outcomes);

    return {
      riskFlags,
      decisionPrompts,
      outcomeEvents,
      responseTimeMetrics,
    };
  }

  /**
   * Analyze vital signs for abnormalities
   * Section 3C: Context-aware (different thresholds for Adult vs Pediatric vs Geriatric)
   */
  private static analyzeVitalSigns(visit: IngestedERVisit, now: Date): RiskFlag[] {
    const flags: RiskFlag[] = [];
    const triage = visit.triage!;
    
    if (!triage.heartRate && !triage.respiratoryRate && !triage.oxygenSaturation && !triage.temperature) {
      return flags; // No vital signs data
    }

    // Get appropriate thresholds based on age group
    const thresholds = this.getVitalSignThresholds(visit.ageGroup || 'ADULT');

    // Check heart rate
    if (triage.heartRate !== undefined) {
      if (triage.heartRate < thresholds.HEART_RATE_MIN || triage.heartRate > thresholds.HEART_RATE_MAX) {
        flags.push(this.createRiskFlag(
          visit,
          'VITAL_SIGN_ABNORMALITY',
          triage.heartRate < thresholds.HEART_RATE_MIN ? 'HIGH' : 'MEDIUM',
          'Abnormal Heart Rate',
          `Heart rate of ${triage.heartRate} bpm is outside normal range (${thresholds.HEART_RATE_MIN}-${thresholds.HEART_RATE_MAX} bpm) for ${visit.ageGroup || 'adult'} patients.`,
          { heartRate: triage.heartRate, threshold: thresholds }
        ));
      }
    }

    // Check respiratory rate
    if (triage.respiratoryRate !== undefined) {
      if (triage.respiratoryRate < thresholds.RESPIRATORY_RATE_MIN || triage.respiratoryRate > thresholds.RESPIRATORY_RATE_MAX) {
        flags.push(this.createRiskFlag(
          visit,
          'VITAL_SIGN_ABNORMALITY',
          triage.respiratoryRate < thresholds.RESPIRATORY_RATE_MIN ? 'HIGH' : 'MEDIUM',
          'Abnormal Respiratory Rate',
          `Respiratory rate of ${triage.respiratoryRate} bpm is outside normal range (${thresholds.RESPIRATORY_RATE_MIN}-${thresholds.RESPIRATORY_RATE_MAX} bpm) for ${visit.ageGroup || 'adult'} patients.`,
          { respiratoryRate: triage.respiratoryRate, threshold: thresholds }
        ));
      }
    }

    // Check oxygen saturation
    if (triage.oxygenSaturation !== undefined) {
      if (triage.oxygenSaturation < thresholds.OXYGEN_SATURATION_MIN) {
        flags.push(this.createRiskFlag(
          visit,
          'VITAL_SIGN_ABNORMALITY',
          triage.oxygenSaturation < 90 ? 'CRITICAL' : 'HIGH',
          'Low Oxygen Saturation',
          `Oxygen saturation of ${triage.oxygenSaturation}% is below normal threshold (${thresholds.OXYGEN_SATURATION_MIN}%) for ${visit.ageGroup || 'adult'} patients.`,
          { oxygenSaturation: triage.oxygenSaturation, threshold: thresholds }
        ));
      }
    }

    // Check temperature
    if (triage.temperature !== undefined) {
      if (triage.temperature < thresholds.TEMPERATURE_MIN || triage.temperature > thresholds.TEMPERATURE_MAX) {
        flags.push(this.createRiskFlag(
          visit,
          'VITAL_SIGN_ABNORMALITY',
          triage.temperature > 38.5 ? 'HIGH' : 'MEDIUM',
          'Abnormal Temperature',
          `Temperature of ${triage.temperature}°C is outside normal range (${thresholds.TEMPERATURE_MIN}-${thresholds.TEMPERATURE_MAX}°C) for ${visit.ageGroup || 'adult'} patients.`,
          { temperature: triage.temperature, threshold: thresholds }
        ));
      }
    }

    // Check CTAS level (high severity)
    if (triage.ctasLevel && POLICY_THRESHOLDS.HIGH_SEVERITY_CTAS.includes(triage.ctasLevel)) {
      flags.push(this.createRiskFlag(
        visit,
        'HIGH_SEVERITY_TRIAGE',
        triage.ctasLevel === 1 ? 'CRITICAL' : 'HIGH',
        'High Severity Triage Level',
        `Patient has CTAS level ${triage.ctasLevel} (${triage.ctasLevel === 1 ? 'Resuscitation' : 'Emergent'} priority).`,
        { ctasLevel: triage.ctasLevel }
      ));
    }

    return flags;
  }

  /**
   * Analyze time-based patterns (Section 5: Track response times)
   */
  private static analyzeTimeBasedPatterns(visit: IngestedERVisit, now: Date): RiskFlag[] {
    const flags: RiskFlag[] = [];
    
    // 1. Prolonged ED stay
    if (visit.timestamps.registration) {
      const edStayHours = (now.getTime() - visit.timestamps.registration.getTime()) / (1000 * 60 * 60);
      
      if (edStayHours > POLICY_THRESHOLDS.PROLONGED_ED_STAY_HOURS && !visit.disposition) {
        flags.push(this.createRiskFlag(
          visit,
          'PROLONGED_ED_STAY',
          'MEDIUM',
          'Prolonged ED Stay',
          `Patient has been in ED for ${edStayHours.toFixed(1)} hours, exceeding threshold of ${POLICY_THRESHOLDS.PROLONGED_ED_STAY_HOURS} hours.`,
          { edStayHours, thresholdHours: POLICY_THRESHOLDS.PROLONGED_ED_STAY_HOURS }
        ));
      }
    }

    // 2. Reassessment overdue (Section 5: "Early deterioration detected - reassessment overdue")
    if (visit.timestamps.triage && visit.timestamps.latestProgressNote) {
      const timeSinceLastNote = (now.getTime() - visit.timestamps.latestProgressNote.getTime()) / (1000 * 60);
      
      if (timeSinceLastNote > POLICY_THRESHOLDS.REASSESSMENT_OVERDUE_MINUTES) {
        flags.push(this.createRiskFlag(
          visit,
          'REASSESSMENT_OVERDUE',
          'HIGH',
          'Reassessment Overdue',
          `Last progress note was ${(timeSinceLastNote / 60).toFixed(1)} hours ago. Reassessment is overdue (>${POLICY_THRESHOLDS.REASSESSMENT_OVERDUE_MINUTES} minutes).`,
          { minutesSinceLastNote: timeSinceLastNote, thresholdMinutes: POLICY_THRESHOLDS.REASSESSMENT_OVERDUE_MINUTES }
        ));
      }
    } else if (visit.timestamps.triage) {
      // No progress notes after triage - flag for initial assessment
      const timeSinceTriage = (now.getTime() - visit.timestamps.triage.getTime()) / (1000 * 60);
      
      if (timeSinceTriage > POLICY_THRESHOLDS.REASSESSMENT_OVERDUE_MINUTES) {
        flags.push(this.createRiskFlag(
          visit,
          'INITIAL_ASSESSMENT_OVERDUE',
          'HIGH',
          'Initial Assessment Overdue',
          `Patient was triaged ${(timeSinceTriage / 60).toFixed(1)} hours ago but no progress notes have been recorded. Initial assessment is overdue.`,
          { timeSinceTriage, thresholdMinutes: POLICY_THRESHOLDS.REASSESSMENT_OVERDUE_MINUTES }
        ));
      }
    }

    return flags;
  }

  /**
   * Generate decision prompts based on detected risk flags
   * Section 5: Decision Prompts
   */
  private static generateDecisionPrompts(
    visit: IngestedERVisit,
    riskFlags: RiskFlag[],
    now: Date
  ): ClinicalDecisionPrompt[] {
    const prompts: ClinicalDecisionPrompt[] = [];

    // Prompt 1: "Early deterioration detected - reassessment overdue" (Section 5)
    const reassessmentFlag = riskFlags.find(f => 
      f.flagType === 'REASSESSMENT_OVERDUE' || f.flagType === 'INITIAL_ASSESSMENT_OVERDUE'
    );
    
    if (reassessmentFlag) {
      prompts.push(this.createDecisionPrompt(
        visit,
        'CLINICAL_DETERIORATION',
        'EARLY_DETERIORATION_DETECTED',
        'Early deterioration detected - reassessment overdue',
        reassessmentFlag.description,
        reassessmentFlag.severity,
        reassessmentFlag.severity === 'HIGH' || reassessmentFlag.severity === 'CRITICAL',
        { relatedRiskFlagId: reassessmentFlag.id }
      ));
    }

    // Prompt 2: "Escalation delayed beyond policy threshold" (Section 5)
    // This would be generated if we detect a delay in escalation (e.g., high CTAS but no ICU transfer)
    const highSeverityFlag = riskFlags.find(f => 
      f.flagType === 'HIGH_SEVERITY_TRIAGE' && f.severity === 'CRITICAL'
    );
    
    if (highSeverityFlag && visit.timestamps.triage && !visit.disposition) {
      const timeSinceTriage = (now.getTime() - visit.timestamps.triage.getTime()) / (1000 * 60);
      
      if (timeSinceTriage > POLICY_THRESHOLDS.ESCALATION_DELAY_MINUTES) {
        prompts.push(this.createDecisionPrompt(
          visit,
          'CLINICAL_DETERIORATION',
          'ESCALATION_DELAYED',
          'Escalation delayed beyond policy threshold',
          `Patient with CTAS level ${visit.triage!.ctasLevel} has been in ED for ${(timeSinceTriage / 60).toFixed(1)} hours without disposition. Escalation may be delayed beyond policy threshold (${POLICY_THRESHOLDS.ESCALATION_DELAY_MINUTES} minutes).`,
          'HIGH',
          true, // Requires acknowledgment
          { relatedRiskFlagId: highSeverityFlag.id, timeSinceTriageMinutes: timeSinceTriage }
        ));
      }
    }

    // Prompt for critical vital signs
    const criticalVitalFlag = riskFlags.find(f => 
      f.flagType === 'VITAL_SIGN_ABNORMALITY' && f.severity === 'CRITICAL'
    );
    
    if (criticalVitalFlag) {
      prompts.push(this.createDecisionPrompt(
        visit,
        'CLINICAL_DETERIORATION',
        'CRITICAL_VITAL_SIGN',
        'Critical vital sign abnormality detected',
        criticalVitalFlag.description,
        'CRITICAL',
        true, // Requires acknowledgment
        { relatedRiskFlagId: criticalVitalFlag.id }
      ));
    }

    return prompts;
  }

  /**
   * Calculate response time metrics (Section 5: Outcomes Tracked)
   */
  private static calculateResponseTimeMetrics(visit: IngestedERVisit, now: Date): ResponseTimeMetric[] {
    const metrics: ResponseTimeMetric[] = [];

    // Metric 1: Time to recognition (registration to triage)
    if (visit.timestamps.registration && visit.timestamps.triage) {
      const durationMinutes = (visit.timestamps.triage.getTime() - visit.timestamps.registration.getTime()) / (1000 * 60);
      
      metrics.push({
        id: uuidv4(),
        erVisitId: visit.erVisitId,
        registrationId: visit.registrationId,
        metricType: 'TIME_TO_RECOGNITION',
        domain: 'CLINICAL_DETERIORATION',
        startTimestamp: visit.timestamps.registration,
        endTimestamp: visit.timestamps.triage,
        durationMinutes,
        policyThresholdMinutes: undefined, // No specific threshold for time to triage
        exceedsThreshold: false,
        contextData: {
          careSetting: visit.careSetting,
          ageGroup: visit.ageGroup,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: 'CDO_SERVICE',
      });
    }

    // Metric 2: Time to escalation (triage to first note or disposition, if high severity)
    if (visit.timestamps.triage && visit.triage && POLICY_THRESHOLDS.HIGH_SEVERITY_CTAS.includes(visit.triage.ctasLevel)) {
      const escalationTimestamp = visit.timestamps.firstProgressNote || visit.timestamps.disposition || now;
      const durationMinutes = (escalationTimestamp.getTime() - visit.timestamps.triage.getTime()) / (1000 * 60);
      const exceedsThreshold = durationMinutes > POLICY_THRESHOLDS.ESCALATION_DELAY_MINUTES;
      
      metrics.push({
        id: uuidv4(),
        erVisitId: visit.erVisitId,
        registrationId: visit.registrationId,
        metricType: 'TIME_TO_ESCALATION',
        domain: 'CLINICAL_DETERIORATION',
        startTimestamp: visit.timestamps.triage,
        endTimestamp: escalationTimestamp < now ? escalationTimestamp : undefined,
        durationMinutes: escalationTimestamp < now ? durationMinutes : undefined,
        policyThresholdMinutes: POLICY_THRESHOLDS.ESCALATION_DELAY_MINUTES,
        exceedsThreshold,
        contextData: {
          careSetting: visit.careSetting,
          ageGroup: visit.ageGroup,
          severityAtStart: visit.triage.ctasLevel === 1 ? 'CRITICAL' : 'HIGH',
        },
        createdAt: now,
        updatedAt: now,
        createdBy: 'CDO_SERVICE',
      });
    }

    return metrics;
  }

  /**
   * Detect outcome events (Section 5: Outcomes Tracked)
   */
  private static detectOutcomeEvents(visit: IngestedERVisit, now: Date): OutcomeEvent[] {
    const events: OutcomeEvent[] = [];

    // Outcome: ICU transfer after delay (if disposition is ICU and there was a delay)
    if (visit.disposition && visit.disposition.dispositionType === 'admit-to-icu') {
      if (visit.timestamps.triage) {
        const timeToICU = (visit.disposition.dispositionDate.getTime() - visit.timestamps.triage.getTime()) / (1000 * 60);
        
        if (timeToICU > POLICY_THRESHOLDS.ESCALATION_DELAY_MINUTES) {
          events.push({
            id: uuidv4(),
            erVisitId: visit.erVisitId,
            registrationId: visit.registrationId,
            outcomeType: 'ICU_TRANSFER_AFTER_DELAY',
            domain: 'CLINICAL_DETERIORATION',
            metricValue: timeToICU,
            metricUnit: 'minutes',
            outcomeCategory: 'NEGATIVE',
            eventTimestamp: visit.disposition.dispositionDate,
            detectionTimestamp: now,
            contextData: {
              careSetting: visit.careSetting,
              ageGroup: visit.ageGroup,
            },
            createdAt: now,
            updatedAt: now,
            createdBy: 'CDO_SERVICE',
          });
        }
      }
    }

    // Outcome: Death (if disposition is death) - Cardiac arrest is implied
    if (visit.disposition && visit.disposition.dispositionType === 'death') {
      events.push({
        id: uuidv4(),
        erVisitId: visit.erVisitId,
        registrationId: visit.registrationId,
        outcomeType: 'CARDIAC_ARREST',
        domain: 'CLINICAL_DETERIORATION',
        outcomeCategory: 'NEGATIVE',
        eventTimestamp: visit.disposition.dispositionDate,
        detectionTimestamp: now,
        contextData: {
          careSetting: visit.careSetting,
          ageGroup: visit.ageGroup,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: 'CDO_SERVICE',
      });
    }

    return events;
  }

  /**
   * Helper: Create a RiskFlag entity
   */
  private static createRiskFlag(
    visit: IngestedERVisit,
    flagType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    title: string,
    description: string,
    evidenceData: any
  ): RiskFlag {
    return {
      id: uuidv4(),
      erVisitId: visit.erVisitId,
      registrationId: visit.registrationId,
      flagType,
      severity,
      category: this.getFlagCategory(flagType),
      title,
      description,
      sourceDomain: 'CLINICAL_DETERIORATION',
      evidenceData: {
        ...evidenceData,
        triageData: visit.triage,
        vitalSigns: visit.triage ? {
          heartRate: visit.triage.heartRate,
          respiratoryRate: visit.triage.respiratoryRate,
          oxygenSaturation: visit.triage.oxygenSaturation,
          temperature: visit.triage.temperature,
        } : undefined,
        timestamps: {
          detected: new Date(),
        },
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Helper: Create a ClinicalDecisionPrompt entity
   */
  private static createDecisionPrompt(
    visit: IngestedERVisit,
    domain: ClinicalDecisionPrompt['domain'],
    promptType: string,
    title: string,
    message: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    requiresAcknowledgment: boolean,
    contextData: any
  ): ClinicalDecisionPrompt {
    return {
      id: uuidv4(),
      erVisitId: visit.erVisitId,
      registrationId: visit.registrationId,
      domain,
      promptType,
      title,
      message,
      severity,
      contextData: {
        ...contextData,
        triageData: visit.triage,
        vitalSigns: visit.triage ? {
          heartRate: visit.triage.heartRate,
          respiratoryRate: visit.triage.respiratoryRate,
          oxygenSaturation: visit.triage.oxygenSaturation,
          temperature: visit.triage.temperature,
        } : undefined,
        timestamp: new Date(),
      },
      requiresAcknowledgment,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'CDO_SERVICE',
    };
  }

  /**
   * Helper: Get vital sign thresholds based on age group
   */
  private static getVitalSignThresholds(ageGroup: string): typeof POLICY_THRESHOLDS.VITAL_SIGNS.ADULT {
    switch (ageGroup) {
      case 'PEDIATRIC':
        return POLICY_THRESHOLDS.VITAL_SIGNS.PEDIATRIC;
      case 'GERIATRIC':
        return POLICY_THRESHOLDS.VITAL_SIGNS.GERIATRIC;
      default:
        return POLICY_THRESHOLDS.VITAL_SIGNS.ADULT;
    }
  }

  /**
   * Helper: Get flag category from flag type
   */
  private static getFlagCategory(flagType: string): RiskFlag['category'] {
    if (flagType.includes('VITAL_SIGN')) return 'VITAL_SIGNS';
    if (flagType.includes('TIME') || flagType.includes('OVERDUE') || flagType.includes('STAY')) return 'TIME_BASED';
    if (flagType.includes('PATTERN')) return 'PATTERN';
    if (flagType.includes('DEVIATION')) return 'DEVIATION';
    return 'OTHER';
  }
}

