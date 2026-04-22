/**
 * Lab Auto-Validation Engine
 *
 * Evaluates lab results against configurable rules to determine if they can
 * be auto-verified or need manual review.
 *
 * Rule conditions:
 *  - withinNormalRange: result within reference range
 *  - deltaCheckPass: result within acceptable change from previous
 *  - linearityCheck: result within analytical measurement range
 *  - qcPass: most recent QC for this analyte passed
 *  - noFlags: no instrument flags or comments
 *
 * Actions:
 *  - auto_verify: release result without manual review
 *  - hold_for_review: queue for tech/pathologist review
 *  - flag_critical: trigger critical value notification
 */

import { getReferenceRange, type ReferenceRange } from './referenceRanges';
import { checkCriticalValue } from './criticalValues';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationAction = 'auto_verify' | 'hold_for_review' | 'flag_critical';

export interface ValidationCondition {
  type: 'withinNormalRange' | 'deltaCheckPass' | 'linearityCheck' | 'qcPass' | 'noFlags';
  params?: Record<string, number | string | boolean>;
}

export interface ValidationRule {
  id: string;
  name: { ar: string; en: string };
  testCodes: string[];
  conditions: ValidationCondition[];
  action: ValidationAction;
  priority: number;
  enabled: boolean;
}

export interface ValidationInput {
  testCode: string;
  value: number;
  unit: string;
  gender?: 'male' | 'female';
  previousValue?: number;
  previousValueDate?: string;
  instrumentFlags?: string[];
  instrumentComments?: string;
  qcStatus?: 'pass' | 'fail' | 'warning' | 'unknown';
  linearityMin?: number;
  linearityMax?: number;
}

export interface ValidationResult {
  action: ValidationAction;
  ruleId: string;
  ruleName: { ar: string; en: string };
  conditionResults: { condition: string; passed: boolean; detail?: string }[];
  allConditionsPassed: boolean;
}

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

export const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'rule_critical',
    name: { ar: 'القيم الحرجة', en: 'Critical Values' },
    testCodes: ['*'],
    conditions: [],
    action: 'flag_critical',
    priority: 1,
    enabled: true,
  },
  {
    id: 'rule_cbc_auto',
    name: { ar: 'تحقق تلقائي - تعداد دم', en: 'Auto-verify CBC' },
    testCodes: ['WBC', 'RBC', 'HGB', 'HCT', 'PLT', 'MCV', 'MCH', 'MCHC'],
    conditions: [
      { type: 'withinNormalRange' },
      { type: 'deltaCheckPass', params: { maxChangePercent: 50 } },
      { type: 'noFlags' },
      { type: 'qcPass' },
    ],
    action: 'auto_verify',
    priority: 10,
    enabled: true,
  },
  {
    id: 'rule_bmp_auto',
    name: { ar: 'تحقق تلقائي - كيمياء أساسية', en: 'Auto-verify BMP' },
    testCodes: ['GLU', 'BUN', 'CREA', 'NA', 'K', 'CA', 'CO2', 'CL'],
    conditions: [
      { type: 'withinNormalRange' },
      { type: 'deltaCheckPass', params: { maxChangePercent: 30 } },
      { type: 'noFlags' },
      { type: 'qcPass' },
    ],
    action: 'auto_verify',
    priority: 10,
    enabled: true,
  },
  {
    id: 'rule_lft_auto',
    name: { ar: 'تحقق تلقائي - وظائف كبد', en: 'Auto-verify LFT' },
    testCodes: ['ALT', 'AST', 'ALP', 'TBIL', 'ALB'],
    conditions: [
      { type: 'withinNormalRange' },
      { type: 'deltaCheckPass', params: { maxChangePercent: 40 } },
      { type: 'noFlags' },
      { type: 'qcPass' },
    ],
    action: 'auto_verify',
    priority: 10,
    enabled: true,
  },
  {
    id: 'rule_lipid_auto',
    name: { ar: 'تحقق تلقائي - دهون', en: 'Auto-verify Lipid' },
    testCodes: ['CHOL', 'HDL', 'LDL', 'TG'],
    conditions: [
      { type: 'withinNormalRange' },
      { type: 'noFlags' },
      { type: 'qcPass' },
    ],
    action: 'auto_verify',
    priority: 10,
    enabled: true,
  },
  {
    id: 'rule_fallback',
    name: { ar: 'مراجعة يدوية', en: 'Manual Review Fallback' },
    testCodes: ['*'],
    conditions: [],
    action: 'hold_for_review',
    priority: 100,
    enabled: true,
  },
];

// ---------------------------------------------------------------------------
// Condition evaluators
// ---------------------------------------------------------------------------

function evaluateWithinNormalRange(
  input: ValidationInput,
  _params?: Record<string, number | string | boolean>,
): { passed: boolean; detail?: string } {
  const range = getReferenceRange(input.testCode, input.gender);
  if (!range) return { passed: true, detail: 'No reference range defined' };

  const inRange = input.value >= range.normalRange.min && input.value <= range.normalRange.max;
  return {
    passed: inRange,
    detail: inRange
      ? `${input.value} within ${range.normalRange.min}-${range.normalRange.max}`
      : `${input.value} outside ${range.normalRange.min}-${range.normalRange.max}`,
  };
}

