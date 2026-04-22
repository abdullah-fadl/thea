/**
 * Confidence-based decision rules for classification fields
 */

export type ConfidenceLevel = 'auto-select' | 'confirm' | 'needs-review';

export interface ConfidenceDecision {
  level: ConfidenceLevel;
  autoSelect: boolean;
  requiresConfirmation: boolean;
  needsReview: boolean;
  color: 'default' | 'secondary' | 'destructive' | 'warning';
}

/**
 * Determine confidence level and decision for a field
 * 
 * Rules:
 * - >= 0.85: auto-select (locked but editable)
 * - 0.65-0.84: prefill but require confirmation (highlight yellow)
 * - < 0.65: do not prefill; mark as Needs Review (red)
 */
export function getConfidenceDecision(confidence: number): ConfidenceDecision {
  if (confidence >= 0.85) {
    return {
      level: 'auto-select',
      autoSelect: true,
      requiresConfirmation: false,
      needsReview: false,
      color: 'default',
    };
  } else if (confidence >= 0.65) {
    return {
      level: 'confirm',
      autoSelect: false,
      requiresConfirmation: true,
      needsReview: false,
      color: 'warning',
    };
  } else {
    return {
      level: 'needs-review',
      autoSelect: false,
      requiresConfirmation: false,
      needsReview: true,
      color: 'destructive',
    };
  }
}

/**
 * Check if a field should be auto-selected based on confidence
 */
export function shouldAutoSelect(confidence: number): boolean {
  return confidence >= 0.85;
}

/**
 * Check if a field requires confirmation
 */
export function requiresConfirmation(confidence: number): boolean {
  return confidence >= 0.65 && confidence < 0.85;
}

/**
 * Check if a field needs review
 */
export function needsReview(confidence: number): boolean {
  return confidence < 0.65;
}
