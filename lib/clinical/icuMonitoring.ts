/**
 * ICU-specific monitoring: Ventilator settings, Hemodynamics, Drip calculations
 */

/* ── Ventilator ── */

export type VentMode = 'AC-VC' | 'AC-PC' | 'SIMV' | 'PSV' | 'CPAP' | 'BIPAP' | 'HFNC' | 'PRVC' | 'APRV';

export interface VentilatorSettings {
  mode: VentMode;
  fio2: number;       // 21-100%
  peep: number;       // cmH2O
  tidalVolume: number; // mL
  rr: number;         // set resp rate
  pip: number;        // peak inspiratory pressure
  ps: number;         // pressure support
  ieRatio: string;    // e.g., "1:2"
  flow: number;       // L/min (for HFNC)
}

export interface VentilatorReading {
  settings: VentilatorSettings;
  measured: {
    actualTv: number;     // actual tidal volume
    actualRr: number;     // actual respiratory rate
    minuteVent: number;   // minute ventilation
    peakPressure: number;
    plateauPressure: number;
    compliance: number;   // mL/cmH2O
    resistance: number;   // cmH2O/L/s
  };
  abg?: {
    ph: number;
    pco2: number;
    po2: number;
    hco3: number;
    baseExcess: number;
    lactate: number;
  };
  recordedAt: string;
}

export const DEFAULT_VENT_SETTINGS: VentilatorSettings = {
  mode: 'AC-VC', fio2: 40, peep: 5, tidalVolume: 450, rr: 14,
  pip: 25, ps: 10, ieRatio: '1:2', flow: 0,
};

export const VENT_MODES: { value: VentMode; labelEn: string; labelAr: string }[] = [
  { value: 'AC-VC', labelEn: 'Assist-Control (Volume)', labelAr: 'تحكم مساعد (حجم)' },
  { value: 'AC-PC', labelEn: 'Assist-Control (Pressure)', labelAr: 'تحكم مساعد (ضغط)' },
  { value: 'SIMV', labelEn: 'SIMV', labelAr: 'SIMV' },
  { value: 'PSV', labelEn: 'Pressure Support', labelAr: 'دعم ضغطي' },
  { value: 'CPAP', labelEn: 'CPAP', labelAr: 'CPAP' },
  { value: 'BIPAP', labelEn: 'BiPAP', labelAr: 'BiPAP' },
  { value: 'HFNC', labelEn: 'High-Flow Nasal Cannula', labelAr: 'كانيولا أنفية عالية التدفق' },
  { value: 'PRVC', labelEn: 'PRVC', labelAr: 'PRVC' },
  { value: 'APRV', labelEn: 'APRV', labelAr: 'APRV' },
];

/* ── Hemodynamics ── */

export interface HemodynamicReading {
  map: number;         // Mean Arterial Pressure
  cvp: number;         // Central Venous Pressure
  co: number;          // Cardiac Output
  ci: number;          // Cardiac Index
  svr: number;         // Systemic Vascular Resistance
  svv: number;         // Stroke Volume Variation
  scvO2: number;       // Central Venous O2 Saturation
  art: { systolic: number; diastolic: number }; // Arterial line
  recordedAt: string;
}

export const DEFAULT_HEMO: HemodynamicReading = {
  map: 0, cvp: 0, co: 0, ci: 0, svr: 0, svv: 0, scvO2: 0,
  art: { systolic: 0, diastolic: 0 },
  recordedAt: new Date().toISOString(),
};

/* ── Drip (Infusion) Tracking ── */

export interface DripEntry {
  id: string;
  drugName: string;
  concentration: string;
  rate: number;          // mL/hr
  dose: string;          // e.g., "5 mcg/kg/min"
  startedAt: string;
  adjustments: { time: string; newRate: number; reason: string }[];
  stoppedAt?: string;
}

export interface ICUMonitoringData {
  ventilator: VentilatorReading[];
  hemodynamics: HemodynamicReading[];
  drips: DripEntry[];
}

export const DEFAULT_ICU_MONITORING: ICUMonitoringData = {
  ventilator: [],
  hemodynamics: [],
  drips: [],
};

/* ── P/F Ratio calculation ── */
export function calculatePFRatio(pao2: number, fio2Percent: number): { ratio: number; category: string; labelAr: string; labelEn: string } {
  if (!pao2 || !fio2Percent) return { ratio: 0, category: 'unknown', labelAr: 'غير معروف', labelEn: 'Unknown' };
  const fio2 = fio2Percent / 100;
  const ratio = Math.round(pao2 / fio2);
  if (ratio >= 400) return { ratio, category: 'normal', labelAr: 'طبيعي', labelEn: 'Normal' };
  if (ratio >= 300) return { ratio, category: 'mild', labelAr: 'خفيف', labelEn: 'Mild ARDS' };
  if (ratio >= 200) return { ratio, category: 'moderate', labelAr: 'متوسط', labelEn: 'Moderate ARDS' };
  if (ratio >= 100) return { ratio, category: 'severe', labelAr: 'شديد', labelEn: 'Severe ARDS' };
  return { ratio, category: 'critical', labelAr: 'حرج', labelEn: 'Critical' };
}

/* ── MAP calculation ── */
export function calculateMAP(systolic: number, diastolic: number): number {
  if (!systolic || !diastolic) return 0;
  return Math.round(diastolic + (systolic - diastolic) / 3);
}
