// ─── AI Governance ──────────────────────────────────────────────────────────
// Confidence thresholds, decision logging, and human review workflow for all
// AI-assisted operations across CVision.
// Pure computation — no AI API calls, no DB, no side effects.

// ─── Types & Interfaces ────────────────────────────────────────────────────

/** All AI-powered decision types in CVision */
export type AIDecisionType =
  | 'CV_PARSING'
  | 'JOB_MATCHING'
  | 'SKILL_ASSESSMENT'
  | 'SALARY_RECOMMENDATION'
  | 'INTERVIEW_SCORING'
  | 'PERFORMANCE_PREDICTION'
  | 'TRAINING_RECOMMENDATION';

/** Labels for each decision type */
export const DECISION_TYPE_LABELS: Record<AIDecisionType, string> = {
  CV_PARSING:               'CV Parsing',
  JOB_MATCHING:             'Job Matching',
  SKILL_ASSESSMENT:         'Skill Assessment',
  SALARY_RECOMMENDATION:    'Salary Recommendation',
  INTERVIEW_SCORING:        'Interview Scoring',
  PERFORMANCE_PREDICTION:   'Performance Prediction',
  TRAINING_RECOMMENDATION:  'Training Recommendation',
};

/** Full decision log entry for audit trail */
export interface AIDecisionLog {
  id: string;
  tenantId: string;
  decisionType: AIDecisionType;
  /** Confidence score 0-100 returned by the AI system */
  confidence: number;
  /** Whether confidence met the threshold for this decision type */
  status: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';
  /** The subject entity — candidateId, employeeId, jobId, etc. */
  subjectId: string;
  subjectType: 'CANDIDATE' | 'EMPLOYEE' | 'JOB' | 'DEPARTMENT';
  /** Raw input data snapshot (for reproducibility) */
  inputSnapshot: Record<string, any>;
  /** Raw AI output / result */
  outputSnapshot: Record<string, any>;
  /** Human reviewer who approved/rejected/overrode (if applicable) */
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  /** AI reasoning */
  reasoning: string;
  createdAt: Date;
  createdBy: string;
}

/** Per-type governance configuration */
export interface GovernanceThreshold {
  /** Minimum confidence to auto-approve without human review */
  autoApproveThreshold: number;
  /** Below this confidence, the decision is auto-rejected (flagged as low quality) */
  autoRejectThreshold: number;
  /** Whether auto-approve is enabled at all for this type */
  autoApproveEnabled: boolean;
  /** Whether this decision type requires a manager-level review */
  requiresManagerReview: boolean;
}

/** Full governance configuration for a tenant */
export interface GovernanceConfig {
  tenantId: string;
  /** Per-type thresholds */
  thresholds: Record<AIDecisionType, GovernanceThreshold>;
  /** Global override: disable all auto-approve across the board */
  globalAutoApproveEnabled: boolean;
  /** Maximum number of pending reviews before halting new AI decisions */
  maxPendingReviews: number;
  /** Number of days to retain decision logs */
  retentionDays: number;
  updatedAt: Date;
  updatedBy: string;
}

/** Aggregated governance stats by type for a given period */
export interface GovernanceStats {
  decisionType: AIDecisionType;
  totalDecisions: number;
  autoApproved: number;
  pendingReview: number;
  manuallyApproved: number;
  rejected: number;
  overridden: number;
  averageConfidence: number;
  /** Percentage of decisions that passed auto-approve threshold */
  autoApproveRate: number;
  /** Percentage of pending reviews that were ultimately approved by humans */
  humanApprovalRate: number;
  periodStart: Date;
  periodEnd: Date;
}

