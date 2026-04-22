import type { ErStatus } from './constants';

export interface TriageVitalsInput {
  systolic?: number | null;
  diastolic?: number | null;
  hr?: number | null;
  rr?: number | null;
  temp?: number | null;
  spo2?: number | null;
}

export interface TriageCalcResult {
  triageLevel: number;
  critical: boolean;
  reasons: string[];
  statusAfterSave: ErStatus;
}

export interface TriageCompletionInput {
  chiefComplaint?: string | null;
  vitals?: {
    systolic?: number | null;
    diastolic?: number | null;
    HR?: number | null;
    RR?: number | null;
    TEMP?: number | null;
    SPO2?: number | null;
  } | null;
  triageLevel?: number | null;
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export function validateTriageCompletionInput(input: TriageCompletionInput): {
  missing: string[];
} {
  const missing: string[] = [];
  const chiefComplaint = String(input.chiefComplaint ?? '').trim();
  if (!chiefComplaint) missing.push('chiefComplaint');

  const vitals = input.vitals || {};
  if (!isFiniteNumber(vitals.systolic)) missing.push('systolic');
  if (!isFiniteNumber(vitals.diastolic)) missing.push('diastolic');
  if (!isFiniteNumber(vitals.HR)) missing.push('HR');
  if (!isFiniteNumber(vitals.RR)) missing.push('RR');
  if (!isFiniteNumber(vitals.TEMP)) missing.push('TEMP');
  if (!isFiniteNumber(vitals.SPO2)) missing.push('SPO2');

  if (!isFiniteNumber(input.triageLevel) || input.triageLevel < 1 || input.triageLevel > 5) {
    missing.push('triageLevel');
  }

  return { missing };
}

export function calculateTriageLevel(
  vitals: TriageVitalsInput,
  painScore?: number | null
): TriageCalcResult {
  const reasons: string[] = [];
  let critical = false;
  let level = 5;

  const hr = vitals.hr ?? null;
  const rr = vitals.rr ?? null;
  const temp = vitals.temp ?? null;
  const spo2 = vitals.spo2 ?? null;
  const systolic = vitals.systolic ?? null;

  if (spo2 !== null && spo2 < 80) {
    critical = true;
    reasons.push('SpO2 < 80');
    level = Math.min(level, 1);
  }
  if (systolic !== null && systolic < 80) {
    critical = true;
    reasons.push('Systolic < 80');
    level = Math.min(level, 1);
  }
  if (hr !== null && (hr < 40 || hr > 160)) {
    critical = true;
    reasons.push('HR extreme');
    level = Math.min(level, 1);
  }
  if (rr !== null && rr > 35) {
    critical = true;
    reasons.push('RR extreme');
    level = Math.min(level, 1);
  }

  if (!critical) {
    if (spo2 !== null && spo2 < 90) {
      reasons.push('SpO2 < 90');
      level = Math.min(level, 2);
    }
    if (temp !== null && temp >= 39) {
      reasons.push('Temp >= 39');
      level = Math.min(level, 2);
    }
    if (hr !== null && hr > 130) {
      reasons.push('HR > 130');
      level = Math.min(level, 2);
    }
    if (rr !== null && rr >= 30) {
      reasons.push('RR >= 30');
      level = Math.min(level, 2);
    }
  }

  if (level > 2) {
    if (painScore !== null && painScore !== undefined) {
      if (painScore >= 7) {
        level = Math.min(level, 3);
        reasons.push('Pain >= 7');
      } else if (painScore >= 4) {
        level = Math.min(level, 4);
        reasons.push('Pain 4-6');
      }
    }
  }

  return {
    triageLevel: level,
    critical,
    reasons,
    // Starting triage implies triage is in progress. Completion is handled by /api/er/triage/complete.
    statusAfterSave: 'TRIAGE_IN_PROGRESS',
  };
}
