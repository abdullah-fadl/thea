/**
 * CVision Employee Status Canonicalization
 *
 * Single source of truth for employee status normalization.
 * All status writes MUST use this helper to ensure canonical values.
 */

export const CANONICAL_STATUSES = [
  'ACTIVE', 'PROBATION',
  'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE',
  'SUSPENDED', 'SUSPENDED_WITHOUT_PAY',
  'NOTICE_PERIOD',
  'RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED',
] as const;

export type CanonicalStatus = typeof CANONICAL_STATUSES[number];

const CANONICAL_SET = new Set<string>(CANONICAL_STATUSES);

const ALIAS_MAP: Record<string, CanonicalStatus> = {
  INACTIVE: 'RESIGNED',
  FIRED: 'TERMINATED',
  ON_LEAVE: 'ON_ANNUAL_LEAVE',
};

export function normalizeStatus(input: string | null | undefined): CanonicalStatus {
  const v = String(input ?? '').trim().toUpperCase();
  if (CANONICAL_SET.has(v)) return v as CanonicalStatus;
  if (ALIAS_MAP[v]) return ALIAS_MAP[v];
  return 'PROBATION';
}

export function assertValidStatus(input: string | null | undefined): CanonicalStatus {
  const v = String(input ?? '').trim().toUpperCase();
  if (CANONICAL_SET.has(v)) return v as CanonicalStatus;
  if (ALIAS_MAP[v]) return ALIAS_MAP[v];
  throw new Error(`INVALID_STATUS: ${input}`);
}
