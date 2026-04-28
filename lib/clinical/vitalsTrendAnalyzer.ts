/**
 * Vitals Trend Analyzer
 * Rule-based trend detection for vital signs over time.
 * Identifies rising/falling patterns, sudden changes, and clinical concerns.
 */

export type TrendDirection = 'RISING' | 'FALLING' | 'STABLE' | 'FLUCTUATING' | 'INSUFFICIENT';
export type TrendSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface VitalsDataPoint {
  date: string | Date;
  bp?: string | null;
  hr?: number | null;
  temp?: number | null;
  spo2?: number | null;
  rr?: number | null;
  weight?: number | null;
}

export interface TrendResult {
  parameter: string;
  labelAr: string;
  labelEn: string;
  direction: TrendDirection;
  severity: TrendSeverity;
  messageAr: string;
  messageEn: string;
  values: { date: string; value: number }[];
  changePercent: number | null;
  currentValue: number | null;
  previousValue: number | null;
}

export interface TrendAnalysis {
  trends: TrendResult[];
  overallRisk: TrendSeverity;
  summaryAr: string;
  summaryEn: string;
  analyzedPoints: number;
}

interface ParamConfig {
  key: string;
  labelAr: string;
  labelEn: string;
  unit: string;
  normalRange: [number, number];
  warningThresholds: { risingPct: number; fallingPct: number };
  criticalRange: [number, number];
  extract: (dp: VitalsDataPoint) => number | null;
}

const PARAM_CONFIGS: ParamConfig[] = [
  {
    key: 'systolic',
    labelAr: 'ضغط الدم الانقباضي',
    labelEn: 'Systolic BP',
    unit: 'mmHg',
    normalRange: [90, 140],
    warningThresholds: { risingPct: 15, fallingPct: 15 },
    criticalRange: [80, 180],
    extract: (dp) => {
      if (!dp.bp) return null;
      const sys = Number(String(dp.bp).split('/')[0]);
      return Number.isNaN(sys) ? null : sys;
    },
  },
  {
    key: 'diastolic',
    labelAr: 'ضغط الدم الانبساطي',
    labelEn: 'Diastolic BP',
    unit: 'mmHg',
    normalRange: [60, 90],
    warningThresholds: { risingPct: 15, fallingPct: 15 },
    criticalRange: [50, 120],
    extract: (dp) => {
      if (!dp.bp) return null;
      const parts = String(dp.bp).split('/');
      if (parts.length < 2) return null;
      const dia = Number(parts[1]);
      return Number.isNaN(dia) ? null : dia;
    },
  },
  {
    key: 'hr',
    labelAr: 'نبض القلب',
    labelEn: 'Heart Rate',
    unit: 'bpm',
    normalRange: [60, 100],
    warningThresholds: { risingPct: 20, fallingPct: 20 },
    criticalRange: [40, 150],
    extract: (dp) => dp.hr ?? null,
  },
  {
    key: 'temp',
    labelAr: 'الحرارة',
    labelEn: 'Temperature',
    unit: '°C',
    normalRange: [36.1, 37.5],
    warningThresholds: { risingPct: 3, fallingPct: 3 },
    criticalRange: [35, 39.5],
    extract: (dp) => dp.temp ?? null,
  },
  {
    key: 'spo2',
    labelAr: 'تشبع الأكسجين',
    labelEn: 'SpO2',
    unit: '%',
    normalRange: [95, 100],
    warningThresholds: { risingPct: 5, fallingPct: 3 },
    criticalRange: [90, 101],
    extract: (dp) => dp.spo2 ?? null,
  },
  {
    key: 'rr',
    labelAr: 'معدل التنفس',
    labelEn: 'Respiratory Rate',
    unit: '/min',
    normalRange: [12, 20],
    warningThresholds: { risingPct: 25, fallingPct: 25 },
    criticalRange: [8, 30],
    extract: (dp) => dp.rr ?? null,
  },
  {
    key: 'weight',
    labelAr: 'الوزن',
    labelEn: 'Weight',
    unit: 'kg',
    normalRange: [0, 999],
    warningThresholds: { risingPct: 5, fallingPct: 5 },
    criticalRange: [0, 999],
    extract: (dp) => dp.weight ?? null,
  },
];

function detectDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'INSUFFICIENT';
  if (values.length === 2) {
    const diff = values[1] - values[0];
    if (Math.abs(diff) < 0.01 * Math.abs(values[0] || 1)) return 'STABLE';
    return diff > 0 ? 'RISING' : 'FALLING';
  }

  let rises = 0;
  let falls = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const threshold = Math.abs(values[i - 1] || 1) * 0.01;
    if (diff > threshold) rises++;
    else if (diff < -threshold) falls++;
  }

  const total = values.length - 1;
  if (rises >= total * 0.6) return 'RISING';
  if (falls >= total * 0.6) return 'FALLING';
  if (rises > 0 && falls > 0 && rises + falls >= total * 0.6) return 'FLUCTUATING';
  return 'STABLE';
}

