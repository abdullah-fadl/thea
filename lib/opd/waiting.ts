function toDate(value: any): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesBetween(start: Date, end: Date) {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function waitingToNursingMinutes(now: Date, arrivedAt?: Date | string | null, nursingStartAt?: Date | string | null) {
  const arrived = toDate(arrivedAt);
  if (!arrived) return null;
  const end = toDate(nursingStartAt) || now;
  return minutesBetween(arrived, end);
}

export function waitingToDoctorMinutes(now: Date, nursingEndAt?: Date | string | null, doctorStartAt?: Date | string | null) {
  const nursingEnd = toDate(nursingEndAt);
  if (!nursingEnd) return null;
  const end = toDate(doctorStartAt) || now;
  return minutesBetween(nursingEnd, end);
}
