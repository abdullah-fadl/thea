export type AvpuLevel = 'A' | 'V' | 'P' | 'U';

export type ObservationInput = {
  systolic: number | null;
  diastolic: number | null;
  hr: number | null;
  rr: number | null;
  temp: number | null;
  spo2: number | null;
  painScore: number | null;
  avpu: AvpuLevel | null;
};

export function evaluateCriticalVitals(input: ObservationInput): { critical: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const s = input.systolic;
  const d = input.diastolic;
  const hr = input.hr;
  const rr = input.rr;
  const temp = input.temp;
  const spo2 = input.spo2;
  const pain = input.painScore;
  const avpu = input.avpu;

  if (typeof spo2 === 'number' && spo2 < 90) reasons.push('SpO2 < 90');
  if (typeof s === 'number' && s < 90) reasons.push('Systolic BP < 90');
  if (typeof s === 'number' && s > 180) reasons.push('Systolic BP > 180');
  if (typeof d === 'number' && d > 120) reasons.push('Diastolic BP > 120');
  if (typeof hr === 'number' && hr < 40) reasons.push('HR < 40');
  if (typeof hr === 'number' && hr > 130) reasons.push('HR > 130');
  if (typeof rr === 'number' && rr < 8) reasons.push('RR < 8');
  if (typeof rr === 'number' && rr > 30) reasons.push('RR > 30');
  if (typeof temp === 'number' && temp < 35) reasons.push('Temp < 35');
  if (typeof temp === 'number' && temp >= 39) reasons.push('Temp ≥ 39');
  if (typeof pain === 'number' && pain >= 9) reasons.push('Severe pain (≥ 9/10)');
  if (avpu === 'P' || avpu === 'U') reasons.push(`AVPU = ${avpu}`);

  return { critical: reasons.length > 0, reasons };
}

