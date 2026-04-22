import { getReferenceRange } from './referenceRanges';

// ---------------------------------------------------------------------------
// Critical value thresholds
// ---------------------------------------------------------------------------

export const CRITICAL_VALUES: Record<string, { low?: number; high?: number }> = {
  GLU: { low: 40, high: 500 },
  K: { low: 2.5, high: 6.5 },
  NA: { low: 120, high: 160 },
  CA: { low: 6.0, high: 13.0 },
  HGB: { low: 5.0, high: 20.0 },
  HGB_M: { low: 5.0, high: 20.0 },
  HGB_F: { low: 5.0, high: 20.0 },
  PLT: { low: 20, high: 1000 },
  WBC: { low: 1.0, high: 30.0 },
  INR: { high: 5.0 },
  TROP: { high: 0.4 },
  CREA: { high: 10.0 },
  BUN: { high: 100 },
  CO2: { low: 10, high: 40 },
  CL: { low: 80, high: 120 },
  HCT: { low: 20, high: 60 },
  HCT_M: { low: 20, high: 60 },
  HCT_F: { low: 20, high: 60 },
  TBIL: { high: 15.0 },
  ALB: { low: 1.5 },
  PT: { high: 30.0 },
  APTT: { high: 100 },
  ALT: { high: 1000 },
  AST: { high: 1000 },
  TSH: { low: 0.01, high: 100.0 },
  HBA1C: { high: 14.0 },
  BNP: { high: 900 },
  TG: { high: 500 },
};

// ---------------------------------------------------------------------------
// Alert interface
// ---------------------------------------------------------------------------

export interface CriticalAlert {
  id: string;
  orderId: string;
  testCode: string;
  testName: string;
  patientId: string;
  patientName: string;
  mrn: string;
  encounterId: string;
  value: number;
  unit: string;
  criticalType: 'LOW' | 'HIGH';
  threshold: number;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  notifiedDoctorAt?: Date;
  doctorId?: string;
}

// ---------------------------------------------------------------------------
// Core check function (used by lab results/save route)
// ---------------------------------------------------------------------------

export function checkCriticalValue(testCode: string, value: number) {
  const code = String(testCode || '').toUpperCase();
  const limits = CRITICAL_VALUES[code];
  if (!limits) return { isCritical: false };
  if (limits.low !== undefined && value < limits.low) {
    return { isCritical: true, type: 'LOW' as const, threshold: limits.low };
  }
  if (limits.high !== undefined && value > limits.high) {
    return { isCritical: true, type: 'HIGH' as const, threshold: limits.high };
  }
  return { isCritical: false };
}

// ---------------------------------------------------------------------------
// Enhanced check with severity levels and bilingual messages
// ---------------------------------------------------------------------------

export type ValueSeverity = 'critical' | 'abnormal' | 'normal';

export interface CriticalValueResult {
  isCritical: boolean;
  severity: ValueSeverity;
  message?: { ar: string; en: string };
}

/**
 * Check if a lab result value is critical, abnormal, or normal.
 *
 * Uses the reference ranges to determine abnormal and the critical value
 * thresholds to determine critical status.
 *
 * @param testCode - The lab test code (e.g. 'WBC', 'K', 'HGB')
 * @param value    - The numeric result value
 * @param gender   - Optional patient gender for gender-specific ranges
 */
export function isCriticalValue(
  testCode: string,
  value: number,
  gender?: string
): CriticalValueResult {
  const code = String(testCode || '').toUpperCase();

  // Check critical thresholds first
  const critCheck = checkCriticalValue(code, value);
  if (critCheck.isCritical) {
    const direction = critCheck.type === 'LOW' ? 'below' : 'above';
    const directionAr = critCheck.type === 'LOW' ? 'أقل من' : 'أعلى من';
    return {
      isCritical: true,
      severity: 'critical',
      message: {
        ar: `قيمة حرجة: ${code} = ${value} (${directionAr} الحد الحرج ${critCheck.threshold})`,
        en: `Critical value: ${code} = ${value} (${direction} critical threshold ${critCheck.threshold})`,
      },
    };
  }

  // Check normal reference range
  const genderKey = gender === 'male' || gender === 'female' ? gender : undefined;
  const range = getReferenceRange(code, genderKey);
  if (range) {
    if (value < range.normalRange.min) {
      return {
        isCritical: false,
        severity: 'abnormal',
        message: {
          ar: `نتيجة غير طبيعية: ${code} = ${value} (المعدل الطبيعي ${range.normalRange.min}-${range.normalRange.max} ${range.unit})`,
          en: `Abnormal result: ${code} = ${value} (normal ${range.normalRange.min}-${range.normalRange.max} ${range.unit})`,
        },
      };
    }
    if (value > range.normalRange.max) {
      return {
        isCritical: false,
        severity: 'abnormal',
        message: {
          ar: `نتيجة غير طبيعية: ${code} = ${value} (المعدل الطبيعي ${range.normalRange.min}-${range.normalRange.max} ${range.unit})`,
          en: `Abnormal result: ${code} = ${value} (normal ${range.normalRange.min}-${range.normalRange.max} ${range.unit})`,
        },
      };
    }
  }

  return { isCritical: false, severity: 'normal' };
}
