export const VITALS_RANGES = {
  bp: {
    systolic: { min: 60, max: 250, criticalLow: 80, criticalHigh: 180 },
    diastolic: { min: 30, max: 150, criticalLow: 50, criticalHigh: 120 },
  },
  hr: { min: 30, max: 220, criticalLow: 40, criticalHigh: 150 },
  temp: { min: 32, max: 43, criticalLow: 35, criticalHigh: 39.5 },
  rr: { min: 6, max: 50, criticalLow: 8, criticalHigh: 30 },
  spo2: { min: 50, max: 100, criticalLow: 90, criticalHigh: 100 },
  weight: { min: 0.5, max: 500 },
  height: { min: 20, max: 250 },
};

export interface VitalsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  criticalAlerts: string[];
}

export function validateVitals(vitals: {
  bp?: string;
  hr?: number;
  temp?: number;
  rr?: number;
  spo2?: number;
  weight?: number;
  height?: number;
}): VitalsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const criticalAlerts: string[] = [];

  if (vitals.bp) {
    const [sys, dia] = vitals.bp.split('/').map(Number);
    if (Number.isNaN(sys) || Number.isNaN(dia)) {
      errors.push('Invalid blood pressure format. Use 120/80.');
    } else {
      const { systolic, diastolic } = VITALS_RANGES.bp;
      if (sys < systolic.min || sys > systolic.max) {
        errors.push(`Systolic (${sys}) out of range (${systolic.min}-${systolic.max})`);
      }
      if (dia < diastolic.min || dia > diastolic.max) {
        errors.push(`Diastolic (${dia}) out of range (${diastolic.min}-${diastolic.max})`);
      }
      if (sys <= systolic.criticalLow) {
        criticalAlerts.push(`Critical low BP: ${sys}/${dia}`);
      }
      if (sys >= systolic.criticalHigh) {
        criticalAlerts.push(`Critical high BP: ${sys}/${dia}`);
      }
      if (sys > dia * 2.5) {
        warnings.push('Large gap between systolic and diastolic');
      }
    }
  }

  if (vitals.hr !== undefined) {
    const { min, max, criticalLow, criticalHigh } = VITALS_RANGES.hr;
    if (vitals.hr < min || vitals.hr > max) {
      errors.push(`Heart rate (${vitals.hr}) out of range (${min}-${max})`);
    }
    if (vitals.hr <= criticalLow) {
      criticalAlerts.push(`Critical low HR: ${vitals.hr} bpm`);
    }
    if (vitals.hr >= criticalHigh) {
      criticalAlerts.push(`Critical high HR: ${vitals.hr} bpm`);
    }
  }

  if (vitals.temp !== undefined) {
    const { min, max, criticalLow, criticalHigh } = VITALS_RANGES.temp;
    if (vitals.temp < min || vitals.temp > max) {
      errors.push(`Temperature (${vitals.temp}) out of range (${min}-${max})`);
    }
    if (vitals.temp <= criticalLow) {
      criticalAlerts.push(`Critical low temperature: ${vitals.temp}°C`);
    }
    if (vitals.temp >= criticalHigh) {
      criticalAlerts.push(`Critical high temperature: ${vitals.temp}°C`);
    }
  }

  if (vitals.rr !== undefined) {
    const { min, max, criticalLow, criticalHigh } = VITALS_RANGES.rr;
    if (vitals.rr < min || vitals.rr > max) {
      errors.push(`Respiratory rate (${vitals.rr}) out of range (${min}-${max})`);
    }
    if (vitals.rr <= criticalLow || vitals.rr >= criticalHigh) {
      criticalAlerts.push(`Critical respiratory rate: ${vitals.rr}/min`);
    }
  }

  if (vitals.spo2 !== undefined) {
    const { min, max, criticalLow } = VITALS_RANGES.spo2;
    if (vitals.spo2 < min || vitals.spo2 > max) {
      errors.push(`SpO2 (${vitals.spo2}%) out of range (${min}-${max})`);
    }
    if (vitals.spo2 <= criticalLow) {
      criticalAlerts.push(`Critical low SpO2: ${vitals.spo2}%`);
    }
  }

  if (vitals.weight !== undefined) {
    const { min, max } = VITALS_RANGES.weight;
    if (vitals.weight < min || vitals.weight > max) {
      errors.push(`Weight (${vitals.weight}) out of range (${min}-${max})`);
    }
  }

  if (vitals.height !== undefined) {
    const { min, max } = VITALS_RANGES.height;
    if (vitals.height < min || vitals.height > max) {
      errors.push(`Height (${vitals.height}) out of range (${min}-${max})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    criticalAlerts,
  };
}

// ── Inline field-level alerts ──

export type FieldAlert = {
  level: 'normal' | 'warning' | 'critical';
  message: string;
  messageAr: string;
};

export function getFieldAlert(field: string, value: string | number | null | undefined): FieldAlert | null {
  if (value === null || value === undefined || value === '') return null;

  switch (field) {
    case 'bp': {
      const [sys, dia] = String(value).split('/').map(Number);
      if (Number.isNaN(sys) || Number.isNaN(dia)) return null;
      if (sys <= 80 || sys >= 180 || dia <= 50 || dia >= 120)
        return { level: 'critical', message: `Critical BP`, messageAr: `ضغط حرج: ${sys}/${dia}` };
      if (sys < 90 || sys > 140 || dia < 60 || dia > 90)
        return { level: 'warning', message: sys > 140 ? '↑ High' : '↓ Low', messageAr: sys > 140 ? '↑ مرتفع' : '↓ منخفض' };
      return { level: 'normal', message: 'Normal', messageAr: 'طبيعي' };
    }
    case 'hr': {
      const v = Number(value);
      if (Number.isNaN(v)) return null;
      if (v <= 40 || v >= 150) return { level: 'critical', message: `Critical HR`, messageAr: `نبض حرج: ${v}` };
      if (v < 60 || v > 100) return { level: 'warning', message: v > 100 ? '↑ Fast' : '↓ Slow', messageAr: v > 100 ? '↑ سريع' : '↓ بطيء' };
      return { level: 'normal', message: 'Normal', messageAr: 'طبيعي' };
    }
    case 'temp': {
      const v = Number(value);
      if (Number.isNaN(v)) return null;
      if (v <= 35 || v >= 39.5) return { level: 'critical', message: `Critical`, messageAr: `حرج: ${v}°C` };
      if (v < 36 || v > 37.5) return { level: 'warning', message: v > 37.5 ? '↑ Fever' : '↓ Low', messageAr: v > 37.5 ? '↑ حرارة' : '↓ انخفاض' };
      return { level: 'normal', message: 'Normal', messageAr: 'طبيعي' };
    }
    case 'spo2': {
      const v = Number(value);
      if (Number.isNaN(v)) return null;
      if (v <= 90) return { level: 'critical', message: `Critical SpO2`, messageAr: `أكسجين حرج: ${v}%` };
      if (v < 95) return { level: 'warning', message: '↓ Low', messageAr: '↓ منخفض' };
      return { level: 'normal', message: 'Normal', messageAr: 'طبيعي' };
    }
    case 'rr': {
      const v = Number(value);
      if (Number.isNaN(v)) return null;
      if (v <= 8 || v >= 30) return { level: 'critical', message: `Critical RR`, messageAr: `تنفس حرج: ${v}` };
      if (v < 12 || v > 20) return { level: 'warning', message: v > 20 ? '↑ Fast' : '↓ Slow', messageAr: v > 20 ? '↑ سريع' : '↓ بطيء' };
      return { level: 'normal', message: 'Normal', messageAr: 'طبيعي' };
    }
    case 'glucose': {
      const v = Number(value);
      if (Number.isNaN(v)) return null;
      if (v <= 50 || v >= 400) return { level: 'critical', message: `Critical`, messageAr: `سكر حرج: ${v}` };
      if (v < 70 || v > 200) return { level: 'warning', message: v > 200 ? '↑ High' : '↓ Low', messageAr: v > 200 ? '↑ مرتفع' : '↓ منخفض' };
      return { level: 'normal', message: 'Normal', messageAr: 'طبيعي' };
    }
    default: return null;
  }
}

// ── BMI Classification (WHO) ──

export function getBMICategory(bmi: number) {
  if (bmi < 16)   return { label: 'نقص حاد', labelEn: 'Severely Underweight', color: 'text-red-700',    bg: 'bg-red-50',    icon: 'trending-down' };
  if (bmi < 18.5) return { label: 'نقص وزن', labelEn: 'Underweight',          color: 'text-blue-700',   bg: 'bg-blue-50',   icon: 'trending-down' };
  if (bmi < 25)   return { label: 'طبيعي',   labelEn: 'Normal',               color: 'text-green-700',  bg: 'bg-green-50',  icon: 'check' };
  if (bmi < 30)   return { label: 'زيادة وزن', labelEn: 'Overweight',          color: 'text-amber-700',  bg: 'bg-amber-50',  icon: 'trending-up' };
  if (bmi < 35)   return { label: 'سمنة ١',   labelEn: 'Obese I',              color: 'text-orange-700', bg: 'bg-orange-50', icon: 'trending-up' };
  if (bmi < 40)   return { label: 'سمنة ٢',   labelEn: 'Obese II',             color: 'text-red-600',    bg: 'bg-red-50',    icon: 'trending-up' };
  return            { label: 'سمنة مفرطة', labelEn: 'Obese III',             color: 'text-red-800',    bg: 'bg-red-100',   icon: 'alert-triangle' };
}

// ── Priority Auto-Suggestion from Vitals ──

export function suggestPriority(vitals: {
  bp?: string;
  hr?: string | number;
  temp?: string | number;
  rr?: string | number;
  spo2?: string | number;
  glucose?: string | number;
}): 'URGENT' | 'HIGH' | 'NORMAL' {
  const fields = ['bp', 'hr', 'temp', 'rr', 'spo2', 'glucose'] as const;
  let criticalCount = 0;
  let warningCount = 0;

  for (const field of fields) {
    const alert = getFieldAlert(field, vitals[field]);
    if (!alert) continue;
    if (alert.level === 'critical') criticalCount += 1;
    else if (alert.level === 'warning') warningCount += 1;
  }

  if (criticalCount >= 2) return 'URGENT';
  if (criticalCount >= 1) return 'HIGH';
  if (warningCount >= 3) return 'HIGH';
  return 'NORMAL';
}
