/**
 * Intake & Output (I&O) — Fluid Balance Tracker
 * Tracks all fluid intake and output with automatic balance calculation.
 * Supports shift-based and 24-hour totals with clinical alerts.
 */

export type IODirection = 'INTAKE' | 'OUTPUT';
export type IntakeType = 'ORAL' | 'IV_FLUID' | 'IV_MEDICATION' | 'BLOOD_PRODUCT' | 'TUBE_FEEDING' | 'OTHER_INTAKE';
export type OutputType = 'URINE' | 'EMESIS' | 'DRAIN' | 'STOOL' | 'BLOOD_LOSS' | 'NASOGASTRIC' | 'OTHER_OUTPUT';
export type IOBalanceStatus = 'BALANCED' | 'POSITIVE' | 'NEGATIVE' | 'CRITICAL_POSITIVE' | 'CRITICAL_NEGATIVE';

export interface IOEntry {
  id: string;
  direction: IODirection;
  type: IntakeType | OutputType;
  amount: number; // mL
  description: string;
  timestamp: string;
  shift?: string;
}

export interface IOData {
  entries: IOEntry[];
}

export const DEFAULT_IO_DATA: IOData = { entries: [] };

export const INTAKE_TYPES: { value: IntakeType; labelAr: string; labelEn: string; icon: string }[] = [
  { value: 'ORAL', labelAr: 'فموي (ماء/عصير)', labelEn: 'Oral (water/juice)', icon: 'cup-soda' },
  { value: 'IV_FLUID', labelAr: 'محاليل وريدية', labelEn: 'IV Fluids', icon: 'droplets' },
  { value: 'IV_MEDICATION', labelAr: 'أدوية وريدية', labelEn: 'IV Medication', icon: 'syringe' },
  { value: 'BLOOD_PRODUCT', labelAr: 'منتجات دم', labelEn: 'Blood Products', icon: 'droplets' },
  { value: 'TUBE_FEEDING', labelAr: 'تغذية أنبوبية', labelEn: 'Tube Feeding', icon: 'wrench' },
  { value: 'OTHER_INTAKE', labelAr: 'أخرى', labelEn: 'Other', icon: 'clipboard' },
];

export const OUTPUT_TYPES: { value: OutputType; labelAr: string; labelEn: string; icon: string }[] = [
  { value: 'URINE', labelAr: 'بول', labelEn: 'Urine', icon: 'beaker' },
  { value: 'EMESIS', labelAr: 'قيء', labelEn: 'Emesis', icon: 'circle-alert' },
  { value: 'DRAIN', labelAr: 'تصريف (درن)', labelEn: 'Drain', icon: 'chevron-down' },
  { value: 'STOOL', labelAr: 'براز', labelEn: 'Stool', icon: 'circle-alert' },
  { value: 'BLOOD_LOSS', labelAr: 'نزيف', labelEn: 'Blood Loss', icon: 'droplets' },
  { value: 'NASOGASTRIC', labelAr: 'أنبوب أنفي معدي', labelEn: 'NG Tube', icon: 'wrench' },
  { value: 'OTHER_OUTPUT', labelAr: 'أخرى', labelEn: 'Other', icon: 'clipboard' },
];

export function calculateBalance(entries: IOEntry[]): {
  totalIntake: number;
  totalOutput: number;
  balance: number;
  status: IOBalanceStatus;
  intakeByType: Record<string, number>;
  outputByType: Record<string, number>;
} {
  let totalIntake = 0;
  let totalOutput = 0;
  const intakeByType: Record<string, number> = {};
  const outputByType: Record<string, number> = {};

  for (const e of entries) {
    if (e.direction === 'INTAKE') {
      totalIntake += e.amount;
      intakeByType[e.type] = (intakeByType[e.type] || 0) + e.amount;
    } else {
      totalOutput += e.amount;
      outputByType[e.type] = (outputByType[e.type] || 0) + e.amount;
    }
  }

  const balance = totalIntake - totalOutput;
  let status: IOBalanceStatus = 'BALANCED';

  if (balance > 1000) status = 'CRITICAL_POSITIVE';
  else if (balance > 500) status = 'POSITIVE';
  else if (balance < -1000) status = 'CRITICAL_NEGATIVE';
  else if (balance < -500) status = 'NEGATIVE';

  return { totalIntake, totalOutput, balance, status, intakeByType, outputByType };
}

export const BALANCE_STATUS_CONFIG: Record<IOBalanceStatus, { colorClass: string; bgClass: string; labelAr: string; labelEn: string }> = {
  BALANCED: { colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', labelAr: 'متوازن', labelEn: 'Balanced' },
  POSITIVE: { colorClass: 'text-blue-700', bgClass: 'bg-blue-50', labelAr: 'موجب', labelEn: 'Positive' },
  NEGATIVE: { colorClass: 'text-amber-700', bgClass: 'bg-amber-50', labelAr: 'سالب', labelEn: 'Negative' },
  CRITICAL_POSITIVE: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelAr: 'موجب حرج (احتباس)', labelEn: 'Critical Positive (Overload)' },
  CRITICAL_NEGATIVE: { colorClass: 'text-red-700', bgClass: 'bg-red-50', labelAr: 'سالب حرج (جفاف)', labelEn: 'Critical Negative (Dehydration)' },
};
