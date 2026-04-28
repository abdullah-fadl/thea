/**
 * Radiology Study Status Tracking for Thea EHR
 *
 * Defines the valid states for a radiology study and the allowed transitions.
 *
 * Workflow:
 *   ORDERED -> SCHEDULED -> IN_PROGRESS -> COMPLETED -> REPORTED -> VERIFIED
 *   ORDERED -> CANCELLED
 *   SCHEDULED -> CANCELLED
 */

export type StudyStatus =
  | 'ORDERED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REPORTED'
  | 'VERIFIED'
  | 'CANCELLED';

export const STUDY_STATUS_LABELS: Record<StudyStatus, { ar: string; en: string }> = {
  ORDERED: { ar: 'تم الطلب', en: 'Ordered' },
  SCHEDULED: { ar: 'مجدول', en: 'Scheduled' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In Progress' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed' },
  REPORTED: { ar: 'تم التقرير', en: 'Reported' },
  VERIFIED: { ar: 'تم التحقق', en: 'Verified' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
};

export const VALID_TRANSITIONS: Record<StudyStatus, StudyStatus[]> = {
  ORDERED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['REPORTED'],
  REPORTED: ['VERIFIED'],
  VERIFIED: [],
  CANCELLED: [],
};

/**
 * Check if a transition from one status to another is valid.
 */
export function isValidTransition(from: StudyStatus, to: StudyStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get allowed next statuses from the current status.
 */
export function getNextStatuses(current: StudyStatus): StudyStatus[] {
  return VALID_TRANSITIONS[current] || [];
}

/**
 * Map an action name to the target status.
 */
export function actionToStatus(action: string): StudyStatus | null {
  const map: Record<string, StudyStatus> = {
    schedule: 'SCHEDULED',
    start: 'IN_PROGRESS',
    complete: 'COMPLETED',
    report: 'REPORTED',
    verify: 'VERIFIED',
    cancel: 'CANCELLED',
  };
  return map[action.toLowerCase()] || null;
}