function analyzeSingleParam(config: ParamConfig, dataPoints: VitalsDataPoint[]): TrendResult | null {
  const extracted: { date: string; value: number }[] = [];
  for (const dp of dataPoints) {
    const val = config.extract(dp);
    if (val !== null) {
      extracted.push({
        date: dp.date instanceof Date ? dp.date.toISOString() : String(dp.date),
        value: val,
      });
    }
  }

  if (extracted.length < 2) return null;

  const values = extracted.map(e => e.value);
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  const first = values[0];

  const direction = detectDirection(values);
  const overallChange = first !== 0 ? ((current - first) / Math.abs(first)) * 100 : 0;
  const recentChange = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;

  let severity: TrendSeverity = 'INFO';
  let messageAr = '';
  let messageEn = '';

  if (current < config.criticalRange[0] || current > config.criticalRange[1]) {
    severity = 'CRITICAL';
    if (current < config.criticalRange[0]) {
      messageAr = `${config.labelAr} منخفض بشكل حرج: ${current} ${config.unit}`;
      messageEn = `${config.labelEn} critically low: ${current} ${config.unit}`;
    } else {
      messageAr = `${config.labelAr} مرتفع بشكل حرج: ${current} ${config.unit}`;
      messageEn = `${config.labelEn} critically high: ${current} ${config.unit}`;
    }
  } else if (current < config.normalRange[0] || current > config.normalRange[1]) {
    severity = 'WARNING';
    if (current < config.normalRange[0]) {
      messageAr = `${config.labelAr} أقل من الطبيعي: ${current} ${config.unit}`;
      messageEn = `${config.labelEn} below normal: ${current} ${config.unit}`;
    } else {
      messageAr = `${config.labelAr} أعلى من الطبيعي: ${current} ${config.unit}`;
      messageEn = `${config.labelEn} above normal: ${current} ${config.unit}`;
    }
  } else if (direction === 'RISING' && Math.abs(overallChange) >= config.warningThresholds.risingPct) {
    severity = 'WARNING';
    messageAr = `${config.labelAr} في ارتفاع مستمر (${Math.abs(Math.round(overallChange))}%)`;
    messageEn = `${config.labelEn} trending up (${Math.abs(Math.round(overallChange))}%)`;
  } else if (direction === 'FALLING' && Math.abs(overallChange) >= config.warningThresholds.fallingPct) {
    severity = 'WARNING';
    messageAr = `${config.labelAr} في انخفاض مستمر (${Math.abs(Math.round(overallChange))}%)`;
    messageEn = `${config.labelEn} trending down (${Math.abs(Math.round(overallChange))}%)`;
  } else if (direction === 'FLUCTUATING') {
    severity = 'INFO';
    messageAr = `${config.labelAr} متذبذب`;
    messageEn = `${config.labelEn} fluctuating`;
  } else if (direction === 'STABLE') {
    messageAr = `${config.labelAr} مستقر`;
    messageEn = `${config.labelEn} stable`;
  } else if (direction === 'RISING') {
    messageAr = `${config.labelAr} في ارتفاع طفيف`;
    messageEn = `${config.labelEn} slight uptrend`;
  } else {
    messageAr = `${config.labelAr} في انخفاض طفيف`;
    messageEn = `${config.labelEn} slight downtrend`;
  }

  if (severity === 'INFO' && direction === 'STABLE') return null;

  return {
    parameter: config.key,
    labelAr: config.labelAr,
    labelEn: config.labelEn,
    direction,
    severity,
    messageAr,
    messageEn,
    values: extracted,
    changePercent: Math.round(overallChange * 10) / 10,
    currentValue: current,
    previousValue: previous,
  };
}

export function analyzeVitalsTrends(dataPoints: VitalsDataPoint[]): TrendAnalysis {
  if (dataPoints.length < 2) {
    return {
      trends: [],
      overallRisk: 'INFO',
      summaryAr: 'بيانات غير كافية للتحليل',
      summaryEn: 'Insufficient data for analysis',
      analyzedPoints: dataPoints.length,
    };
  }

  const trends: TrendResult[] = [];
  for (const config of PARAM_CONFIGS) {
    const result = analyzeSingleParam(config, dataPoints);
    if (result) trends.push(result);
  }

  trends.sort((a, b) => {
    const severityOrder: Record<TrendSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const criticalCount = trends.filter(t => t.severity === 'CRITICAL').length;
  const warningCount = trends.filter(t => t.severity === 'WARNING').length;

  let overallRisk: TrendSeverity = 'INFO';
  if (criticalCount > 0) overallRisk = 'CRITICAL';
  else if (warningCount > 0) overallRisk = 'WARNING';

  let summaryAr = 'جميع المؤشرات مستقرة';
  let summaryEn = 'All indicators stable';
  if (criticalCount > 0) {
    summaryAr = `${criticalCount} مؤشر حرج — تدخل فوري`;
    summaryEn = `${criticalCount} critical indicator(s) — immediate action`;
  } else if (warningCount > 0) {
    summaryAr = `${warningCount} مؤشر يحتاج متابعة`;
    summaryEn = `${warningCount} indicator(s) need attention`;
  }

  return { trends, overallRisk, summaryAr, summaryEn, analyzedPoints: dataPoints.length };
}

export const TREND_DIRECTION_ICONS: Record<TrendDirection, { symbol: string; labelAr: string; labelEn: string }> = {
  RISING: { symbol: '↑', labelAr: 'مرتفع', labelEn: 'Rising' },
  FALLING: { symbol: '↓', labelAr: 'منخفض', labelEn: 'Falling' },
  STABLE: { symbol: '→', labelAr: 'مستقر', labelEn: 'Stable' },
  FLUCTUATING: { symbol: '↕', labelAr: 'متذبذب', labelEn: 'Fluctuating' },
  INSUFFICIENT: { symbol: '—', labelAr: 'غير كافي', labelEn: 'Insufficient' },
};