/** Item in the human review queue with priority and context */
export interface ReviewQueueItem {
  decisionLogId: string;
  decisionType: AIDecisionType;
  confidence: number;
  /** 1 = highest priority (lowest confidence), 5 = lowest priority */
  priority: 1 | 2 | 3 | 4 | 5;
  subjectId: string;
  subjectType: AIDecisionLog['subjectType'];
  /** Short human-readable summary */
  summary: string;
  /** Context snippet for the reviewer */
  context: string;
  createdAt: Date;
  assignedTo?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Default governance thresholds — conservative, review-heavy */
export const DEFAULT_GOVERNANCE_CONFIG: Omit<GovernanceConfig, 'tenantId' | 'updatedAt' | 'updatedBy'> = {
  thresholds: {
    CV_PARSING: {
      autoApproveThreshold: 85,
      autoRejectThreshold: 30,
      autoApproveEnabled: true,
      requiresManagerReview: false,
    },
    JOB_MATCHING: {
      autoApproveThreshold: 80,
      autoRejectThreshold: 25,
      autoApproveEnabled: true,
      requiresManagerReview: false,
    },
    SKILL_ASSESSMENT: {
      autoApproveThreshold: 75,
      autoRejectThreshold: 30,
      autoApproveEnabled: false,
      requiresManagerReview: true,
    },
    SALARY_RECOMMENDATION: {
      autoApproveThreshold: 90,
      autoRejectThreshold: 40,
      autoApproveEnabled: false,
      requiresManagerReview: true,
    },
    INTERVIEW_SCORING: {
      autoApproveThreshold: 80,
      autoRejectThreshold: 35,
      autoApproveEnabled: false,
      requiresManagerReview: true,
    },
    PERFORMANCE_PREDICTION: {
      autoApproveThreshold: 85,
      autoRejectThreshold: 35,
      autoApproveEnabled: false,
      requiresManagerReview: true,
    },
    TRAINING_RECOMMENDATION: {
      autoApproveThreshold: 70,
      autoRejectThreshold: 20,
      autoApproveEnabled: true,
      requiresManagerReview: false,
    },
  },
  globalAutoApproveEnabled: true,
  maxPendingReviews: 100,
  retentionDays: 365,
};

/** Priority thresholds based on confidence */
const PRIORITY_THRESHOLDS: { maxConfidence: number; priority: ReviewQueueItem['priority'] }[] = [
  { maxConfidence: 30, priority: 1 },
  { maxConfidence: 45, priority: 2 },
  { maxConfidence: 60, priority: 3 },
  { maxConfidence: 75, priority: 4 },
  { maxConfidence: 100, priority: 5 },
];

// ─── Functions ─────────────────────────────────────────────────────────────

/**
 * Returns the governance threshold for a specific decision type.
 * Falls back to a strict default if the type is not configured.
 */
export function getThreshold(
  config: GovernanceConfig,
  decisionType: AIDecisionType
): GovernanceThreshold {
  const threshold = config.thresholds[decisionType];
  if (threshold) return threshold;

  // Fallback: strict defaults — no auto-approve, requires review
  return {
    autoApproveThreshold: 95,
    autoRejectThreshold: 40,
    autoApproveEnabled: false,
    requiresManagerReview: true,
  };
}

/**
 * Evaluates confidence against governance rules and determines the decision status.
 *
 * Returns:
 * - `AUTO_APPROVED` if confidence >= autoApproveThreshold AND auto-approve is enabled globally + per-type
 * - `REJECTED` if confidence < autoRejectThreshold
 * - `PENDING_REVIEW` otherwise (needs human review)
 */
export function evaluateConfidence(
  config: GovernanceConfig,
  decisionType: AIDecisionType,
  confidence: number
): {
  status: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'REJECTED';
  threshold: GovernanceThreshold;
  reasoning: string;
} {
  const threshold = getThreshold(config, decisionType);
  const label = DECISION_TYPE_LABELS[decisionType];
  const confidenceRounded = Math.round(confidence * 10) / 10;

  // Check auto-reject first
  if (confidence < threshold.autoRejectThreshold) {
    return {
      status: 'REJECTED',
      threshold,
      reasoning:
        `${label} decision auto-rejected. ` +
        `Confidence ${confidenceRounded}% is below the minimum threshold of ${threshold.autoRejectThreshold}%. ` +
        `The AI output quality is too low for consideration.`,
    };
  }

  // Check auto-approve
  if (
    confidence >= threshold.autoApproveThreshold &&
    threshold.autoApproveEnabled &&
    config.globalAutoApproveEnabled
  ) {
    return {
      status: 'AUTO_APPROVED',
      threshold,
      reasoning:
        `${label} decision auto-approved. ` +
        `Confidence ${confidenceRounded}% meets the auto-approve threshold of ${threshold.autoApproveThreshold}%.`,
    };
  }

  // Pending human review
  const needsManager = threshold.requiresManagerReview;
  return {
    status: 'PENDING_REVIEW',
    threshold,
    reasoning:
      `${label} decision requires human review. ` +
      `Confidence ${confidenceRounded}% is between the reject threshold (${threshold.autoRejectThreshold}%) ` +
      `and auto-approve threshold (${threshold.autoApproveThreshold}%).` +
      (needsManager ? ' Manager-level review required.' : ''),
  };
}

/**
 * Creates a full AIDecisionLog entry from evaluation inputs.
 * Does NOT persist — the caller handles DB insertion.
 */
export function createDecisionLog(params: {
  id: string;
  tenantId: string;
  decisionType: AIDecisionType;
  confidence: number;
  subjectId: string;
  subjectType: AIDecisionLog['subjectType'];
  inputSnapshot: Record<string, any>;
  outputSnapshot: Record<string, any>;
  config: GovernanceConfig;
  createdBy: string;
}): AIDecisionLog {
  const evaluation = evaluateConfidence(params.config, params.decisionType, params.confidence);

  return {
    id: params.id,
    tenantId: params.tenantId,
    decisionType: params.decisionType,
    confidence: Math.round(params.confidence * 10) / 10,
    status: evaluation.status === 'REJECTED' ? 'REJECTED'
      : evaluation.status === 'AUTO_APPROVED' ? 'AUTO_APPROVED'
      : 'PENDING_REVIEW',
    subjectId: params.subjectId,
    subjectType: params.subjectType,
    inputSnapshot: params.inputSnapshot,
    outputSnapshot: params.outputSnapshot,
    reasoning: evaluation.reasoning,
    createdAt: new Date(),
    createdBy: params.createdBy,
  };
}

/**
 * Builds a review queue item from a decision log that is pending review.
 * Assigns priority based on confidence (lower confidence = higher priority).
 * Generates summary and context.
 */
export function buildReviewQueueItem(
  log: AIDecisionLog
): ReviewQueueItem {
  const label = DECISION_TYPE_LABELS[log.decisionType];

  // Determine priority from confidence
  let priority: ReviewQueueItem['priority'] = 5;
  for (const tier of PRIORITY_THRESHOLDS) {
    if (log.confidence <= tier.maxConfidence) {
      priority = tier.priority;
      break;
    }
  }

  // Build summary
  const summary =
    `${label} for ${log.subjectType.toLowerCase()} ${log.subjectId} ` +
    `— confidence ${log.confidence}%`;

  // Build context with key details from output snapshot
  const contextParts: string[] = [
    `Decision type: ${label}`,
    `Subject: ${log.subjectType} (${log.subjectId})`,
    `Confidence: ${log.confidence}%`,
  ];
  if (log.outputSnapshot.overallScore !== undefined) {
    contextParts.push(`Overall score: ${log.outputSnapshot.overallScore}`);
  }
  if (log.outputSnapshot.recommendation) {
    contextParts.push(`Recommendation: ${log.outputSnapshot.recommendation}`);
  }
  if (log.outputSnapshot.matchedSkills?.length) {
    contextParts.push(`Matched skills: ${log.outputSnapshot.matchedSkills.slice(0, 5).join(', ')}`);
  }

  return {
    decisionLogId: log.id,
    decisionType: log.decisionType,
    confidence: log.confidence,
    priority,
    subjectId: log.subjectId,
    subjectType: log.subjectType,
    summary,
    context: contextParts.join(' | '),
    createdAt: log.createdAt,
  };
}

/**
 * Calculates aggregated governance stats from a list of decision logs for a period.
 * Groups by decision type and computes rates + averages.
 */
export function calculateGovernanceStats(
  logs: AIDecisionLog[],
  periodStart: Date,
  periodEnd: Date
): GovernanceStats[] {
  // Group logs by decision type
  const grouped = new Map<AIDecisionType, AIDecisionLog[]>();
  for (const log of logs) {
    const existing = grouped.get(log.decisionType) || [];
    existing.push(log);
    grouped.set(log.decisionType, existing);
  }

  const stats: GovernanceStats[] = [];

  for (const [decisionType, typeLogs] of grouped) {
    const total = typeLogs.length;
    if (total === 0) continue;

    let autoApproved = 0;
    let pendingReview = 0;
    let manuallyApproved = 0;
    let rejected = 0;
    let overridden = 0;
    let totalConfidence = 0;

    for (const log of typeLogs) {
      totalConfidence += log.confidence;
      switch (log.status) {
        case 'AUTO_APPROVED':
          autoApproved++;
          break;
        case 'PENDING_REVIEW':
          pendingReview++;
          break;
        case 'APPROVED':
          manuallyApproved++;
          break;
        case 'REJECTED':
          rejected++;
          break;
        case 'OVERRIDDEN':
          overridden++;
          break;
      }
    }

    // Auto-approve rate: % of total that were auto-approved
    const autoApproveRate = total > 0
      ? Math.round((autoApproved / total) * 1000) / 10
      : 0;

    // Human approval rate: of decisions that went to review, how many were approved
    const reviewedCount = manuallyApproved + rejected + overridden;
    const humanApprovalRate = reviewedCount > 0
      ? Math.round(((manuallyApproved + overridden) / reviewedCount) * 1000) / 10
      : 0;

    stats.push({
      decisionType,
      totalDecisions: total,
      autoApproved,
      pendingReview,
      manuallyApproved,
      rejected,
      overridden,
      averageConfidence: Math.round((totalConfidence / total) * 10) / 10,
      autoApproveRate,
      humanApprovalRate,
      periodStart,
      periodEnd,
    });
  }

  // Sort by total decisions descending
  stats.sort((a, b) => b.totalDecisions - a.totalDecisions);

  return stats;
}

/**
 * Formats a decision log into a human-readable audit string.
 * Used for audit trail exports and compliance reports.
 */
export function formatDecisionForAudit(log: AIDecisionLog): string {
  const label = DECISION_TYPE_LABELS[log.decisionType];
  const timestamp = log.createdAt.toISOString();

  // Status label
  const statusLabels: Record<AIDecisionLog['status'], string> = {
    AUTO_APPROVED:  'Auto-Approved',
    PENDING_REVIEW: 'Pending Review',
    APPROVED:       'Approved',
    REJECTED:       'Rejected',
    OVERRIDDEN:     'Overridden',
  };

  const statusLabel = statusLabels[log.status];

  const parts = [
    `[${timestamp}]`,
    `${label}`,
    `| Status: ${statusLabel}`,
    `| Confidence: ${log.confidence}%`,
    `| Subject: ${log.subjectType}/${log.subjectId}`,
    `| By: ${log.createdBy}`,
  ];

  if (log.reviewedBy) {
    parts.push(`| Reviewed by: ${log.reviewedBy} at ${log.reviewedAt?.toISOString() || 'N/A'}`);
  }
  if (log.reviewNotes) {
    parts.push(`| Notes: ${log.reviewNotes}`);
  }

  return parts.join(' ');
}
