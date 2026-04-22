/**
 * Data Retention Policy Configuration
 *
 * Defines retention periods for each data category in compliance with:
 * - Saudi PDPL (Personal Data Protection Law)
 * - Saudi MOH (Ministry of Health) regulations
 * - CBAHI / JCI accreditation requirements
 * - Saudi Tax Law (ZATCA)
 */

export interface RetentionRule {
  /** Retention period in days */
  readonly days: number;
  /** Human-readable label (English) */
  readonly label: string;
  /** Human-readable label (Arabic) */
  readonly labelAr: string;
  /** Governing regulation */
  readonly regulation: string;
}

export const RETENTION_POLICY = {
  medical_records: {
    days: 3650,
    label: '10 years',
    labelAr: '10 سنوات',
    regulation: 'Saudi MOH',
  },
  billing_records: {
    days: 2555,
    label: '7 years',
    labelAr: '7 سنوات',
    regulation: 'Tax Law',
  },
  audit_logs: {
    days: 2555,
    label: '7 years',
    labelAr: '7 سنوات',
    regulation: 'CBAHI/JCI',
  },
  consent_records: {
    days: 3650,
    label: '10 years',
    labelAr: '10 سنوات',
    regulation: 'PDPL',
  },
  session_data: {
    days: 90,
    label: '90 days',
    labelAr: '90 يوم',
    regulation: 'Internal Policy',
  },
  temporary_files: {
    days: 30,
    label: '30 days',
    labelAr: '30 يوم',
    regulation: 'Internal Policy',
  },
} as const;

export type RetentionCategory = keyof typeof RETENTION_POLICY;

/**
 * Returns the retention policy for a given data category.
 * Returns `null` if the category is not recognized.
 */
export function getRetentionPolicy(category: string): RetentionRule | null {
  const rule = RETENTION_POLICY[category as RetentionCategory];
  return rule ?? null;
}

/**
 * Checks whether data in the given category has exceeded its retention period.
 *
 * @param category - The data category key (e.g. 'medical_records')
 * @param createdAt - The date the record was created
 * @returns `true` if the retention window has elapsed and data is eligible for purge,
 *          `false` if still within the retention window or the category is unknown.
 */
export function isRetentionExpired(category: string, createdAt: Date): boolean {
  const rule = getRetentionPolicy(category);
  if (!rule) return false;

  const expiresAt = new Date(createdAt.getTime() + rule.days * 24 * 60 * 60 * 1000);
  return new Date() > expiresAt;
}
