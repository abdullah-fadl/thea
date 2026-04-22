import { getDefaultPermissionsForRole } from '@/lib/permissions';

export const BUILTIN_ROLE_KEYS = [
  'admin',
] as const;

export type BuiltinRoleKey = typeof BUILTIN_ROLE_KEYS[number];

// Roles that were removed from the project entirely (do not allow create/update, and never return from APIs).
export const REMOVED_ROLE_KEYS = [
  'charge-nurse',
  'charge_nurse',
] as const;

export type RemovedRoleKey = typeof REMOVED_ROLE_KEYS[number];

export function isRemovedRoleKey(roleKey: string): roleKey is RemovedRoleKey {
  return REMOVED_ROLE_KEYS.includes(roleKey as RemovedRoleKey);
}

export function isBuiltinRole(roleKey: string): roleKey is BuiltinRoleKey {
  return BUILTIN_ROLE_KEYS.includes(roleKey as BuiltinRoleKey);
}

export function getBuiltinRoleDefinitions() {
  return BUILTIN_ROLE_KEYS.map((key) => ({
    key,
    permissions: getDefaultPermissionsForRole(key),
  }));
}
