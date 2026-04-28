/**
 * Normalize Prisma UserRole enum values to the lowercase-hyphenated format
 * used throughout the application.
 *
 * Prisma enums: THEA_OWNER, ADMIN, GROUP_ADMIN, HOSPITAL_ADMIN, SUPERVISOR, STAFF, VIEWER
 * App strings:  thea-owner, admin, group-admin, hospital-admin, supervisor, staff, viewer
 */

const ROLE_MAP: Record<string, string> = {
  THEA_OWNER: 'thea-owner',
  ADMIN: 'admin',
  GROUP_ADMIN: 'group-admin',
  HOSPITAL_ADMIN: 'hospital-admin',
  SUPERVISOR: 'supervisor',
  STAFF: 'staff',
  VIEWER: 'viewer',
};

/**
 * Convert a Prisma UserRole enum value to the app's lowercase-hyphenated format.
 * If the role is already in lowercase format, it is returned as-is.
 * Unknown roles are lowercased and underscores replaced with hyphens.
 */
export function normalizeRole(role: string | null | undefined): string {
  if (!role) return '';
  const mapped = ROLE_MAP[role];
  if (mapped) return mapped;
  // Already normalized or unknown — lowercase + replace underscores
  return role.toLowerCase().replace(/_/g, '-');
}