function evaluateDeltaCheckPass(
  input: ValidationInput,
  params?: Record<string, number | string | boolean>,
): { passed: boolean; detail?: string } {
  if (input.previousValue === undefined || input.previousValue === null) {
    return { passed: true, detail: 'No previous value for delta check' };
  }

  const maxChangePercent = Number(params?.maxChangePercent ?? 50);
  const prevVal = input.previousValue;

  if (prevVal === 0) {
    return { passed: input.value === 0, detail: 'Previous value was 0' };
  }

  const changePercent = Math.abs(((input.value - prevVal) / prevVal) * 100);
  const passed = changePercent <= maxChangePercent;

  return {
    passed,
    detail: `Delta ${changePercent.toFixed(1)}% (max ${maxChangePercent}%)`,
  };
}

function evaluateLinearityCheck(
  input: ValidationInput,
  _params?: Record<string, number | string | boolean>,
): { passed: boolean; detail?: string } {
  if (input.linearityMin === undefined && input.linearityMax === undefined) {
    return { passed: true, detail: 'No linearity limits defined' };
  }

  const min = input.linearityMin ?? -Infinity;
  const max = input.linearityMax ?? Infinity;
  const inRange = input.value >= min && input.value <= max;

  return {
    passed: inRange,
    detail: inRange
      ? `Within analytical range ${min}-${max}`
      : `Outside analytical range ${min}-${max}`,
  };
}

function evaluateQcPass(
  input: ValidationInput,
  _params?: Record<string, number | string | boolean>,
): { passed: boolean; detail?: string } {
  if (!input.qcStatus || input.qcStatus === 'unknown') {
    return { passed: true, detail: 'QC status unknown — skipped' };
  }

  return {
    passed: input.qcStatus === 'pass',
    detail: `QC status: ${input.qcStatus}`,
  };
}

function evaluateNoFlags(
  input: ValidationInput,
  _params?: Record<string, number | string | boolean>,
): { passed: boolean; detail?: string } {
  const hasFlags = (input.instrumentFlags?.length ?? 0) > 0;
  const hasComments = !!input.instrumentComments?.trim();

  if (hasFlags) {
    return { passed: false, detail: `Instrument flags: ${input.instrumentFlags!.join(', ')}` };
  }
  if (hasComments) {
    return { passed: false, detail: `Instrument comment: ${input.instrumentComments}` };
  }

  return { passed: true, detail: 'No flags or comments' };
}

const EVALUATORS: Record<
  ValidationCondition['type'],
  (input: ValidationInput, params?: Record<string, number | string | boolean>) => { passed: boolean; detail?: string }
> = {
  withinNormalRange: evaluateWithinNormalRange,
  deltaCheckPass: evaluateDeltaCheckPass,
  linearityCheck: evaluateLinearityCheck,
  qcPass: evaluateQcPass,
  noFlags: evaluateNoFlags,
};

// ---------------------------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------------------------

function matchesRule(rule: ValidationRule, testCode: string): boolean {
  if (rule.testCodes.includes('*')) return true;
  const code = testCode.replace(/_[MF]$/, '').toUpperCase();
  return rule.testCodes.some((tc) => tc.toUpperCase() === code);
}

/**
 * Evaluate a single lab result against all validation rules.
 * Returns the action to take based on the highest-priority matching rule.
 */
export function evaluateAutoValidation(
  input: ValidationInput,
  rules?: ValidationRule[],
): ValidationResult {
  const activeRules = (rules ?? DEFAULT_VALIDATION_RULES)
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  // Check critical first (priority 1)
  const critCheck = checkCriticalValue(input.testCode, input.value);
  if (critCheck.isCritical) {
    const critRule = activeRules.find((r) => r.id === 'rule_critical') ?? activeRules[0];
    return {
      action: 'flag_critical',
      ruleId: critRule?.id ?? 'rule_critical',
      ruleName: critRule?.name ?? { ar: 'حرج', en: 'Critical' },
      conditionResults: [{ condition: 'criticalValueCheck', passed: false, detail: `Critical ${critCheck.type}: ${input.value}` }],
      allConditionsPassed: false,
    };
  }

  // Evaluate other rules in priority order
  for (const rule of activeRules) {
    if (rule.id === 'rule_critical') continue;
    if (!matchesRule(rule, input.testCode)) continue;

    // Rules with no conditions act as fallbacks
    if (rule.conditions.length === 0) {
      return {
        action: rule.action,
        ruleId: rule.id,
        ruleName: rule.name,
        conditionResults: [],
        allConditionsPassed: true,
      };
    }

    const conditionResults = rule.conditions.map((cond) => {
      const evaluator = EVALUATORS[cond.type];
      const result = evaluator(input, cond.params);
      return { condition: cond.type, ...result };
    });

    const allPassed = conditionResults.every((cr) => cr.passed);

    if (allPassed) {
      return {
        action: rule.action,
        ruleId: rule.id,
        ruleName: rule.name,
        conditionResults,
        allConditionsPassed: true,
      };
    }
  }

  // Default: hold for review
  return {
    action: 'hold_for_review',
    ruleId: 'default',
    ruleName: { ar: 'مراجعة يدوية (افتراضي)', en: 'Manual Review (default)' },
    conditionResults: [],
    allConditionsPassed: false,
  };
}

/**
 * Batch evaluate multiple results at once (e.g. a full panel).
 */
export function evaluateBatch(
  inputs: ValidationInput[],
  rules?: ValidationRule[],
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();
  for (const input of inputs) {
    results.set(input.testCode, evaluateAutoValidation(input, rules));
  }
  return results;
}
