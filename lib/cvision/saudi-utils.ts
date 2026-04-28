/**
 * Shared Saudi Employee Detection Utility
 *
 * Used by: GOSI reports, Muqeem system, Analytics engine, Nitaqat reports, WPS
 *
 * Rule: Saudi national IDs start with "1", Iqamas start with "2".
 * This is the STANDARD Saudi identification rule across all government systems.
 */

// All known representations of "Saudi" nationality in the database
export const SAUDI_NATIONALITY_VALUES = [
  'sa',
  'saudi',
  'saudi arabia',
  'saudi arabian',
  'سعودي',
  'سعودية',
  'المملكة العربية السعودية',
] as const;

/**
 * Determine if an employee is Saudi.
 *
 * Uses three methods (in order of reliability):
 *  1. nationalId prefix — "1" = Saudi, "2" = Non-Saudi (most reliable)
 *  2. nationality field — case-insensitive match against known values
 *  3. explicit isSaudi flag — if set by the system
 *
 * @param employee - any object with nationality / nationalId / isSaudi fields
 */
export function isSaudiEmployee(employee: {
  nationality?: string | null;
  nationalId?: string | null;
  national_id?: string | null;
  iqamaNumber?: string | null;
  isSaudi?: boolean;
}): boolean {
  // Method 1 (MOST RELIABLE): Check nationalId prefix
  // Saudi IDs start with "1" and are 10 digits; Iqamas start with "2"
  const nid = (employee.nationalId || employee.national_id || '').toString().trim();
  if (nid.length === 10) {
    if (nid.startsWith('1')) return true;
    if (nid.startsWith('2')) return false; // Confirmed non-Saudi (iqama holder)
  }

  // Method 2: Check nationality field (case-insensitive, trimmed)
  const nat = (employee.nationality || '').trim().toLowerCase();
  if (nat && (SAUDI_NATIONALITY_VALUES as readonly string[]).includes(nat)) return true;

  // Method 3: Explicit flag
  if (employee.isSaudi === true) return true;

  return false;
}

/**
 * Convenience wrapper matching the analytics-engine pattern.
 */
export function isSaudiNationality(nationality: string | null | undefined): boolean {
  if (!nationality) return false;
  return (SAUDI_NATIONALITY_VALUES as readonly string[]).includes(nationality.trim().toLowerCase());
}
