/**
 * Lab Quality Control — Westgard Rules Engine
 *
 * Implements standard Westgard multi-rule QC for the Levey-Jennings chart.
 *
 * Rules implemented:
 *  1-2s  Warning — single value > 2 SD from mean
 *  1-3s  Reject  — single value > 3 SD from mean
 *  2-2s  Reject  — two consecutive values > 2 SD in same direction
 *  R-4s  Reject  — two consecutive values span > 4 SD (one +2s, one −2s)
 *  4-1s  Reject  — four consecutive values > 1 SD in same direction
 *  10x   Reject  — ten consecutive values on same side of mean
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WestgardRuleId = '1-2s' | '1-3s' | '2-2s' | 'R-4s' | '4-1s' | '10x';

export type QCViolationSeverity = 'warning' | 'reject';

export interface QCResult {
  id?: string;
  analyteCode: string;
  analyteName?: { ar: string; en: string };
  lotNumber: string;
  level: number;
  value: number;
  mean: number;
  sd: number;
  zScore: number;
  performedAt: string;
  performedBy?: string;
  violations: WestgardViolation[];
  status: 'pass' | 'warning' | 'reject';
}

export interface WestgardViolation {
  rule: WestgardRuleId;
  severity: QCViolationSeverity;
  message: { ar: string; en: string };
}

export interface QCLotConfig {
  analyteCode: string;
  lotNumber: string;
  level: number;
  mean: number;
  sd: number;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Z-Score
// ---------------------------------------------------------------------------

export function calculateZScore(value: number, mean: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - mean) / sd;
}

// ---------------------------------------------------------------------------
// Westgard Rule Evaluators
// ---------------------------------------------------------------------------

const RULE_LABELS: Record<WestgardRuleId, { ar: string; en: string }> = {
  '1-2s': { ar: 'تحذير 1-2s: القيمة تتجاوز 2 انحرافات معيارية', en: '1-2s Warning: value exceeds 2 SD from mean' },
  '1-3s': { ar: 'رفض 1-3s: القيمة تتجاوز 3 انحرافات معيارية', en: '1-3s Reject: value exceeds 3 SD from mean' },
  '2-2s': { ar: 'رفض 2-2s: قيمتان متتاليتان تتجاوزان 2 SD', en: '2-2s Reject: 2 consecutive values exceed 2 SD' },
  'R-4s': { ar: 'رفض R-4s: الفرق بين قيمتين متتاليتين > 4 SD', en: 'R-4s Reject: range between 2 consecutive > 4 SD' },
  '4-1s': { ar: 'رفض 4-1s: 4 قيم متتالية تتجاوز 1 SD', en: '4-1s Reject: 4 consecutive values exceed 1 SD' },
  '10x': { ar: 'رفض 10x: 10 قيم متتالية على نفس جانب المتوسط', en: '10x Reject: 10 consecutive values on same side of mean' },
};

function check1_2s(zScore: number): WestgardViolation | null {
  if (Math.abs(zScore) > 2 && Math.abs(zScore) <= 3) {
    return { rule: '1-2s', severity: 'warning', message: RULE_LABELS['1-2s'] };
  }
  return null;
}

function check1_3s(zScore: number): WestgardViolation | null {
  if (Math.abs(zScore) > 3) {
    return { rule: '1-3s', severity: 'reject', message: RULE_LABELS['1-3s'] };
  }
  return null;
}

function check2_2s(zScores: number[]): WestgardViolation | null {
  if (zScores.length < 2) return null;
  const [current, prev] = zScores;
  if (Math.abs(current) > 2 && Math.abs(prev) > 2) {
    if ((current > 0 && prev > 0) || (current < 0 && prev < 0)) {
      return { rule: '2-2s', severity: 'reject', message: RULE_LABELS['2-2s'] };
    }
  }
  return null;
}

function checkR_4s(zScores: number[]): WestgardViolation | null {
  if (zScores.length < 2) return null;
  const [current, prev] = zScores;
  if (Math.abs(current - prev) > 4) {
    return { rule: 'R-4s', severity: 'reject', message: RULE_LABELS['R-4s'] };
  }
  return null;
}

function check4_1s(zScores: number[]): WestgardViolation | null {
  if (zScores.length < 4) return null;
  const last4 = zScores.slice(0, 4);
  const allPositive = last4.every((z) => z > 1);
  const allNegative = last4.every((z) => z < -1);
  if (allPositive || allNegative) {
    return { rule: '4-1s', severity: 'reject', message: RULE_LABELS['4-1s'] };
  }
  return null;
}

function check10x(zScores: number[]): WestgardViolation | null {
  if (zScores.length < 10) return null;
  const last10 = zScores.slice(0, 10);
  const allAbove = last10.every((z) => z > 0);
  const allBelow = last10.every((z) => z < 0);
  if (allAbove || allBelow) {
    return { rule: '10x', severity: 'reject', message: RULE_LABELS['10x'] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a QC measurement against Westgard rules.
 *
 * @param value     - current QC measurement
 * @param mean      - expected mean for this lot/level
 * @param sd        - expected SD for this lot/level
 * @param history   - previous z-scores (most recent first), max 10 needed
 */
export function evaluateWestgard(
  value: number,
  mean: number,
  sd: number,
  history: number[] = [],
): { zScore: number; violations: WestgardViolation[]; status: 'pass' | 'warning' | 'reject' } {
  const zScore = calculateZScore(value, mean, sd);
  const zScores = [zScore, ...history];
  const violations: WestgardViolation[] = [];

  // Evaluate rules in order of severity
  const v1_3s = check1_3s(zScore);
  if (v1_3s) violations.push(v1_3s);

  const v2_2s = check2_2s(zScores);
  if (v2_2s) violations.push(v2_2s);

  const vR_4s = checkR_4s(zScores);
  if (vR_4s) violations.push(vR_4s);

  const v4_1s = check4_1s(zScores);
  if (v4_1s) violations.push(v4_1s);

  const v10x = check10x(zScores);
  if (v10x) violations.push(v10x);

  // 1-2s is warning only (added last)
  if (violations.length === 0) {
    const v1_2s = check1_2s(zScore);
    if (v1_2s) violations.push(v1_2s);
  }

  const hasReject = violations.some((v) => v.severity === 'reject');
  const hasWarning = violations.some((v) => v.severity === 'warning');

  return {
    zScore,
    violations,
    status: hasReject ? 'reject' : hasWarning ? 'warning' : 'pass',
  };
}

/**
 * Build a Levey-Jennings data point array from raw QC results.
 * Returns the last N results in chronological order (oldest first).
 */
export function buildLeveyJenningsData(
  results: QCResult[],
  maxPoints: number = 30,
): {
  labels: string[];
  values: number[];
  zScores: number[];
  mean: number;
  sd: number;
  statuses: ('pass' | 'warning' | 'reject')[];
} {
  if (results.length === 0) {
    return { labels: [], values: [], zScores: [], mean: 0, sd: 0, statuses: [] };
  }

  const sorted = [...results]
    .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime())
    .slice(-maxPoints);

  const mean = sorted[0]?.mean ?? 0;
  const sd = sorted[0]?.sd ?? 1;

  return {
    labels: sorted.map((r) => new Date(r.performedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    values: sorted.map((r) => r.value),
    zScores: sorted.map((r) => r.zScore),
    mean,
    sd,
    statuses: sorted.map((r) => r.status),
  };
}
