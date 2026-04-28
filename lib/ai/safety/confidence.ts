/**
 * Confidence Scoring
 *
 * Evaluates and categorizes confidence levels for AI output.
 * Every AI suggestion MUST include a confidence score.
 */

import type { ConfidenceLevel, ConfidenceScore } from '../providers/types';

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const THRESHOLDS: Record<ConfidenceLevel, { min: number; max: number }> = {
  high:   { min: 0.8, max: 1.0 },
  medium: { min: 0.5, max: 0.79 },
  low:    { min: 0.0, max: 0.49 },
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Convert a numeric confidence value (0–1) to a categorical level.
 */
export function getConfidenceLevel(value: number): ConfidenceLevel {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped >= THRESHOLDS.high.min) return 'high';
  if (clamped >= THRESHOLDS.medium.min) return 'medium';
  return 'low';
}

/**
 * Build a full ConfidenceScore from a numeric value.
 */
export function buildConfidence(
  value: number,
  reasoning?: string,
): ConfidenceScore {
  return {
    value: Math.round(value * 100) / 100,
    level: getConfidenceLevel(value),
    reasoning,
  };
}

/**
 * Get a bilingual label for a confidence level.
 */
export function getConfidenceLabel(level: ConfidenceLevel): { ar: string; en: string } {
  switch (level) {
    case 'high':
      return { ar: 'ثقة عالية', en: 'High Confidence' };
    case 'medium':
      return { ar: 'ثقة متوسطة', en: 'Medium Confidence' };
    case 'low':
      return { ar: 'ثقة منخفضة', en: 'Low Confidence' };
  }
}

/**
 * Get the display color for a confidence level (Tailwind classes).
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':   return 'text-green-600 bg-green-50';
    case 'medium': return 'text-amber-600 bg-amber-50';
    case 'low':    return 'text-red-600 bg-red-50';
  }
}

/**
 * Aggregate multiple confidence scores into a single score.
 * Uses weighted average if weights are provided, otherwise simple average.
 */
export function aggregateConfidence(
  scores: { value: number; weight?: number }[],
): ConfidenceScore {
  if (scores.length === 0) return buildConfidence(0, 'No data');

  const totalWeight = scores.reduce((sum, s) => sum + (s.weight ?? 1), 0);

  // [AI-03] Guard against divide-by-zero when all weights are 0 or NaN
  if (!totalWeight || !Number.isFinite(totalWeight)) {
    return buildConfidence(0, 'Unable to aggregate — invalid weights');
  }

  const weightedSum = scores.reduce(
    (sum, s) => sum + s.value * (s.weight ?? 1),
    0,
  );

  const result = weightedSum / totalWeight;
  return buildConfidence(
    Number.isFinite(result) ? result : 0,
    `Aggregated from ${scores.length} sources`,
  );
}
