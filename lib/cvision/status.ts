/**
 * CVision Employee Status - Canonical Values and Normalization
 *
 * All status values in the database MUST be one of these canonical values.
 * Use normalizeStatus() when reading from DB (for compatibility).
 * Use assertValidStatus() when writing to DB (enforces canonical).
 */

export const CANON_STATUSES = [
  'PROBATION', 'ACTIVE',
  'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE',
  'SUSPENDED', 'SUSPENDED_WITHOUT_PAY',
  'NOTICE_PERIOD',
  'RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED',
] as const;

export type CanonStatus = typeof CANON_STATUSES[number];

const CANON_SET = new Set<string>(CANON_STATUSES);

const LEGACY_MAP: Record<string, CanonStatus> = {
  'active': 'ACTIVE',
  'probation': 'PROBATION',
  'resigned': 'RESIGNED',
  'terminated': 'TERMINATED',
  'suspended': 'SUSPENDED',
  'on_leave': 'ON_ANNUAL_LEAVE',
  'on_annual_leave': 'ON_ANNUAL_LEAVE',
  'on_sick_leave': 'ON_SICK_LEAVE',
  'on_maternity_leave': 'ON_MATERNITY_LEAVE',
  'on_unpaid_leave': 'ON_UNPAID_LEAVE',
  'suspended_without_pay': 'SUSPENDED_WITHOUT_PAY',
  'notice_period': 'NOTICE_PERIOD',
  'end_of_contract': 'END_OF_CONTRACT',
  'retired': 'RETIRED',
  'deceased': 'DECEASED',
};

/**
 * Normalize any status input to canonical uppercase value.
 * Handles legacy lowercase values and unknown inputs.
 */
export function normalizeStatus(input: unknown): CanonStatus {
  const s = String(input ?? '').trim();
  const upper = s.toUpperCase();
  if (CANON_SET.has(upper)) return upper as CanonStatus;
  const lower = s.toLowerCase();
  if (LEGACY_MAP[lower]) return LEGACY_MAP[lower];
  return 'PROBATION';
}

/**
 * Assert that input is a valid canonical status, throw if not.
 */
export function assertValidStatus(input: unknown): CanonStatus {
  const s = String(input ?? '').trim().toUpperCase();
  if (CANON_SET.has(s)) return s as CanonStatus;
  const lower = String(input ?? '').trim().toLowerCase();
  if (LEGACY_MAP[lower]) return LEGACY_MAP[lower];
  throw new Error(`INVALID_STATUS:${s}`);
}

export function isValidStatus(input: unknown): boolean {
  try {
    assertValidStatus(input);
    return true;
  } catch {
    return false;
  }
}
