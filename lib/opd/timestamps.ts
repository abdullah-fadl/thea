export const OPD_TIMESTAMP_FIELDS = [
  'arrivedAt',
  'nursingStartAt',
  'nursingEndAt',
  'doctorStartAt',
  'doctorEndAt',
  'procedureStartAt',
  'procedureEndAt',
] as const;

export type OpdTimestampField = (typeof OPD_TIMESTAMP_FIELDS)[number];

export type OpdTimestampConflict = {
  field: OpdTimestampField;
  existingValue: any;
};

function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildAppendOnlyTimestampPatch(
  existingTimestamps: Record<string, any> | null | undefined,
  incomingTimestamps: Record<string, any>
) {
  const existing = existingTimestamps || {};
  const invalidFields: OpdTimestampField[] = [];
  const patch: Record<string, any> = {};
  const nextTimestamps: Record<string, any> = { ...existing };
  let conflict: OpdTimestampConflict | null = null;

  for (const field of OPD_TIMESTAMP_FIELDS) {
    if (!(field in incomingTimestamps)) continue;
    const parsed = parseDate((incomingTimestamps as Record<string, unknown>)[field]);
    if (!parsed) {
      invalidFields.push(field);
      continue;
    }
    if (existing && existing[field]) {
      if (!conflict) conflict = { field, existingValue: existing[field] };
      continue;
    }
    patch[`opdTimestamps.${field}`] = parsed;
    nextTimestamps[field] = parsed;
  }

  return { invalidFields, patch, nextTimestamps, conflict };
}
