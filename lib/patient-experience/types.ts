/**
 * Shared types for the Patient Experience module.
 */

export const PX_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED'] as const;
export type PxStatus = (typeof PX_STATUSES)[number];

export const PX_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type PxSeverity = (typeof PX_SEVERITIES)[number];

export const PX_CATEGORIES = [
  'billing',
  'clinical',
  'communication',
  'facility',
  'food',
  'medication',
  'staff',
  'wait_time',
  'other',
] as const;
export type PxCategory = (typeof PX_CATEGORIES)[number];

export const PX_SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'CONCERN'] as const;
export type PxSentiment = (typeof PX_SENTIMENTS)[number];

export const PX_COMMENT_KINDS = [
  'COMMENT',
  'STATUS_CHANGE',
  'ESCALATION',
  'ASSIGNMENT',
  'RESOLUTION',
] as const;
export type PxCommentKind = (typeof PX_COMMENT_KINDS)[number];

export const PX_REPORT_TYPES = [
  'volume-by-category',
  'sla-compliance-trend',
  'top-complaint-sources',
  'resolution-time-distribution',
  'satisfaction-over-time',
] as const;
export type PxReportType = (typeof PX_REPORT_TYPES)[number];

// SLA target (minutes) by severity. Used for compliance % and dueAt default.
export const PX_SLA_MINUTES: Record<PxSeverity, number> = {
  CRITICAL: 60 * 4, //  4 h
  HIGH: 60 * 24, // 1 day
  MEDIUM: 60 * 24 * 3, // 3 days
  LOW: 60 * 24 * 7, // 7 days
};
